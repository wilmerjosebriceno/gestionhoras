import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SoporteMailService } from './soporte-mail.service';

/** Estados que cuentan como "abierto" (lo demas es finalizado). */
const ABIERTOS = `status_name NOT IN ('resolved','closed')`;

const INTERVALO_ALERTA_MS = 24 * 60 * 60 * 1000; // alerta diaria

export interface FiltrosDashboard {
  desde?: string;
  hasta?: string;
  projectId?: number;
  handlerId?: number;
  reporterId?: number;
  statusId?: number;
  /** Estatus a excluir (varios). */
  excluirStatusIds?: number[];
  /** Si es true, solo casos abiertos (excluye Resolved y Closed). */
  soloAbiertos?: boolean;
  /** Reaperturas: 'si' (>0), '1' (=1) o '2mas' (>=2). */
  reopened?: string;
  estancadosDias?: number;
  limit?: number;
  offset?: number;
}

/**
 * KPIs del dashboard de Mantis, calculados sobre el espejo local
 * (`sigespweb.mantis_issue`). Todo se filtra por rango de fechas y, si se
 * indica, por proyecto. Respuesta en menos de un segundo.
 */
@Injectable()
export class MantisDashboardService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MantisDashboardService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mail: SoporteMailService,
  ) {}

  onApplicationBootstrap(): void {
    const destinatario = (process.env.MANTIS_ALERTAS_EMAIL || '').trim();
    if (!destinatario) {
      this.logger.log(
        'Alertas de casos estancados desactivadas (defina MANTIS_ALERTAS_EMAIL para activarlas).',
      );
      return;
    }
    this.logger.log(`Alertas de casos estancados activadas cada 24 h a ${destinatario}.`);
    this.timer = setInterval(() => {
      const dias = Number(process.env.MANTIS_ALERTAS_DIAS || 15);
      this.alertaEstancados({ estancadosDias: dias }).catch((e) =>
        this.logger.warn(`No se pudo enviar la alerta de estancados: ${e?.message ?? e}`),
      );
    }, INTERVALO_ALERTA_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private rango(desde?: string, hasta?: string) {
    const hoy = new Date();
    const fin = (hasta ?? '').trim() || hoy.toISOString().slice(0, 10);
    let ini = (desde ?? '').trim();
    if (!ini) {
      const d = new Date(hoy);
      d.setDate(1);
      d.setMonth(d.getMonth() - 11);
      ini = d.toISOString().slice(0, 10);
    }
    return { desde: ini, hasta: fin };
  }

  /** Rango + condiciones comunes (fecha, proyecto, responsable). */
  private construirWhere(filtros: FiltrosDashboard) {
    const { desde, hasta } = this.rango(filtros.desde, filtros.hasta);
    const valores: unknown[] = [desde, hasta];
    let extra = '';
    if (filtros.projectId) {
      valores.push(Number(filtros.projectId));
      extra += ` AND project_id = $${valores.length}`;
    }
    if (filtros.handlerId) {
      valores.push(Number(filtros.handlerId));
      extra += ` AND handler_id = $${valores.length}`;
    }
    if (filtros.reporterId) {
      valores.push(Number(filtros.reporterId));
      extra += ` AND reporter_id = $${valores.length}`;
    }
    if (filtros.statusId) {
      valores.push(Number(filtros.statusId));
      extra += ` AND status_id = $${valores.length}`;
    }
    // Excluir estatus concretos (ej. Cerrado / Resuelto).
    const excluir = (filtros.excluirStatusIds ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (excluir.length) {
      valores.push(excluir);
      extra += ` AND (status_id IS NULL OR status_id <> ALL($${valores.length}::int[]))`;
    }
    // Atajo: solo casos abiertos (excluye los finalizados).
    if (filtros.soloAbiertos) extra += ` AND ${ABIERTOS}`;
    // Condición de reaperturas (valores de una lista cerrada: sin inyección).
    if (filtros.reopened === 'si') extra += ' AND reopened_count > 0';
    else if (filtros.reopened === '1') extra += ' AND reopened_count = 1';
    else if (filtros.reopened === '2mas') extra += ' AND reopened_count >= 2';
    const where = `WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')${extra}`;
    return { desde, hasta, where, valores };
  }

  private red(v: unknown): number | null {
    return v == null ? null : Math.round(Number(v) * 100) / 100;
  }

  async dashboard(filtros: FiltrosDashboard) {
    const { desde, hasta, where, valores } = this.construirWhere(filtros);

    /* ---------- KPI resumen ---------- */
    const [kpis] = await this.dataSource.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ${ABIERTOS})::int AS abiertos,
              count(*) FILTER (WHERE NOT (${ABIERTOS}))::int AS cerrados,
              count(*) FILTER (WHERE ${ABIERTOS} AND assigned_at IS NULL)::int AS sin_asignar,
              count(*) FILTER (WHERE ${ABIERTOS} AND handler_id IS NULL)::int AS sin_responsable
         FROM sigespweb.mantis_issue ${where}`,
      valores,
    );

    /* ---------- 1) Casos por proyecto ---------- */
    const porProyecto = await this.dataSource.query(
      `SELECT project_id AS "proyectoId",
              coalesce(project_name, '(sin proyecto)') AS proyecto,
              count(*)::int AS total,
              count(*) FILTER (WHERE ${ABIERTOS})::int AS abiertos,
              count(*) FILTER (WHERE NOT (${ABIERTOS}))::int AS cerrados
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1, 2
        ORDER BY total DESC`,
      valores,
    );

    /* ---------- 2) Agrupacion por estatus ---------- */
    const porEstado = await this.dataSource.query(
      `SELECT status_id AS "estadoId", coalesce(status_name, '-') AS estado, count(*)::int AS total
         FROM sigespweb.mantis_issue ${where}
         GROUP BY 1, 2
        ORDER BY total DESC`,
      valores,
    );

    /* ---------- 3) Casos por usuario NO cerrados ---------- */
    const porUsuarioAbiertos = await this.dataSource.query(
      `SELECT handler_id AS "usuarioId",
              coalesce(handler_name, '(sin responsable)') AS usuario,
              count(*)::int AS abiertos,
              count(*) FILTER (WHERE assigned_at IS NULL)::int AS sin_asignar
         FROM sigespweb.mantis_issue ${where} AND ${ABIERTOS}
        GROUP BY 1, 2
        ORDER BY abiertos DESC`,
      valores,
    );

    /* ---------- 3b) Todos los responsables (para el filtro) ---------- */
    const porUsuario = await this.dataSource.query(
      `SELECT handler_id AS "usuarioId",
              coalesce(handler_name, '(sin responsable)') AS usuario,
              count(*)::int AS total,
              count(*) FILTER (WHERE ${ABIERTOS})::int AS abiertos
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1, 2
        ORDER BY total DESC`,
      valores,
    );
    /* ---------- 3c) Todos los informadores (para el filtro) ---------- */
    const porInformador = await this.dataSource.query(
      `SELECT reporter_id AS "usuarioId",
              coalesce(reporter_name, '(sin informador)') AS usuario,
              count(*)::int AS total,
              count(*) FILTER (WHERE ${ABIERTOS})::int AS abiertos
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1, 2
        ORDER BY total DESC`,
      valores,
    );
    const antiguedad = await this.dataSource.query(
      `SELECT bucket, count(*)::int AS total
         FROM (
           SELECT CASE
                    WHEN (CURRENT_DATE - created_at::date) <= 7  THEN 1
                    WHEN (CURRENT_DATE - created_at::date) <= 30 THEN 2
                    WHEN (CURRENT_DATE - created_at::date) <= 90 THEN 3
                    ELSE 4 END AS bucket
             FROM sigespweb.mantis_issue ${where} AND ${ABIERTOS}
         ) t
        GROUP BY bucket
        ORDER BY bucket`,
      valores,
    );
    const ETIQUETAS_ANTIGUEDAD = ['0-7 días', '8-30 días', '31-90 días', '+90 días'];
    const serieAntiguedad = ETIQUETAS_ANTIGUEDAD.map((rango, i) => ({
      rango,
      total: Number(antiguedad.find((x: any) => Number(x.bucket) === i + 1)?.total ?? 0),
    }));

    /* ---------- 6) Reapertura ---------- */
    const [reapertura] = await this.dataSource.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE reopened_count > 0)::int AS reabiertos,
              count(*) FILTER (WHERE reopened_count = 1)::int AS "unaVez",
              count(*) FILTER (WHERE reopened_count >= 2)::int AS "dosOMas",
              coalesce(max(reopened_count), 0)::int AS "maxReaperturas"
         FROM sigespweb.mantis_issue ${where}`,
      valores,
    );

    /* ---------- 7) Top categorias ---------- */
    const porCategoria = await this.dataSource.query(
      `SELECT coalesce(category_name, '(sin categoría)') AS categoria, count(*)::int AS total
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 12`,
      valores,
    );

    /* ---------- 8) Casos estancados (abiertos sin cambios recientes) ---------- */
    const diasEstancado = Number(filtros.estancadosDias ?? 15);
    const valoresEst = [...valores, diasEstancado];
    const [estancados] = await this.dataSource.query(
      `SELECT count(*)::int AS total, min(created_at) AS mas_antiguo
         FROM sigespweb.mantis_issue ${where} AND ${ABIERTOS}
          AND updated_at < NOW() - ($${valoresEst.length} || ' days')::interval`,
      valoresEst,
    );

    const estancadosLista = await this.dataSource.query(
      `SELECT id, summary, project_name AS "projectName", status_name AS "statusName",
              coalesce(handler_name, '(sin responsable)') AS responsable,
              created_at AS "createdAt", updated_at AS "updatedAt",
              (CURRENT_DATE - updated_at::date)::int AS "diasSinCambios"
         FROM sigespweb.mantis_issue ${where} AND ${ABIERTOS}
          AND updated_at < NOW() - ($${valoresEst.length} || ' days')::interval
        ORDER BY updated_at ASC
        LIMIT 25`,
      valoresEst,
    );

    /* ---------- 9) Por prioridad ---------- */
    const porPrioridad = await this.dataSource.query(
      `SELECT coalesce(priority_name, '-') AS prioridad, count(*)::int AS total
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1
        ORDER BY total DESC`,
      valores,
    );

    /* ---------- 10) Por resolucion ---------- */
    const porResolucion = await this.dataSource.query(
      `SELECT coalesce(resolution_name, '(abierta)') AS resolucion, count(*)::int AS total
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1
        ORDER BY total DESC`,
      valores,
    );

    /* ---------- 4) Tiempos entre estados ---------- */
    const [resolucion] = await this.dataSource.query(
      `SELECT count(*)::int AS casos,
              avg(dias) AS promedio,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS mediana,
              percentile_cont(0.9) WITHIN GROUP (ORDER BY dias) AS p90
         FROM (
           SELECT EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400 AS dias
             FROM sigespweb.mantis_issue ${where} AND resolved_at IS NOT NULL
         ) t`,
      valores,
    );

    const [primeraRespuesta] = await this.dataSource.query(
      `SELECT count(*)::int AS casos, avg(dias) AS promedio,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS mediana
         FROM (
           SELECT EXTRACT(EPOCH FROM (coalesce(acknowledged_at, assigned_at) - created_at)) / 86400 AS dias
             FROM sigespweb.mantis_issue ${where}
            AND coalesce(acknowledged_at, assigned_at) IS NOT NULL
         ) t`,
      valores,
    );

    const [cierre] = await this.dataSource.query(
      `SELECT count(*)::int AS casos, avg(dias) AS promedio,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS mediana
         FROM (
           SELECT EXTRACT(EPOCH FROM (closed_at - resolved_at)) / 86400 AS dias
             FROM sigespweb.mantis_issue ${where} AND closed_at IS NOT NULL AND resolved_at IS NOT NULL
         ) t`,
      valores,
    );

    /* ---------- Serie mensual (recibidos vs cerrados + MTTR) ---------- */
    const porMes = await this.dataSource.query(
      `SELECT to_char(created_at, 'YYYY-MM') AS mes,
              count(*)::int AS recibidos,
              count(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resueltos,
              avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)
                FILTER (WHERE resolved_at IS NOT NULL) AS "mttrDias"
         FROM sigespweb.mantis_issue ${where}
        GROUP BY 1
        ORDER BY 1`,
      valores,
    );

    const cerradosPorMes = await this.dataSource.query(
      `SELECT to_char(closed_at, 'YYYY-MM') AS mes, count(*)::int AS cerrados
         FROM sigespweb.mantis_issue
        WHERE closed_at IS NOT NULL
          AND closed_at >= $1::date AND closed_at < ($2::date + INTERVAL '1 day')
        GROUP BY 1`,
      [desde, hasta],
    );

    const mapaCerrados = new Map<string, number>(
      cerradosPorMes.map((f: any) => [f.mes, Number(f.cerrados)]),
    );
    const serie = porMes.map((f: any) => ({
      mes: f.mes,
      recibidos: Number(f.recibidos),
      resueltos: Number(f.resueltos),
      cerrados: mapaCerrados.get(f.mes) ?? 0,
      mttrDias: this.red(f.mttrDias),
    }));

    return {
      rango: { desde, hasta },
      sincronizacion: await this.ultimaSync(),
      kpis: {
        total: Number(kpis?.total ?? 0),
        abiertos: Number(kpis?.abiertos ?? 0),
        cerrados: Number(kpis?.cerrados ?? 0),
        sinAsignar: Number(kpis?.sin_asignar ?? 0),
        sinResponsable: Number(kpis?.sin_responsable ?? 0),
        mttrDias: this.red(resolucion?.promedio),
        primeraRespuestaDias: this.red(primeraRespuesta?.promedio),
        cierreDias: this.red(cierre?.promedio),
      },
      tiempos: {
        resolucion: {
          casos: Number(resolucion?.casos ?? 0),
          promedioDias: this.red(resolucion?.promedio),
          medianaDias: this.red(resolucion?.mediana),
          p90Dias: this.red(resolucion?.p90),
        },
        primeraRespuesta: {
          casos: Number(primeraRespuesta?.casos ?? 0),
          promedioDias: this.red(primeraRespuesta?.promedio),
          medianaDias: this.red(primeraRespuesta?.mediana),
        },
        cierre: {
          casos: Number(cierre?.casos ?? 0),
          promedioDias: this.red(cierre?.promedio),
          medianaDias: this.red(cierre?.mediana),
        },
      },
      porProyecto,
      porEstado,
      porUsuarioAbiertos,
      porUsuario,
      porInformador,
      porMes: serie,
      reapertura: {
        total: Number(reapertura?.total ?? 0),
        reabiertos: Number(reapertura?.reabiertos ?? 0),
        unaVez: Number(reapertura?.unaVez ?? 0),
        dosOMas: Number(reapertura?.dosOMas ?? 0),
        maxReaperturas: Number(reapertura?.maxReaperturas ?? 0),
        tasa:
          Number(reapertura?.total ?? 0) > 0
            ? Math.round(
                (Number(reapertura.reabiertos) / Number(reapertura.total)) * 1000,
              ) / 10
            : 0,
      },
      antiguedad: serieAntiguedad,
      porCategoria,
      porPrioridad,
      porResolucion,
      estancados: {
        dias: diasEstancado,
        total: Number(estancados?.total ?? 0),
        masAntiguo: estancados?.mas_antiguo ?? null,
        casos: estancadosLista,
      },
    };
  }

  /** Listado paginado de casos del espejo, filtrado (reporte por usuario/proyecto/estado). */
  async listarCasos(filtros: FiltrosDashboard) {
    const { desde, hasta, where, valores } = this.construirWhere(filtros);
    const lim = Math.min(Math.max(Number(filtros.limit ?? 200), 1), 1000);
    const off = Math.max(Number(filtros.offset ?? 0), 0);
    const filas = await this.dataSource.query(
      `SELECT id, summary, project_name, status_name, priority_name, severity_name,
              handler_name, reporter_name, created_at, acknowledged_at, assigned_at,
              resolved_at, closed_at, reopened_count, notes_synced
         FROM sigespweb.mantis_issue ${where}
        ORDER BY id DESC
        LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, lim, off],
    );
    const [totalResp] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM sigespweb.mantis_issue ${where}`,
      valores,
    );
    return { total: Number(totalResp?.total ?? 0), casos: filas, rango: { desde, hasta } };
  }

  /** Genera el CSV (Excel) de los casos del rango. */
  async exportarCasos(filtros: FiltrosDashboard) {
    const { desde, hasta, where, valores } = this.construirWhere(filtros);

    const filas = await this.dataSource.query(
      `SELECT id, summary, project_name, status_name, resolution_name, priority_name,
              severity_name, handler_name, reporter_name,
              created_at, acknowledged_at, assigned_at, resolved_at, closed_at, reopened_count
         FROM sigespweb.mantis_issue ${where}
        ORDER BY id DESC`,
      valores,
    );

    const cabeceras = [
      'ID', 'Resumen', 'Proyecto', 'Estatus', 'Resolución', 'Prioridad', 'Severidad',
      'Responsable', 'Informador', 'Creado', 'Primera respuesta', 'Asignado',
      'Resuelto', 'Cerrado', 'Reaperturas',
    ];
    const lineas = [cabeceras.join(';')];
    for (const f of filas) {
      lineas.push(
        [
          f.id, f.summary, f.project_name, f.status_name, f.resolution_name, f.priority_name,
          f.severity_name, f.handler_name, f.reporter_name,
          this.fecha(f.created_at), this.fecha(f.acknowledged_at), this.fecha(f.assigned_at),
          this.fecha(f.resolved_at), this.fecha(f.closed_at), f.reopened_count,
        ]
          .map((c) => this.campo(c))
          .join(';'),
      );
    }

    return {
      nombre: `mantis-casos_${desde}_${hasta}.csv`,
      contenido: '\uFEFF' + lineas.join('\r\n'),
      filas: filas.length,
    };
  }

  /** Resumen de KPIs en CSV (varias secciones, para informes). */
  async exportarResumen(filtros: FiltrosDashboard) {
    const d = await this.dashboard(filtros);
    const filas: string[] = [];
    const sec = (titulo: string, cabeceras: string[], datos: unknown[][]) => {
      filas.push('');
      filas.push(this.campo(titulo));
      filas.push(cabeceras.join(';'));
      for (const f of datos) filas.push(f.map((c) => this.campo(c)).join(';'));
    };

    filas.push('RESUMEN DE MESA DE AYUDA · MANTIS');
    filas.push(`Rango;${d.rango.desde};${d.rango.hasta}`);
    filas.push(`Generado;${this.fecha(new Date().toISOString())}`);

    sec('INDICADORES', ['Indicador', 'Valor'], [
      ['Total de casos', d.kpis.total],
      ['Abiertos', d.kpis.abiertos],
      ['Cerrados', d.kpis.cerrados],
      ['Sin asignar', d.kpis.sinAsignar],
      ['Sin responsable', d.kpis.sinResponsable],
      ['MTTR (días)', d.kpis.mttrDias ?? ''],
      ['Primera respuesta (días)', d.kpis.primeraRespuestaDias ?? ''],
      ['Cierre (días)', d.kpis.cierreDias ?? ''],
      ['Reaperturas', d.reapertura.reabiertos],
      ['Reaperturas (1 vez)', d.reapertura.unaVez],
      ['Reaperturas (2+ veces)', d.reapertura.dosOMas],
      ['Tasa de reapertura (%)', d.reapertura.tasa],
      [`Estancados (+${d.estancados.dias} d)`, d.estancados.total],
    ]);
    sec('CASOS POR PROYECTO', ['Proyecto', 'Total', 'Abiertos', 'Cerrados'],
      d.porProyecto.map((p: any) => [p.proyecto, p.total, p.abiertos, p.cerrados]));
    sec('CASOS POR ESTATUS', ['Estatus', 'Total'], d.porEstado.map((e: any) => [e.estado, e.total]));
    sec('ABIERTOS POR USUARIO', ['Usuario', 'Abiertos'],
      d.porUsuarioAbiertos.map((u: any) => [u.usuario, u.abiertos]));
    sec('POR MES', ['Mes', 'Recibidos', 'Resueltos', 'Cerrados', 'MTTR (días)'],
      d.porMes.map((m: any) => [m.mes, m.recibidos, m.resueltos, m.cerrados, m.mttrDias ?? '']));
    sec('POR PRIORIDAD', ['Prioridad', 'Total'], d.porPrioridad.map((p: any) => [p.prioridad, p.total]));
    sec('POR RESOLUCIÓN', ['Resolución', 'Total'], d.porResolucion.map((p: any) => [p.resolucion, p.total]));
    sec('TOP CATEGORÍAS', ['Categoría', 'Total'], d.porCategoria.map((c: any) => [c.categoria, c.total]));
    sec('BACKLOG POR ANTIGÜEDAD', ['Antigüedad', 'Abiertos'], d.antiguedad.map((a: any) => [a.rango, a.total]));

    return {
      nombre: `mantis-resumen_${d.rango.desde}_${d.rango.hasta}.csv`,
      contenido: '\uFEFF' + filas.join('\r\n'),
      filas: filas.length,
    };
  }

  /** Envía por correo la lista de casos estancados. */
  async alertaEstancados(filtros: FiltrosDashboard & { destinatario?: string }) {
    const d = await this.dashboard(filtros);
    const total = d.estancados.total;
    if (!total) {
      return { enviado: false, simulado: false, total: 0, mensaje: 'No hay casos estancados en el rango.' };
    }

    const destinatario =
      (filtros.destinatario ?? '').trim() || (process.env.MANTIS_ALERTAS_EMAIL || '').trim();
    if (!destinatario) {
      throw new BadRequestException(
        'Indique un destinatario o defina MANTIS_ALERTAS_EMAIL en el .env.',
      );
    }

    const filas = d.estancados.casos
      .map(
        (c: any) =>
          `<tr>` +
          `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;">#${c.id}</td>` +
          `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;">${this.escapar(c.summary)}</td>` +
          `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;">${this.escapar(c.projectName)}</td>` +
          `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;">${this.escapar(c.statusName)}</td>` +
          `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;">${this.escapar(c.responsable)}</td>` +
          `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;text-align:right;">${c.diasSinCambios}</td>` +
          `</tr>`,
      )
      .join('');

    const html =
      `<div style="font-family:Segoe UI,Arial,sans-serif;background:#eef2f7;padding:24px 12px;">` +
      `<div style="max-width:760px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">` +
      `<div style="background:#0f2f5f;padding:20px 24px;color:#fff;">` +
      `<div style="font-size:18px;font-weight:700;">SIGESP</div>` +
      `<div style="color:#9fc0e8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Mesa de Ayuda y Soporte</div>` +
      `</div>` +
      `<div style="padding:22px 24px;">` +
      `<h1 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Casos estancados sin cambios</h1>` +
      `<p style="margin:0 0 16px;font-size:13px;color:#64748b;">` +
      `Hay <b>${total}</b> caso(s) abierto(s) sin actualización en más de <b>${d.estancados.dias}</b> días ` +
      `(rango ${d.rango.desde} a ${d.rango.hasta}). Se listan los ${d.estancados.casos.length} más antiguos.</p>` +
      `<table style="border-collapse:collapse;width:100%;">` +
      `<tr style="background:#f1f5f9;">` +
      `<th style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:left;">ID</th>` +
      `<th style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:left;">Asunto</th>` +
      `<th style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:left;">Proyecto</th>` +
      `<th style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:left;">Estatus</th>` +
      `<th style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:left;">Responsable</th>` +
      `<th style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;text-align:right;">Días</th>` +
      `</tr>${filas}</table>` +
      `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">` +
      `Generado automáticamente desde el dashboard de Soporte · SIGESP, C.A.</p>` +
      `</div></div></div>`;

    const texto = [
      `SIGESP · Mesa de Ayuda y Soporte`,
      ``,
      `Casos estancados sin cambios (+${d.estancados.dias} días)`,
      `Total: ${total} · rango ${d.rango.desde} a ${d.rango.hasta}`,
      ``,
      ...d.estancados.casos.map(
        (c: any) => `#${c.id} [${c.diasSinCambios} d] ${c.projectName ?? ''} · ${c.responsable}: ${c.summary}`,
      ),
    ].join('\n');

    const envio = await this.mail.enviar({
      para: destinatario,
      asunto: `SOPORTE · ${total} caso(s) estancado(s) sin cambios (+${d.estancados.dias} días)`,
      html,
      texto,
      responderA: (process.env.MAIL_FROM || '').trim() || undefined,
    });

    return { ...envio, total, destinatario, mensaje: 'Alerta enviada.' };
  }

  private campo(v: unknown): string {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  private escapar(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private fecha(iso: unknown): string {
    if (!iso) return '';
    const d = new Date(String(iso));
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private async ultimaSync() {
    const [fila] = await this.dataSource.query(
      `SELECT ultima_sync AS "ultimaSync", detalle
         FROM sigespweb.mantis_sync_state WHERE id = 1`,
    );
    return {
      ultimaSync: fila?.ultimaSync ?? null,
      detalle: fila?.detalle ?? null,
    };
  }
}
