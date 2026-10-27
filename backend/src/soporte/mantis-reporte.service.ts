import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MantisDashboardService, FiltrosDashboard } from './mantis-dashboard.service';
import { MantisClientService } from '../mantis/mantis-client.service';
import { SoporteMailService } from './soporte-mail.service';

interface Nota {
  autor: string;
  fecha: string | null;
  texto: string;
}

interface CasoFila {
  id: number;
  summary: string | null;
  project_name: string | null;
  status_name: string | null;
  priority_name: string | null;
  severity_name: string | null;
  handler_name: string | null;
  reporter_name: string | null;
  created_at: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  reopened_count?: number | null;
  notes_synced?: boolean;
  notas?: Nota[];
}

/**
 * Genera el reporte PDF (pdfmake) de casos de Mantis con sus comentarios.
 *
 * - Las cabeceras de los casos se leen del espejo local (rápido).
 * - Los comentarios (notas) se consultan EN VIVO a Mantis por caso, con
 *   concurrencia limitada, porque el espejo no almacena las notas.
 *
 * Encabezado tipográfico (sin imagen), pie con paginación y KPIs.
 */
@Injectable()
export class MantisReporteService {
  private readonly logger = new Logger(MantisReporteService.name);
  private printer: any;

  /** Tope de casos por reporte (evita reportes infinitos). */
  private get tope(): number {
    const n = Number(process.env.MANTIS_REPORTE_MAX || 300);
    return Number.isFinite(n) && n > 0 ? n : 300;
  }

  private readonly concurrencia = 8;

  constructor(
    private readonly dashboard: MantisDashboardService,
    private readonly mantis: MantisClientService,
    private readonly dataSource: DataSource,
    private readonly mail: SoporteMailService,
  ) {}

  async generarPdf(
    filtros: FiltrosDashboard & { incluirNotas?: boolean },
  ): Promise<{ nombre: string; buffer: Buffer; casos: number; total: number; truncado: boolean }> {
    const incluirNotas = filtros.incluirNotas === true;
    const { casos, total } = await this.dashboard.listarCasos({
      ...filtros,
      limit: this.tope,
      offset: 0,
    });
    const truncado = Number(total) > casos.length;

    let filas: CasoFila[] = casos as any;
    if (incluirNotas && casos.length) {
      const lista = casos as any[];
      const ids: number[] = lista.map((c: any) => Number(c.id));
      const delEspejo = await this.notasMirror(ids);
      const pendientes = lista.filter((c: any) => !c.notes_synced).map((c: any) => Number(c.id));
      const enVivo = new Map<number, Nota[]>();
      if (pendientes.length) {
        const res = await this.mapConcurrent<number, Nota[]>(pendientes, this.concurrencia, (id: number) => this.notasDe(id));
        pendientes.forEach((id, i) => enVivo.set(id, res[i] ?? []));
      }
      filas = lista.map((c: any) => {
        const id = Number(c.id);
        const notas = c.notes_synced ? delEspejo.get(id) ?? [] : enVivo.get(id) ?? [];
        return { ...c, notas };
      });
    }

    const buffer = await this.buildPdf(this.docDefinition(filas, filtros, truncado, incluirNotas));
    const proyectoNombre = filtros.projectId
      ? (casos[0] as any)?.project_name ?? `Proyecto ${filtros.projectId}`
      : 'Todos los proyectos';
    const nombre = `mantis-${this.slug(proyectoNombre)}_${filtros.desde ?? ''}_${filtros.hasta ?? ''}.pdf`;
    this.logger.log(`Reporte Mantis PDF generado: ${filas.length} caso(s) (de ${total})`);
    return { nombre, buffer, casos: filas.length, total, truncado };
  }

  /** Envía por correo el mismo reporte (PDF adjunto). */
  async enviarPdf(
    filtros: FiltrosDashboard & { incluirNotas?: boolean; destinatario?: string },
  ): Promise<{ enviado: boolean; simulado: boolean; destinatario: string; casos: number; total: number }> {
    const destinatario =
      (filtros.destinatario ?? '').trim() || (process.env.MANTIS_ALERTAS_EMAIL || '').trim();
    if (!destinatario) {
      throw new BadRequestException(
        'Indique un destinatario o defina MANTIS_ALERTAS_EMAIL en el .env.',
      );
    }
    const { nombre, buffer, casos, total } = await this.generarPdf(filtros);
    const rango = `${filtros.desde ?? '—'} a ${filtros.hasta ?? '—'}`;
    const html =
      `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;font-size:14px;">` +
      `<p>Estimados señores,</p>` +
      `<p>Adjuntamos el <b>reporte de casos Mantis</b> correspondiente al período <b>${rango}</b>.</p>` +
      `<p>Casos incluidos: <b>${casos}</b>${total > casos ? ` (de ${total})` : ''}.</p>` +
      `<p style="color:#64748b;font-size:12px;margin-top:18px;">SIGESP · Mesa de Ayuda y Soporte</p>` +
      `</div>`;
    const texto = `Reporte de casos Mantis (${rango}). Casos incluidos: ${casos}.`;
    const envio = await this.mail.enviar({
      para: destinatario,
      asunto: `SOPORTE · Reporte de casos Mantis (${rango})`,
      html,
      texto,
      responderA: (process.env.MAIL_FROM || '').trim() || undefined,
      adjuntos: [{ filename: nombre, content: buffer, contentType: 'application/pdf' }],
    });
    this.logger.log(`Reporte Mantis enviado por correo a ${destinatario} (${casos} caso(s))`);
    return { ...envio, destinatario, casos, total };
  }

  /** Comentarios ya espejados (Fase 2), agrupados por caso. */
  private async notasMirror(ids: number[]): Promise<Map<number, Nota[]>> {
    const mapa = new Map<number, Nota[]>();
    if (!ids.length) return mapa;
    try {
      const filas: any[] = await this.dataSource.query(
        `SELECT issue_id, autor, created_at, texto
           FROM sigespweb.mantis_issue_note
          WHERE issue_id = ANY($1::int[])
          ORDER BY created_at ASC NULLS FIRST, id ASC`,
        [ids],
      );
      for (const f of filas) {
        const k = Number(f.issue_id);
        const arr = mapa.get(k) ?? [];
        arr.push({ autor: f.autor ?? '—', fecha: f.created_at ?? null, texto: f.texto ?? '' });
        mapa.set(k, arr);
      }
    } catch (e: any) {
      this.logger.warn(`No se pudieron leer las notas del espejo: ${e?.message ?? e}`);
    }
    return mapa;
  }

  /* ==================== Notas en vivo ==================== */

  private async notasDe(id: number): Promise<Nota[]> {
    try {
      const issue = await this.mantis.getIssue(id);
      const nombre = (u: any) => (u ? u.real_name || u.name || String(u.id) : '—');
      return (Array.isArray(issue?.notes) ? issue!.notes! : []).map((n: any) => ({
        autor: nombre(n.reporter) ?? nombre(n.user) ?? '—',
        fecha: n.created_at ?? n.date_submitted ?? null,
        texto: this.limpiar(n.text),
      }));
    } catch (e: any) {
      this.logger.warn(`No se pudieron leer las notas del caso #${id}: ${e?.message ?? e}`);
      return [];
    }
  }

  /** Ejecuta `fn` sobre `items` con un máximo de tareas en paralelo. */
  private async mapConcurrent<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const salida: R[] = new Array(items.length);
    let cursor = 0;
    const trabajadores = Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) break;
        try {
          salida[i] = await fn(items[i]);
        } catch {
          salida[i] = undefined as any;
        }
      }
    });
    await Promise.all(trabajadores);
    return salida;
  }

  /* ==================== Documento ==================== */

  private docDefinition(
    casos: CasoFila[],
    filtros: FiltrosDashboard,
    truncado: boolean,
    incluirNotas: boolean,
  ): any {
    const abiertos = casos.filter(
      (c) => !['resolved', 'closed'].includes(String(c.status_name || '').toLowerCase()),
    ).length;
    const cerrados = casos.length - abiertos;
    const sinAsignar = casos.filter((c) => !c.handler_name).length;
    const prio = this.contar(casos.map((c) => c.priority_name || '(sin prioridad)'));
    const proyectoNombre = filtros.projectId
      ? casos[0]?.project_name ?? `Proyecto ${filtros.projectId}`
      : 'Todos los proyectos';

    const cabecera = [
      { text: '#Mantis', style: 'th', alignment: 'left' },
      { text: 'Fecha / Hora', style: 'th' },
      { text: 'Proyecto', style: 'th' },
      { text: 'Asunto', style: 'th' },
      { text: 'Estatus', style: 'th' },
      { text: 'Prioridad', style: 'th' },
    ];

    const cuerpo: any[] = [cabecera];
    for (const c of casos) {
      cuerpo.push([
        { text: '#' + c.id, bold: true, color: '#0F2F5F', fontSize: 9 },
        { text: this.fmtFechaHora(c.created_at) || '—', fontSize: 8.5, color: '#475569' },
        { text: c.project_name || '—', fontSize: 8.5 },
        {
          stack: [
            { text: c.summary || '(sin asunto)', fontSize: 9, bold: true },
            {
              text: 'Responsable: ' + (c.handler_name || '(sin asignar)'),
              fontSize: 8,
              color: '#64748b',
            },
          ],
        },
        { text: c.status_name || '—', fontSize: 8.5, bold: true, color: this.colorEstado(c.status_name) },
        { text: c.priority_name || '—', fontSize: 8.5, bold: true, color: this.colorPrioridad(c.priority_name) },
      ]);

      if (incluirNotas) {
        if (c.notas && c.notas.length) {
          for (const n of c.notas) {
            cuerpo.push([{ colSpan: 6, ...this.lineaNota(n) }, {}, {}, {}, {}, {}]);
          }
        } else {
          cuerpo.push([
            {
              colSpan: 6,
              text: 'Sin comentarios registrados',
              fontSize: 8,
              italics: true,
              color: '#cbd5e1',
              margin: [12, 1, 0, 1],
            },
            {}, {}, {}, {}, {},
          ]);
        }
      }
    }

    return {
      pageSize: 'A4',
      pageOrientation: incluirNotas ? 'portrait' : 'landscape',
      pageMargins: incluirNotas ? [30, 42, 30, 45] : [24, 42, 24, 45],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
      styles: {
        th: { bold: true, fontSize: 8.5, color: '#ffffff', fillColor: '#0F2F5F' },
      },
      header: (currentPage: number) =>
        currentPage === 1
          ? undefined
          : {
              text: 'SIGESP · Reporte de casos Mantis',
              fontSize: 8,
              color: '#94a3b8',
              margin: [30, 16, 30, 0],
            },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, color: '#94a3b8', margin: [30, 0, 0, 0] },
          {
            text: 'SIGESP · Reporte generado por el sistema',
            fontSize: 8,
            color: '#94a3b8',
            alignment: 'right',
            margin: [0, 0, 30, 0],
          },
        ],
        margin: [0, 14, 0, 0],
      }),
      content: [
        // Encabezado tipográfico
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  fillColor: '#0F2F5F',
                  border: [false, false, false, false],
                  margin: [14, 12, 14, 12],
                  stack: [
                    { text: 'SIGESP, C.A.', bold: true, fontSize: 16, color: '#ffffff' },
                    {
                      text: 'MESA DE AYUDA Y SOPORTE',
                      fontSize: 8,
                      color: '#9fc0e8',
                      characterSpacing: 1.5,
                      margin: [0, 2, 0, 6],
                    },
                    { text: 'REPORTE DE CASOS · MANTIS', fontSize: 12, bold: true, color: '#dbeafe' },
                  ],
                },
              ],
            ],
          },
          layout: 'noBorders',
        },
        {
          columns: [
            { width: '*', text: [{ text: 'Proyecto: ', bold: true, color: '#0F2F5F' }, { text: proyectoNombre }] },
            {
              width: '*',
              text: [
                { text: 'Período: ', bold: true, color: '#0F2F5F' },
                { text: `${filtros.desde ?? '—'} – ${filtros.hasta ?? '—'}` },
              ],
            },
            {
              width: '*',
              text: [
                { text: 'Generado: ', bold: true, color: '#0F2F5F' },
                { text: this.fmtFechaHora(new Date().toISOString()) },
              ],
            },
          ],
          fontSize: 8.5,
          margin: [2, 10, 2, 0],
        },
        // KPIs
        {
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [
              [
                this.kpi(casos.length, 'Total'),
                this.kpi(abiertos, 'Abiertos'),
                this.kpi(cerrados, 'Cerrados'),
                this.kpi(sinAsignar, 'Sin asignar'),
                this.kpi(prio.get('high') ?? 0, 'Prioridad alta'),
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 10, 0, 0],
        },
        {
          text: `Prioridad: ${[...prio.entries()].map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`,
          fontSize: 8,
          color: '#64748b',
          margin: [2, 6, 0, 0],
        },
        ...(truncado
          ? [
              {
                text: `Nota: se muestran los primeros ${casos.length} casos; ajuste el rango o el proyecto para ver el resto.`,
                fontSize: 8,
                color: '#b45309',
                margin: [2, 4, 0, 0],
              },
            ]
          : []),
        {
          text: incluirNotas ? 'DETALLE DE CASOS Y COMENTARIOS' : 'REGISTRO DE CASOS',
          fontSize: 10,
          bold: true,
          color: '#0F2F5F',
          margin: [0, 12, 0, 4],
        },
        incluirNotas
          ? {
              table: { headerRows: 1, widths: [52, 72, 86, '*', 70, 58], body: cuerpo },
              layout: this.layoutTabla(),
            }
          : this.tablaPrincipal(casos),
      ],
    };
  }

  /** Tabla "solo registro principal": una fila por caso, sin comentarios/respuestas. */
  private tablaPrincipal(casos: CasoFila[]): any {
    const cabecera = [
      { text: '#Mantis', style: 'th', alignment: 'left' },
      { text: 'Fecha / Hora', style: 'th' },
      { text: 'Proyecto', style: 'th' },
      { text: 'Asunto', style: 'th' },
      { text: 'Estatus', style: 'th' },
      { text: 'Prioridad', style: 'th' },
      { text: 'Severidad', style: 'th' },
      { text: 'Responsable', style: 'th' },
      { text: 'Informador', style: 'th' },
      { text: 'Cierre', style: 'th' },
    ];
    const cuerpo: any[] = [cabecera];
    for (const c of casos) {
      cuerpo.push([
        { text: '#' + c.id, bold: true, color: '#0F2F5F', fontSize: 8.5 },
        { text: this.fmtFechaHora(c.created_at) || '—', fontSize: 8, color: '#475569' },
        { text: c.project_name || '—', fontSize: 8 },
        { text: c.summary || '(sin asunto)', fontSize: 8.5, bold: true },
        { text: c.status_name || '—', fontSize: 8, bold: true, color: this.colorEstado(c.status_name) },
        { text: c.priority_name || '—', fontSize: 8, bold: true, color: this.colorPrioridad(c.priority_name) },
        { text: c.severity_name || '—', fontSize: 8 },
        { text: c.handler_name || '(sin asignar)', fontSize: 8 },
        { text: c.reporter_name || '—', fontSize: 8 },
        { text: this.fmtFechaHora(c.closed_at) || '—', fontSize: 8, color: '#64748b' },
      ]);
    }
    return {
      table: { headerRows: 1, widths: [42, 64, 76, '*', 54, 48, 48, 66, 66, 64], body: cuerpo },
      layout: this.layoutTabla(),
    };
  }

  /** Estilo de las tablas del reporte. */
  private layoutTabla(): any {
    return {
      hLineColor: () => '#E2E8F0',
      vLineWidth: () => 0,
      hLineWidth: () => 0.5,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    };
  }

  private lineaNota(n: Nota): any {
    return {
      text: [
        { text: '↳  ', color: '#94a3b8' },
        { text: this.fmtFechaHora(n.fecha) || 's/f', color: '#94a3b8' },
        { text: '   ' + n.autor, color: '#2E6FBF', bold: true },
        { text: n.texto ? '  ·  ' + n.texto : '', color: '#64748b' },
      ],
      fontSize: 8,
      margin: [12, 1, 0, 1],
    };
  }

  private kpi(valor: number | string, etiqueta: string): any {
    return {
      stack: [
        { text: String(valor), bold: true, fontSize: 15, color: '#0F2F5F' },
        { text: etiqueta, fontSize: 7.5, color: '#64748b' },
      ],
      fillColor: '#F1F5F9',
      margin: [8, 6, 8, 6],
    };
  }

  /* ==================== Utilidades ==================== */

  private colorEstado(s?: string | null): string {
    const v = String(s || '').toLowerCase();
    if (['resolved', 'closed'].includes(v)) return '#16a34a';
    if (v === 'new') return '#2563eb';
    if (['assigned', 'acknowledged', 'confirmed', 'feedback'].includes(v)) return '#d97706';
    return '#64748b';
  }

  private colorPrioridad(p?: string | null): string {
    const v = String(p || '').toLowerCase();
    if (['urgent', 'immediate', 'high'].includes(v)) return '#dc2626';
    if (v === 'low') return '#7c3aed';
    if (v === 'normal') return '#0f172a';
    return '#64748b';
  }

  private contar(valores: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  }

  private limpiar(v: unknown): string {
    return String(v ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  private fmtFechaHora(iso: unknown): string {
    if (!iso) return '';
    const d = new Date(String(iso));
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private slug(v: string): string {
    return v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'proyecto';
  }

  private getPrinter(): any {
    if (this.printer) return this.printer;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PdfPrinter = require('pdfmake');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vfsRaw = require('pdfmake/build/vfs_fonts.js');
    const vfs = vfsRaw?.pdfMake?.vfs ?? vfsRaw;
    const b64 = (k: string) => Buffer.from(vfs[k], 'base64');
    const fonts = {
      Roboto: {
        normal: b64('Roboto-Regular.ttf'),
        bold: b64('Roboto-Medium.ttf'),
        italics: b64('Roboto-Italic.ttf'),
        bolditalics: b64('Roboto-MediumItalic.ttf'),
      },
    };
    this.printer = new PdfPrinter(fonts);
    return this.printer;
  }

  private buildPdf(dd: any): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = this.getPrinter().createPdfKitDocument(dd);
      const chunks: any[] = [];
      doc.on('data', (c: any) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
