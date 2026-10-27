import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import Highcharts from 'highcharts';
import { MantisCaso, MantisDashboard, MantisSyncEstado, SoporteService } from '../services/soporte.service';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';

@Component({
  selector: 'app-mantis-dashboard',
  standalone: false,
  templateUrl: './mantis-dashboard.component.html',
})
export class MantisDashboardComponent implements OnInit, OnDestroy {
  desde = '';
  hasta = '';
  projectId: number | null = null;
  handlerId: number | null = null;
  reporterId: number | null = null;
  statusId: number | null = null;
  excluirStatusIds: number[] = [];
  soloAbiertos = false;
  conDetalle = false;
  reopened = '';

  loading = false;
  consultado = false;
  data: MantisDashboard | null = null;

  proyectos: { id: number; name: string }[] = [];
  responsables: { id: number; name: string }[] = [];
  informadores: { id: number; name: string }[] = [];
  estatus: { id: number; name: string }[] = [];
  alertando = false;

  tab: 'resumen' | 'casos' | 'seguimiento' = 'resumen';
  casos: MantisCaso[] = [];
  casosTotal = 0;
  casosPage = 0;
  casosPageSize = 50;
  casosLoading = false;
  casoSeleccionadoId: number | null = null;

  sync: MantisSyncEstado | null = null;
  sincronizando = false;
  private poll?: ReturnType<typeof setInterval>;

  @ViewChild('chartProyecto') chartProyecto?: ElementRef;
  @ViewChild('chartEstado') chartEstado?: ElementRef;
  @ViewChild('chartUsuario') chartUsuario?: ElementRef;
  @ViewChild('chartMes') chartMes?: ElementRef;
  @ViewChild('chartMttr') chartMttr?: ElementRef;
  @ViewChild('chartTiempos') chartTiempos?: ElementRef;
  @ViewChild('chartAntiguedad') chartAntiguedad?: ElementRef;
  @ViewChild('chartCategoria') chartCategoria?: ElementRef;
  private charts: Highcharts.Chart[] = [];

  constructor(
    private readonly soporte: SoporteService,
    private readonly swal: SwalService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Por defecto: últimos 12 meses.
    const hoy = new Date();
    this.hasta = hoy.toISOString().slice(0, 10);
    const ini = new Date(hoy);
    ini.setDate(1);
    ini.setMonth(ini.getMonth() - 11);
    this.desde = ini.toISOString().slice(0, 10);

    this.cargarSync();
    this.consultar();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
    if (this.poll) clearInterval(this.poll);
  }

  /* ==================== Filtros y datos ==================== */

  consultar(): void {
    if (this.desde && this.hasta && this.desde > this.hasta) {
      this.swal.advertencia('Rango inválido', 'La fecha «Desde» no puede ser mayor que «Hasta».');
      return;
    }
    this.loading = true;
    this.soporte
      .dashboardMantis({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        projectId: this.projectId ?? undefined,
        handlerId: this.handlerId ?? undefined,
        reporterId: this.reporterId ?? undefined,
        statusId: this.statusId ?? undefined,
        excluirStatusIds: this.excluirStatusIds.length ? this.excluirStatusIds : undefined,
        soloAbiertos: this.soloAbiertos || undefined,
        reopened: this.reopened || undefined,
      })
      .subscribe({
        next: (d) => {
          this.data = d;
          this.consultado = true;
          this.loading = false;
          // Los selectores se llenan con la primera carga sin filtrar.
          if (!this.projectId && (d.porProyecto?.length ?? 0)) {
            this.proyectos = d.porProyecto
              .filter((p) => p.proyectoId != null)
              .map((p) => ({ id: p.proyectoId as number, name: p.proyecto }));
          }
          if (!this.handlerId && (d.porUsuario?.length ?? 0)) {
            this.responsables = d.porUsuario
              .filter((u) => u.usuarioId != null)
              .map((u) => ({ id: u.usuarioId as number, name: u.usuario }));
          }
          if (!this.statusId && (d.porEstado?.length ?? 0)) {
            this.estatus = d.porEstado
              .filter((e) => e.estadoId != null)
              .map((e) => ({ id: e.estadoId as number, name: e.estado }));
          }
          if (!this.reporterId && (d.porInformador?.length ?? 0)) {
            this.informadores = d.porInformador
              .filter((u) => u.usuarioId != null)
              .map((u) => ({ id: u.usuarioId as number, name: u.usuario }));
          }
          // La pestaña Casos comparte los filtros: se invalida y, si está
          // activa, se recarga con los parámetros actuales.
          this.casos = [];
          this.casosPage = 0;
          if (this.tab === 'casos') this.cargarCasos();
          setTimeout(() => {
            // Asegura que el *ngIf ya renderizo los contenedores de los graficos.
            this.cdr.detectChanges();
            this.renderCharts();
          }, 0);
        },
        error: (e) => {
          this.loading = false;
          this.swal.error('No se pudo cargar el dashboard', this.msg(e));
        },
      });
  }

  limpiar(): void {
    this.projectId = null;
    this.handlerId = null;
    this.reporterId = null;
    this.statusId = null;
    this.excluirStatusIds = [];
    this.soloAbiertos = false;
    this.reopened = '';
    const hoy = new Date();
    this.hasta = hoy.toISOString().slice(0, 10);
    const ini = new Date(hoy);
    ini.setDate(1);
    ini.setMonth(ini.getMonth() - 11);
    this.desde = ini.toISOString().slice(0, 10);
    this.consultar();
  }

  /** ¿El estatus está marcado para excluir? */
  estaExcluido(id: number): boolean {
    return this.excluirStatusIds.includes(id);
  }

  /** Marca/desmarca un estatus para excluirlo del resultado. */
  toggleExcluir(id: number): void {
    this.excluirStatusIds = this.estaExcluido(id)
      ? this.excluirStatusIds.filter((x) => x !== id)
      : [...this.excluirStatusIds, id];
  }

  /* ==================== Pestañas y listado de casos ==================== */

  cambiarTab(t: 'resumen' | 'casos' | 'seguimiento'): void {
    this.tab = t;
    if (t === 'casos' && !this.casos.length && !this.casosLoading && this.consultado) {
      this.cargarCasos();
    }
  }

  /** Listado filtrable de casos (reporte por usuario/proyecto/estado/rango). */
  cargarCasos(): void {
    this.casosLoading = true;
    this.soporte
      .listarCasosMantis({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        projectId: this.projectId ?? undefined,
        handlerId: this.handlerId ?? undefined,
        reporterId: this.reporterId ?? undefined,
        statusId: this.statusId ?? undefined,
        excluirStatusIds: this.excluirStatusIds.length ? this.excluirStatusIds : undefined,
        soloAbiertos: this.soloAbiertos || undefined,
        reopened: this.reopened || undefined,
        limit: this.casosPageSize,
        offset: this.casosPage * this.casosPageSize,
      })
      .subscribe({
        next: (r) => {
          this.casos = r.casos;
          this.casosTotal = r.total;
          this.casosLoading = false;
        },
        error: (e) => {
          this.casosLoading = false;
          this.swal.error('No se pudo cargar el listado', this.msg(e));
        },
      });
  }

  paginaCasos(delta: number): void {
    const nueva = this.casosPage + delta;
    if (nueva < 0) return;
    if (nueva * this.casosPageSize >= this.casosTotal) return;
    this.casosPage = nueva;
    this.cargarCasos();
  }

  /** Abre la pestaña de seguimiento para un caso concreto. */
  verSeguimiento(id: number): void {
    this.casoSeleccionadoId = id;
    this.tab = 'seguimiento';
  }

  /* ==================== Sincronización del espejo ==================== */

  cargarSync(): void {
    this.soporte.estadoSyncMantis().subscribe({
      next: (s) => {
        this.sync = s;
        this.sincronizando = s.sincronizando;
        if (s.sincronizando) this.iniciarPoll();
      },
      error: () => undefined,
    });
  }

  sincronizar(): void {
    this.soporte.sincronizarMantis().subscribe({
      next: (r) => {
        this.swal.exito('Sincronización', r?.mensaje ?? 'Iniciada en segundo plano.');
        this.sincronizando = true;
        this.iniciarPoll();
      },
      error: (e) => this.swal.error('No se pudo sincronizar', this.msg(e)),
    });
  }

  private iniciarPoll(): void {
    if (this.poll) return;
    this.poll = setInterval(() => {
      this.soporte.estadoSyncMantis().subscribe({
        next: (s) => {
          this.sync = s;
          this.sincronizando = s.sincronizando;
          if (!s.sincronizando) {
            if (this.poll) clearInterval(this.poll);
            this.poll = undefined;
            this.swal.exito('Sincronización', 'El espejo quedó actualizado.');
            this.consultar();
          }
        },
        error: () => {
          if (this.poll) clearInterval(this.poll);
          this.poll = undefined;
          this.sincronizando = false;
        },
      });
    }, 5000);
  }

  /* ==================== Gráficos ==================== */

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private renderCharts(): void {
    this.destroyCharts();
    const refs: Array<{ el?: ElementRef; fn: () => Highcharts.Chart }> = [
      { el: this.chartProyecto, fn: () => this.chartTopProyectos() },
      { el: this.chartEstado, fn: () => this.chartEstados() },
      { el: this.chartUsuario, fn: () => this.chartUsuarios() },
      { el: this.chartMes, fn: () => this.chartRecibidosCerrados() },
      { el: this.chartMttr, fn: () => this.graficoMttr() },
      { el: this.chartTiempos, fn: () => this.graficoTiempos() },
      { el: this.chartAntiguedad, fn: () => this.graficoAntiguedad() },
      { el: this.chartCategoria, fn: () => this.graficoCategoria() },
    ];
    refs.forEach(({ el, fn }) => {
      try {
        if (el) this.charts.push(fn());
      } catch (e) {
        console.warn('Error renderizando gráfico Mantis', e);
      }
    });
  }

  private chartTopProyectos(): Highcharts.Chart {
    const datos = [...(this.data?.porProyecto ?? [])]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .reverse();
    return Highcharts.chart(this.chartProyecto!.nativeElement, {
      chart: { type: 'bar', height: 360 },
      title: { text: 'Casos por proyecto (Top 10)', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d) => d.proyecto), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: 'Casos' }, allowDecimals: false },
      legend: { enabled: false },
      tooltip: { shared: true },
      plotOptions: { bar: { dataLabels: { enabled: true } } },
      series: [
        { type: 'bar', name: 'Abiertos', data: datos.map((d) => d.abiertos), color: '#f59e0b' },
        { type: 'bar', name: 'Cerrados', data: datos.map((d) => d.cerrados), color: '#10b981' },
      ],
      credits: { enabled: false },
    });
  }

  private chartEstados(): Highcharts.Chart {
    const datos = (this.data?.porEstado ?? []).map((e) => ({ name: e.estado, y: e.total }));
    return Highcharts.chart(this.chartEstado!.nativeElement, {
      chart: { type: 'pie', height: 360 },
      title: { text: 'Distribución por estatus', style: { fontSize: '13px' } },
      tooltip: { pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)' },
      plotOptions: {
        pie: {
          innerSize: '45%',
          dataLabels: { enabled: true, format: '{point.name}: {point.y}' },
        },
      },
      series: [{ type: 'pie', name: 'Casos', data: datos }],
      credits: { enabled: false },
    });
  }

  private chartUsuarios(): Highcharts.Chart {
    const datos = [...(this.data?.porUsuarioAbiertos ?? [])].slice(0, 10).reverse();
    return Highcharts.chart(this.chartUsuario!.nativeElement, {
      chart: { type: 'bar', height: 360 },
      title: { text: 'Casos ABIERTOS por usuario (Top 10)', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d) => d.usuario), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: 'Abiertos' }, allowDecimals: false },
      legend: { enabled: false },
      plotOptions: { bar: { colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ type: 'bar', name: 'Abiertos', data: datos.map((d) => d.abiertos) }],
      credits: { enabled: false },
    });
  }

  private chartRecibidosCerrados(): Highcharts.Chart {
    const datos = this.data?.porMes ?? [];
    return Highcharts.chart(this.chartMes!.nativeElement, {
      chart: { type: 'column', height: 360 },
      title: { text: 'Recibidos vs. cerrados por mes', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d) => d.mes), labels: { rotation: -45, style: { fontSize: '9px' } } },
      yAxis: { title: { text: 'Casos' }, allowDecimals: false },
      tooltip: { shared: true },
      plotOptions: { column: { dataLabels: { enabled: false } } },
      series: [
        { type: 'column', name: 'Recibidos', data: datos.map((d) => d.recibidos), color: '#3b82f6' },
        { type: 'column', name: 'Cerrados', data: datos.map((d) => d.cerrados), color: '#10b981' },
      ],
      credits: { enabled: false },
    });
  }

  private graficoMttr(): Highcharts.Chart {
    const datos = this.data?.porMes ?? [];
    return Highcharts.chart(this.chartMttr!.nativeElement, {
      chart: { type: 'spline', height: 360 },
      title: { text: 'Tiempo medio de resolución por mes (días)', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d) => d.mes), labels: { rotation: -45, style: { fontSize: '9px' } } },
      yAxis: { title: { text: 'Días' }, min: 0 },
      legend: { enabled: false },
      tooltip: { valueSuffix: ' días' },
      plotOptions: { spline: { dataLabels: { enabled: true, format: '{y}' }, marker: { enabled: true } } },
      series: [{ type: 'spline', name: 'MTTR', data: datos.map((d) => d.mttrDias) }],
      credits: { enabled: false },
    });
  }

  private graficoTiempos(): Highcharts.Chart {
    const t = this.data?.tiempos;
    return Highcharts.chart(this.chartTiempos!.nativeElement, {
      chart: { type: 'column', height: 320 },
      title: { text: 'Tiempos por etapa (días)', style: { fontSize: '13px' } },
      xAxis: { categories: ['Primera respuesta', 'Resolución', 'Cierre'] },
      yAxis: { title: { text: 'Días' }, min: 0 },
      tooltip: { shared: true, valueSuffix: ' días' },
      plotOptions: { column: { dataLabels: { enabled: true, format: '{y}' } } },
      series: [
        {
          type: 'column',
          name: 'Promedio',
          data: [
            t?.primeraRespuesta?.promedioDias ?? 0,
            t?.resolucion?.promedioDias ?? 0,
            t?.cierre?.promedioDias ?? 0,
          ],
          color: '#3b82f6',
        },
        {
          type: 'column',
          name: 'Mediana',
          data: [
            t?.primeraRespuesta?.medianaDias ?? 0,
            t?.resolucion?.medianaDias ?? 0,
            t?.cierre?.medianaDias ?? 0,
          ],
          color: '#f59e0b',
        },
      ],
      credits: { enabled: false },
    });
  }

  private graficoCategoria(): Highcharts.Chart {
    const datos = [...(this.data?.porCategoria ?? [])].slice(0, 12).reverse();
    return Highcharts.chart(this.chartCategoria!.nativeElement, {
      chart: { type: 'bar', height: 360 },
      title: { text: 'Top categorías de incidencia', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d) => d.categoria), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: 'Casos' }, allowDecimals: false },
      legend: { enabled: false },
      plotOptions: { bar: { colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ type: 'bar', name: 'Casos', data: datos.map((d) => d.total) }],
      credits: { enabled: false },
    });
  }

  private graficoAntiguedad(): Highcharts.Chart {
    const datos = this.data?.antiguedad ?? [];
    return Highcharts.chart(this.chartAntiguedad!.nativeElement, {
      chart: { type: 'column', height: 320 },
      title: { text: 'Backlog abierto por antigüedad', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d) => d.rango) },
      yAxis: { title: { text: 'Casos abiertos' }, allowDecimals: false },
      legend: { enabled: false },
      plotOptions: { column: { colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ type: 'column', name: 'Abiertos', data: datos.map((d) => d.total) }],
      credits: { enabled: false },
    });
  }

  /** Descarga el CSV: `casos` (detalle) o `resumen` (KPIs). */
  exportar(tipo: 'casos' | 'resumen' = 'casos'): void {
    this.soporte
      .exportarMantis(
        {
          desde: this.desde || undefined,
          hasta: this.hasta || undefined,
          projectId: this.projectId ?? undefined,
          handlerId: this.handlerId ?? undefined,
          reporterId: this.reporterId ?? undefined,
          statusId: this.statusId ?? undefined,
          excluirStatusIds: this.excluirStatusIds.length ? this.excluirStatusIds : undefined,
          soloAbiertos: this.soloAbiertos || undefined,
          reopened: this.reopened || undefined,
        },
        tipo,
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mantis-${tipo}_${this.desde}_${this.hasta}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: (e) => this.swal.error('No se pudo exportar el CSV', this.msg(e)),
      });
  }

  /** Genera y abre el reporte PDF de casos (según el contenido elegido). */
  exportarPdf(): void {
    this.swal.cargando('Generando reporte PDF...');
    this.soporte
      .reportePdfMantis({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        projectId: this.projectId ?? undefined,
        handlerId: this.handlerId ?? undefined,
        reporterId: this.reporterId ?? undefined,
        statusId: this.statusId ?? undefined,
        excluirStatusIds: this.excluirStatusIds.length ? this.excluirStatusIds : undefined,
        soloAbiertos: this.soloAbiertos || undefined,
        reopened: this.reopened || undefined,
        conDetalle: this.conDetalle,
      })
      .subscribe({
        next: (blob) => {
          this.swal.cerrar();
          abrirPdf(blob, `mantis-reporte_${this.desde}_${this.hasta}.pdf`);
        },
        error: (e) => {
          this.swal.cerrar();
          this.swal.error('No se pudo generar el PDF', this.msg(e));
        },
      });
  }

  /** Envía por correo el reporte PDF de casos + comentarios. */
  enviarPdfPorCorreo(): void {
    const destinatario = window.prompt(
      'Correo destinatario del reporte (vacío = correo configurado en el servidor):',
      '',
    );
    if (destinatario === null) return;
    this.swal.cargando('Generando y enviando reporte...');
    this.soporte
      .enviarReportePdfMantis({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        projectId: this.projectId ?? undefined,
        handlerId: this.handlerId ?? undefined,
        reporterId: this.reporterId ?? undefined,
        statusId: this.statusId ?? undefined,
        excluirStatusIds: this.excluirStatusIds.length ? this.excluirStatusIds : undefined,
        soloAbiertos: this.soloAbiertos || undefined,
        reopened: this.reopened || undefined,
        conDetalle: this.conDetalle,
        destinatario: (destinatario || '').trim() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.swal.cerrar();
          const nota = r?.simulado ? ' (SMTP no configurado: no se envió)' : '';
          this.swal.exito('Reporte enviado', `Enviado a ${r?.destinatario ?? 'soporte'}${nota}.`);
        },
        error: (e) => {
          this.swal.cerrar();
          this.swal.error('No se pudo enviar el reporte', this.msg(e));
        },
      });
  }

  /** Envía por correo la alerta de casos estancados. */
  alertar(): void {
    const total = this.data?.estancados?.total ?? 0;
    if (!total) {
      this.swal.advertencia('Sin casos estancados', 'No hay casos estancados en el rango seleccionado.');
      return;
    }
    this.alertando = true;
    this.soporte
      .alertaEstancados({
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        projectId: this.projectId ?? undefined,
        handlerId: this.handlerId ?? undefined,
      })
      .subscribe({
        next: (r) => {
          this.alertando = false;
          const nota = r?.simulado ? ' (SMTP no configurado: no se envió)' : '';
          this.swal.exito(
            'Alerta enviada',
            `${r?.total ?? total} caso(s) reportados a ${r?.destinatario ?? 'soporte'}${nota}.`,
          );
        },
        error: (e) => {
          this.alertando = false;
          this.swal.error('No se pudo enviar la alerta', this.msg(e));
        },
      });
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
