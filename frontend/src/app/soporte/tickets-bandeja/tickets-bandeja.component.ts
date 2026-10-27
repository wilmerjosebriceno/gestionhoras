import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import Highcharts from 'highcharts';
import { SoporteService, Ticket, TicketStats, TicketCatalogos, CasoAlerta } from '../services/soporte.service';
import { SwalService } from '../../core/services/swal.service';
import { construirTextoCierre, RESOLUCION_TICKET_ETIQUETA } from '../utils/cierre.util';

const ETIQUETA_ESTADO: Record<string, string> = {
  nuevo: 'Nuevo',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

@Component({
  selector: 'app-soporte-bandeja',
  standalone: false,
  templateUrl: './tickets-bandeja.component.html',
})
export class TicketsBandejaComponent implements OnInit, OnDestroy {
  cargando = false;
  cargandoFiltros = false;
  cargandoStats = false;

  tickets: Ticket[] = [];
  stats: TicketStats | null = null;
  catalogos: TicketCatalogos | null = null;

  alertas: CasoAlerta[] = [];
  alertaHoras = 24;
  cargandoAlertas = false;
  enviandoAlerta = false;
  private refresco?: ReturnType<typeof setInterval>;

  @ViewChild('chartModulo') chartModulo?: ElementRef;
  private graficoModulo?: Highcharts.Chart;

  total = 0;
  page = 1;
  limit = 20;
  totalPaginas = 1;

  search = '';
  state = '';
  priority = '';
  type = '';
  groupId: number | null = null;
  assigneeId: number | null = null;
  categoryId: number | null = null;
  soloMios = false;
  slaEnRiesgo = false;

  constructor(
    private readonly soporte: SoporteService,
    private readonly swal: SwalService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
    this.cargarStats();
    this.cargar();
    this.cargarAlertas();
    // Auto-refresco de la alerta cada 5 minutos.
    this.refresco = setInterval(() => this.cargarAlertas(), 5 * 60 * 1000);
  }

  ngOnDestroy(): void {
    if (this.refresco) clearInterval(this.refresco);
    if (this.graficoModulo) {
      this.graficoModulo.destroy();
      this.graficoModulo = undefined;
    }
  }

  /** Casos sin atender por mas de N horas laborables. */
  private cargarAlertas(): void {
    this.cargandoAlertas = true;
    this.soporte.alertasSinAtender().subscribe({
      next: (a) => {
        this.alertas = a;
        this.cargandoAlertas = false;
      },
      error: () => {
        this.alertas = [];
        this.cargandoAlertas = false;
      },
    });
  }

  /** Dispara manualmente el resumen por correo a calidad. */
  enviarAlerta(): void {
    this.enviandoAlerta = true;
    this.swal.cargando('Enviando alerta...');
    this.soporte.enviarAlerta().subscribe({
      next: (r) => {
        this.swal.cerrar();
        this.enviandoAlerta = false;
        if (r.nuevos > 0) {
          this.swal.exito('Alerta enviada', `${r.nuevos} caso(s) notificados a ${r.destinatarios}.`);
        } else if (r.casos > 0) {
          this.swal.info('Sin novedades', 'Los casos pendientes ya fueron notificados antes.');
        } else {
          this.swal.info('Sin novedades', 'No hay casos sin atender para notificar.');
        }
        this.cargarAlertas();
      },
      error: (e) => {
        this.swal.cerrar();
        this.enviandoAlerta = false;
        this.swal.error('Error al enviar', this.msg(e));
      },
    });
  }

  verAlerta(a: CasoAlerta): void {
    this.router.navigate(['/soporte/tickets', a.id]);
  }

  estadoLabel(e: string): string {
    return ETIQUETA_ESTADO[e] || e;
  }

  privado(t: Ticket): string {
    return t.priority;
  }

  private cargarCatalogo(): void {
    this.cargandoFiltros = true;
    this.soporte.catalogo().subscribe({
      next: (c) => {
        this.catalogos = c;
        this.cargandoFiltros = false;
      },
      error: (e) => {
        this.cargandoFiltros = false;
        this.swal.error('Error al cargar catálogos', this.msg(e));
      },
    });
  }

  private cargarStats(): void {
    this.cargandoStats = true;
    this.soporte.stats().subscribe({
      next: (s) => {
        this.stats = s;
        this.cargandoStats = false;
        this.renderModulo(s.porModulo ?? []);
      },
      error: (e) => {
        this.cargandoStats = false;
        this.swal.error('Error al cargar indicadores', this.msg(e));
      },
    });
  }

  /** Gráfico de barras: incidencias por módulo/categoría (abiertos vs. cerrados). */
  private renderModulo(datos: TicketStats['porModulo']): void {
    if (!this.chartModulo) return;
    if (this.graficoModulo) {
      this.graficoModulo.destroy();
      this.graficoModulo = undefined;
    }
    // Orden ascendente para que la barra mayor quede arriba.
    const serie = [...datos].slice(0, 12).reverse();
    this.graficoModulo = Highcharts.chart(this.chartModulo.nativeElement, {
      chart: { type: 'bar', height: 360 },
      title: { text: 'Incidencias por módulo', style: { fontSize: '13px' } },
      xAxis: {
        categories: serie.map((d) => d.modulo),
        labels: { style: { fontSize: '10px' } },
      },
      yAxis: { title: { text: 'Incidencias' }, allowDecimals: false },
      legend: { enabled: true },
      tooltip: { shared: true },
      plotOptions: {
        bar: { dataLabels: { enabled: true } },
        series: {
          cursor: 'pointer',
          point: {
            events: {
              // Clic en una barra -> filtra la bandeja por ese módulo/categoría.
              click: (e: any) => {
                const idx = e?.point?.index;
                if (idx != null && serie[idx]) this.filtrarPorModulo(serie[idx].categoryId);
              },
            },
          },
        },
      },
      series: [
        { type: 'bar', name: 'Abiertos', data: serie.map((d) => d.abiertos), color: '#f59e0b' },
        { type: 'bar', name: 'Cerrados', data: serie.map((d) => d.cerrados), color: '#10b981' },
      ],
      credits: { enabled: false },
    });
  }

  /** Aplica el filtro de módulo/categoría desde el gráfico. */
  private filtrarPorModulo(categoryId: number | null): void {
    if (categoryId == null) return; // "Sin categoría" no es filtrable por id
    this.categoryId = categoryId;
    this.page = 1;
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    const filtros: any = {
      page: this.page,
      limit: this.limit,
    };
    if (this.search?.trim()) filtros.search = this.search.trim();
    if (this.state) filtros.state = this.state;
    if (this.priority) filtros.priority = this.priority;
    if (this.type) filtros.type = this.type;
    if (this.groupId != null) filtros.groupId = this.groupId;
    if (this.assigneeId != null) filtros.assigneeId = this.assigneeId;
    if (this.categoryId != null) filtros.categoryId = this.categoryId;
    if (this.soloMios) filtros.soloMios = true;
    if (this.slaEnRiesgo) filtros.slaEnRiesgo = true;

    this.soporte.listar(filtros).subscribe({
      next: (res) => {
        this.tickets = res.data;
        this.total = res.total;
        this.totalPaginas = res.totalPaginas;
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar tickets', this.msg(e));
      },
    });
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.search = '';
    this.state = '';
    this.priority = '';
    this.type = '';
    this.groupId = null;
    this.assigneeId = null;
    this.categoryId = null;
    this.soloMios = false;
    this.slaEnRiesgo = false;
    this.page = 1;
    this.cargar();
  }

  irAPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.page = p;
    this.cargar();
  }

  abrir(t: Ticket): void {
    this.router.navigate(['/soporte/tickets', t.id]);
  }

  /** Texto de cierre sugerido (editable en el diálogo). */
  private textoSugeridoCierre(t: Ticket): string {
    return construirTextoCierre({
      solicitante: t.requesterName,
      numero: t.number,
      asunto: t.title,
      resolucion: t.resolutionCode
        ? RESOLUCION_TICKET_ETIQUETA[t.resolutionCode] ?? t.resolutionCode
        : '',
      notas: t.resolutionNotes,
    });
  }

  /** Cierra el ticket porque el caso está cerrado en Mantis y notifica al cliente. */
  async cerrarDesdeMantis(t: Ticket): Promise<void> {
    const r = await this.swal.confirmarConTexto({
      titulo: 'El caso está CERRADO en Mantis',
      html:
        `Caso <b>#${t.mantisIssueId ?? ''}</b> cerrado en Mantis.` +
        `<div style="font-size:12px;color:#64748b;margin-top:6px;">` +
        `Puede cerrar el ticket y notificar al cliente con la conversación, o cerrarlo sin correo.</div>`,
      valor: this.textoSugeridoCierre(t),
      textoPrincipal: 'Cerrar y notificar',
      textoSecundario: 'Solo cerrar',
      textoCancelar: 'Más tarde',
      icono: 'info',
    });
    if (r.accion === 'cancelar') return;

    const notificar = r.accion === 'principal';
    this.swal.cargando(notificar ? 'Cerrando y notificando al cliente...' : 'Cerrando el ticket...');

    const payload: any = { notificar };
    if (r.texto.trim()) payload.mensaje = r.texto.trim();

    this.soporte.cerrarDesdeMantis(t.id, payload).subscribe({
      next: (res) => {
        this.swal.cerrar();
        const nota = res?.simulado ? ' (SMTP no configurado: el correo no se envió)' : '';
        if (res?.notificado === false) {
          this.swal.exito('Ticket cerrado', 'El ticket quedó cerrado (sin notificación al cliente).');
        } else if (res?.sinCorreo) {
          this.swal.advertencia(
            'Ticket cerrado',
            'El ticket quedó cerrado, pero no se pudo notificar al cliente (sin correo de contacto).',
          );
        } else {
          this.swal.exito(
            'Ticket cerrado',
            `Se cerró ${t.number} y se notificó a ${res?.destinatario ?? 'el cliente'}${nota}.`,
          );
        }
        this.cargar();
        this.cargarStats();
      },
      error: (e) => {
        this.swal.cerrar();
        this.swal.error('No se pudo cerrar el ticket', this.msg(e));
      },
    });
  }

  nuevoTicket(): void {
    this.router.navigate(['/soporte/tickets/nuevo']);
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}