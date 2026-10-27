import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SoporteMailService } from './soporte-mail.service';
import {
  addWorkingHours,
  ahoraEnCalendario,
  esDiaLaborable,
  workingHoursBetween,
} from './business-calendar';

const TIPO = 'sin_atender_24h';

export interface CasoSinAtender {
  id: number;
  number: string;
  title: string;
  priority: string;
  state: string;
  requester_name: string | null;
  assignee_id: number | null;
  responsable: string;
  created_at: Date;
  fechaLimite: Date;
  horasTranscurridas: number;
}

/**
 * Alerta de casos sin atender por mas de N horas laborables (L-V).
 *
 * - Deteccion: tickets en estado `nuevo` sin primera respuesta (`first_response_at`).
 * - Resumen diario a una hora fija (por defecto 08:00) en dias laborables.
 * - Un solo correo por caso (idempotente via `sigespweb.ticket_alertas`).
 * - Destino configurable (por defecto calidad@sigesp.com.ve).
 */
@Injectable()
export class AlertasService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertasService.name);
  private timer?: NodeJS.Timeout;
  private ultimoResumenFecha: string | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mail: SoporteMailService,
  ) {}

  private get horas(): number {
    return Number(process.env.SOPORTE_ALERTA_HORAS || 24) || 24;
  }
  private get destinatarios(): string {
    return (process.env.SOPORTE_ALERTA_CORREO || 'calidad@sigesp.com.ve').trim();
  }
  private get cronMin(): number {
    return Math.max(5, Number(process.env.SOPORTE_ALERTA_CRON_MIN || 60) || 60);
  }
  private get horaEnvio(): number {
    return Math.max(0, Math.min(23, Number(process.env.SOPORTE_ALERTA_HORA || 8) || 0));
  }

  async onApplicationBootstrap(): Promise<void> {
    this.timer = setInterval(() => {
      this.revisar('programado').catch(() => undefined);
    }, this.cronMin * 60000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Estado de la alerta (diagnostico). */
  estado() {
    return {
      horas: this.horas,
      destinatarios: this.destinatarios,
      horaEnvio: this.horaEnvio,
      cronMin: this.cronMin,
      ultimoResumenFecha: this.ultimoResumenFecha,
      ahora: ahoraEnCalendario(),
      esDiaLaborable: esDiaLaborable(),
    };
  }

  /** Reinicia el control del resumen diario (util para pruebas). */
  resetearResumenDiario() {
    const anterior = this.ultimoResumenFecha;
    this.ultimoResumenFecha = null;
    return { reseteado: true, ultimoResumenFecha: anterior, ahora: ahoraEnCalendario() };
  }

  /* ==================== Consultas ==================== */

  /** Casos abiertos sin primera respuesta que ya superaron las horas laborables. */
  async sinAtender(): Promise<CasoSinAtender[]> {
    const filas = await this.dataSource.query<any[]>(
      `SELECT t.id, t.number, t.title, t.priority, t.state,
              t.requester_name, t.assignee_id, t.created_at,
              COALESCE(u.username, '—') AS responsable
         FROM sigespweb.tickets t
         LEFT JOIN sigespweb.usuarios u ON u.id = t.assignee_id
        WHERE t.first_response_at IS NULL
          AND t.state = 'nuevo'
        ORDER BY t.created_at ASC`,
    );

    const ahora = new Date();
    return filas
      .map((f) => {
        const creado = new Date(f.created_at);
        const horasTranscurridas = workingHoursBetween(creado, ahora);
        return {
          id: Number(f.id),
          number: f.number,
          title: f.title,
          priority: f.priority,
          state: f.state,
          requester_name: f.requester_name ?? null,
          assignee_id: f.assignee_id != null ? Number(f.assignee_id) : null,
          responsable: f.responsable,
          created_at: creado,
          fechaLimite: addWorkingHours(creado, this.horas),
          horasTranscurridas: Math.round(horasTranscurridas * 100) / 100,
        };
      })
      .filter((f) => f.horasTranscurridas >= this.horas);
  }

  /** Contador para el badge/indicador en pantalla. */
  async resumen(): Promise<{ total: number; horas: number }> {
    const casos = await this.sinAtender();
    return { total: casos.length, horas: this.horas };
  }

  /** Historial de alertas generadas. */
  async historial(limite = 100): Promise<any[]> {
    const n = Math.min(Math.max(Number(limite) || 100, 1), 500);
    return this.dataSource.query(
      `SELECT a.id, a.tipo, a.detectado_at, a.correo_enviado_at, a.destinatarios,
              a.fecha_limite, a.horas_transcurridas,
              t.number, t.title, t.priority
         FROM sigespweb.ticket_alertas a
         JOIN sigespweb.tickets t ON t.id = a.ticket_id
        WHERE a.tipo = $1
        ORDER BY a.detectado_at DESC
        LIMIT $2`,
      [TIPO, n],
    );
  }

  /* ==================== Envio ==================== */

  /**
   * Detecta casos nuevos, los registra y envia el resumen por correo.
   * Idempotente: un caso se envia una sola vez (UNIQUE ticket_id+tipo).
   */
  async enviarAlerta(manual = false): Promise<{
    nuevos: number;
    enviado: boolean;
    simulado: boolean;
    destinatarios: string;
    casos: number;
  }> {
    const casos = await this.sinAtender();
    if (!casos.length) {
      return { nuevos: 0, enviado: false, simulado: false, destinatarios: this.destinatarios, casos: 0 };
    }

    // Solo los que aun no han sido alertados.
    const ids = casos.map((c) => c.id);
    const yaAlertados: any[] = await this.dataSource.query(
      `SELECT ticket_id FROM sigespweb.ticket_alertas
        WHERE tipo = $1 AND ticket_id = ANY($2::int[])`,
      [TIPO, ids],
    );
    const alertados = new Set(yaAlertados.map((r) => Number(r.ticket_id)));
    const nuevos = casos.filter((c) => !alertados.has(c.id));

    if (!nuevos.length) {
      return { nuevos: 0, enviado: false, simulado: false, destinatarios: this.destinatarios, casos: casos.length };
    }

    const html = this.construirHtml(nuevos);
    const { enviado, simulado } = await this.mail.enviar({
      para: this.destinatarios,
      asunto: `[SIGESP Soporte] ${nuevos.length} caso(s) sin atender > ${this.horas} h laborables`,
      html,
      texto: this.construirTexto(nuevos),
    });

    // Se registra solo si el correo salio (o fue simulado sin SMTP), para permitir reintentos.
    if (enviado || simulado) {
      for (const c of nuevos) {
        await this.dataSource.query(
          `INSERT INTO sigespweb.ticket_alertas
             (ticket_id, tipo, fecha_limite, horas_transcurridas, correo_enviado_at, destinatarios)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           ON CONFLICT (ticket_id, tipo) DO UPDATE
             SET correo_enviado_at = NOW(), destinatarios = EXCLUDED.destinatarios,
                 fecha_limite = EXCLUDED.fecha_limite,
                 horas_transcurridas = EXCLUDED.horas_transcurridas`,
          [c.id, TIPO, c.fechaLimite, c.horasTranscurridas, this.destinatarios],
        );
      }
      this.logger.log(
        `Alerta de casos sin atender: ${nuevos.length} caso(s) ${manual ? '(manual) ' : ''}a ${this.destinatarios}`,
      );
    }

    return { nuevos: nuevos.length, enviado, simulado, destinatarios: this.destinatarios, casos: casos.length };
  }

  /** Revision programada: solo dias laborables, a partir de la hora de corte y una vez al dia. */
  async revisar(motivo: string): Promise<void> {
    if (!esDiaLaborable()) return;
    const { fecha, hora } = ahoraEnCalendario();
    if (hora < this.horaEnvio) return;
    if (this.ultimoResumenFecha === fecha) return;

    try {
      const res = await this.enviarAlerta(false);
      this.ultimoResumenFecha = fecha;
      if (res.nuevos > 0) {
        this.logger.log(`Resumen diario de alertas (${motivo}): ${res.nuevos} caso(s).`);
      }
    } catch (e: any) {
      this.logger.error(`Error en resumen de alertas (${motivo}): ${e?.message ?? e}`);
    }
  }

  /* ==================== Presentacion ==================== */

  private construirTexto(casos: CasoSinAtender[]): string {
    const lineas = [
      `Casos sin atender por mas de ${this.horas} horas laborables (${casos.length}):`,
      '',
    ];
    for (const c of casos) {
      lineas.push(
        `#${c.number} [${c.priority}] ${c.title}`,
        `  Solicitante: ${c.requester_name ?? '—'} | Responsable: ${c.responsable}`,
        `  Registrado: ${this.fmt(c.created_at)} | Limite: ${this.fmt(c.fechaLimite)} | ${c.horasTranscurridas} h laborables`,
        '',
      );
    }
    return lineas.join('\n');
  }

  private construirHtml(casos: CasoSinAtender[]): string {
    const filas = casos
      .map(
        (c) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace">#${c.number}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${this.esc(c.title)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${c.priority}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${this.esc(c.requester_name ?? '—')}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${this.fmt(c.created_at)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${this.fmt(c.fechaLimite)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${c.horasTranscurridas}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${this.esc(c.responsable)}</td>
        </tr>`,
      )
      .join('');

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937">
      <h2 style="margin:0 0 4px;color:#b91c1c">Casos sin atender &gt; ${this.horas} h laborables</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280">
        Los siguientes casos no han recibido primera respuesta dentro de las ${this.horas} horas
        laborables (lunes a viernes). Total: <b>${casos.length}</b>.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:12px">
        <thead>
          <tr style="background:#f3f4f6;text-align:left">
            <th style="padding:6px 8px">Nro.</th>
            <th style="padding:6px 8px">Titulo</th>
            <th style="padding:6px 8px">Prior.</th>
            <th style="padding:6px 8px">Solicitante</th>
            <th style="padding:6px 8px">Registrado</th>
            <th style="padding:6px 8px">Limite</th>
            <th style="padding:6px 8px;text-align:right">Horas lab.</th>
            <th style="padding:6px 8px">Responsable</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af">
        Mensaje automatico del modulo de Soporte SIGESP.
      </p>
    </div>`;
  }

  private fmt(fecha: Date | null): string {
    if (!fecha) return '—';
    const w = new Date(fecha.getTime()); // formato de presentacion
    const dd = String(w.getDate()).padStart(2, '0');
    const mm = String(w.getMonth() + 1).padStart(2, '0');
    const hh = String(w.getHours()).padStart(2, '0');
    const mi = String(w.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${w.getFullYear()} ${hh}:${mi}`;
  }

  private esc(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
