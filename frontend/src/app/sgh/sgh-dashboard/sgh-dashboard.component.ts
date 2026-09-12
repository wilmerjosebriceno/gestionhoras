import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import Highcharts from 'highcharts';
import { SghService } from '../services/sgh.service';

@Component({
  selector: 'app-sgh-dashboard',
  standalone: false,
  templateUrl: './sgh-dashboard.component.html',
})
export class SghDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  loading = true;
  resumen: { totalActividades: number; totalProyectos: number; totalHoras: number; totalFases: number } = {
    totalActividades: 0,
    totalProyectos: 0,
    totalHoras: 0,
    totalFases: 0,
  };
  clientesAnio: any[] = [];
  usuariosAnio: any[] = [];
  proyectosChart: any[] = [];

  @ViewChild('chartClientes') chartClientes?: ElementRef;
  @ViewChild('chartUsuarios') chartUsuarios?: ElementRef;
  @ViewChild('chartProyectos') chartProyectos?: ElementRef;

  private charts: Highcharts.Chart[] = [];

  constructor(private service: SghService) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  cargar(): void {
    this.loading = true;
    forkJoin({
      resumen: this.service.dashboardResumen(),
      clientes: this.service.dashboardClientesAnio(),
      usuarios: this.service.dashboardUsuariosAnio(),
      proyectos: this.service.dashboardProyectos(),
    }).subscribe({
      next: (r) => {
        this.resumen = r.resumen;
        this.clientesAnio = r.clientes ?? [];
        this.usuariosAnio = r.usuarios ?? [];
        this.proyectosChart = r.proyectos ?? [];
        this.loading = false;
        // Los contenedores estan bajo *ngIf: renderizar luego de que Angular
        // actualice el DOM (ViewChild refs listos).
        setTimeout(() => this.renderCharts(), 0);
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  formatoNumero(n: number | null | undefined): string {
    return (n ?? 0).toLocaleString('es-VE', { maximumFractionDigits: 2 });
  }

  pctPlan(proyecto: any): number {
    const plan = Number(proyecto.hour || 0);
    const ejec = Number(proyecto.hour_e || 0);
    if (plan === 0) return 0;
    return Math.round((ejec / plan) * 100);
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private renderCharts(): void {
    this.destroyCharts();
    const refs: Array<{ el?: ElementRef; fn: () => Highcharts.Chart }> = [
      { el: this.chartClientes, fn: () => this.renderClientes() },
      { el: this.chartUsuarios, fn: () => this.renderUsuarios() },
      { el: this.chartProyectos, fn: () => this.renderProyectos() },
    ];
    refs.forEach(({ el, fn }) => {
      try {
        if (el) this.charts.push(fn());
      } catch (e) {
        console.warn('Error renderizando gráfico SGH', e);
      }
    });
  }

  /** Horas por cliente (año actual) — barras horizontales Top 10. */
  private renderClientes(): Highcharts.Chart {
    const top = [...this.clientesAnio]
      .sort((a, b) => Number(b.hours) - Number(a.hours))
      .slice(0, 10);
    const categorias = top.map((c) => c.name ?? 'Sin cliente');
    return Highcharts.chart(this.chartClientes!.nativeElement, {
      chart: { type: 'bar', height: 320 },
      title: { text: 'Horas por Cliente (año actual)', style: { fontSize: '13px' } },
      xAxis: {
        categories: categorias,
        title: { text: null },
        labels: { style: { fontSize: '10px' } },
      },
      yAxis: { title: { text: 'Horas' } },
      legend: { enabled: false },
      tooltip: {
        useHTML: true,
        pointFormat: '<b>{point.y:,.2f}</b> horas<br/><b>{point.actividades}</b> actividades',
      },
      plotOptions: {
        bar: { colorByPoint: true, dataLabels: { enabled: true, format: '{y:,.1f}' } },
      },
      series: [
        {
          name: 'Horas',
          data: top.map((c) => ({
            y: Number(c.hours) || 0,
            actividades: c._activity ?? c.actividades ?? 0,
          })),
        },
      ],
      credits: { enabled: false },
    });
  }

  /** Horas por consultor (año actual) — columnas + línea de módulos. */
  private renderUsuarios(): Highcharts.Chart {
    const top = [...this.usuariosAnio]
      .sort((a, b) => Number(b.hours) - Number(a.hours))
      .slice(0, 12);
    const categorias = top.map((u) => u.nameUser ?? '—');
    return Highcharts.chart(this.chartUsuarios!.nativeElement, {
      chart: { type: 'column', height: 320 },
      title: { text: 'Horas por Consultor (año actual)', style: { fontSize: '13px' } },
      xAxis: { categories: categorias, labels: { style: { fontSize: '10px' }, rotation: -35 } },
      yAxis: [
        { title: { text: 'Horas' } },
        { title: { text: 'Módulos' }, opposite: true, allowDecimals: false },
      ],
      tooltip: { shared: true },
      series: [
        { name: 'Horas', type: 'column', data: top.map((u) => Number(u.hours) || 0), color: '#1e40af' },
        {
          name: 'Módulos',
          type: 'spline',
          yAxis: 1,
          data: top.map((u) => Number(u.modulos) || 0),
          color: '#f59e0b',
        },
      ],
      credits: { enabled: false },
    });
  }

  /** Horas plan vs ejecutadas por proyecto — columnas + línea de avance %. */
  private renderProyectos(): Highcharts.Chart {
    const datos = [...this.proyectosChart];
    const categorias = datos.map((p) => `#${p.idProyect} ${p.name ?? ''}`.trim());
    const plan = datos.map((p) => Number(p.hour) || 0);
    const ejec = datos.map((p) => Number(p.hour_e) || 0);
    const avance = datos.map((p) => this.pctPlan(p));
    return Highcharts.chart(this.chartProyectos!.nativeElement, {
      chart: { type: 'column', height: 340 },
      title: { text: 'Horas Plan vs Ejecutadas por Proyecto', style: { fontSize: '13px' } },
      xAxis: { categories: categorias, labels: { style: { fontSize: '9px' }, rotation: -40 } },
      yAxis: [
        { title: { text: 'Horas' } },
        {
          title: { text: 'Avance (%)' },
          opposite: true,
          max: 120,
          labels: { format: '{value}%' },
        },
      ],
      tooltip: { shared: true },
      series: [
        { name: 'Horas plan', type: 'column', data: plan, color: '#93c5fd' },
        { name: 'Horas ejecutadas', type: 'column', data: ejec, color: '#1e40af' },
        {
          name: 'Avance %',
          type: 'spline',
          yAxis: 1,
          data: avance,
          color: '#16a34a',
          tooltip: { valueSuffix: '%' },
        },
      ],
      credits: { enabled: false },
    });
  }
}
