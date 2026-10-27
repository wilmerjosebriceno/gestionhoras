import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import Highcharts from 'highcharts';
import { GpiService } from '../services/gpi.service';
import { SwalService } from '../../core/services/swal.service';

const ETIQUETA: Record<string, string> = {
  planificado: 'Planificado',
  en_ejecucion: 'En ejecución',
  en_pausa: 'En pausa',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  bloqueada: 'Bloqueada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

@Component({
  selector: 'app-gpi-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
})
export class GpiDashboardComponent implements OnInit, OnDestroy {
  cargando = false;
  data: any = null;

  @ViewChild('chartEstado') chartEstado?: ElementRef;
  @ViewChild('chartRecurso') chartRecurso?: ElementRef;
  @ViewChild('chartAvance') chartAvance?: ElementRef;
  @ViewChild('chartHoras') chartHoras?: ElementRef;
  private charts: Highcharts.Chart[] = [];

  constructor(
    private readonly gpi: GpiService,
    private readonly swal: SwalService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.dashboard().subscribe({
      next: (d) => {
        this.data = d;
        this.cargando = false;
        this.cdr.detectChanges();
        this.render();
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar el dashboard', this.msg(e));
      },
    });
  }

  private render(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    const refs: Array<{ el?: ElementRef; fn: () => Highcharts.Chart }> = [
      { el: this.chartEstado, fn: () => this.graficoEstado() },
      { el: this.chartRecurso, fn: () => this.graficoRecurso() },
      { el: this.chartAvance, fn: () => this.graficoAvance() },
      { el: this.chartHoras, fn: () => this.graficoHoras() },
    ];
    refs.forEach(({ el, fn }) => {
      try {
        if (el) this.charts.push(fn());
      } catch (e) {
        console.warn('Error renderizando gráfico GPI', e);
      }
    });
  }

  private graficoEstado(): Highcharts.Chart {
    const datos = (this.data?.porEstado ?? []).map((e: any) => ({ name: ETIQUETA[e.estado] || e.estado, y: e.total }));
    return Highcharts.chart(this.chartEstado!.nativeElement, {
      chart: { type: 'pie', height: 320 },
      title: { text: 'Proyectos por estado', style: { fontSize: '13px' } },
      tooltip: { pointFormat: '<b>{point.y}</b> ({point.percentage:.0f}%)' },
      plotOptions: { pie: { innerSize: '45%', dataLabels: { enabled: true, format: '{point.name}: {point.y}' } } },
      series: [{ type: 'pie', name: 'Proyectos', data: datos }],
      credits: { enabled: false },
    });
  }

  private graficoRecurso(): Highcharts.Chart {
    const datos = [...(this.data?.porRecurso ?? [])].filter((r: any) => Number(r.horas) > 0).slice(0, 10).reverse();
    return Highcharts.chart(this.chartRecurso!.nativeElement, {
      chart: { type: 'bar', height: 320 },
      title: { text: 'Horas asignadas por recurso (Top 10)', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d: any) => d.recurso), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: 'Horas' } },
      legend: { enabled: false },
      plotOptions: { bar: { colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ type: 'bar', name: 'Horas', data: datos.map((d: any) => Number(d.horas)) }],
      credits: { enabled: false },
    });
  }

  private graficoAvance(): Highcharts.Chart {
    const datos = [...(this.data?.proyectos ?? [])].sort((a: any, b: any) => Number(b.avance_pct) - Number(a.avance_pct)).slice(0, 10);
    return Highcharts.chart(this.chartAvance!.nativeElement, {
      chart: { type: 'bar', height: 320 },
      title: { text: 'Avance por proyecto (%)', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d: any) => d.codigo), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: '%' }, max: 100 },
      legend: { enabled: false },
      plotOptions: { bar: { colorByPoint: true, dataLabels: { enabled: true, format: '{y}%' } } },
      series: [{ type: 'bar', name: 'Avance', data: datos.map((d: any) => Number(d.avance_pct)) }],
      credits: { enabled: false },
    });
  }

  private graficoHoras(): Highcharts.Chart {
    const datos = [...(this.data?.proyectos ?? [])].slice(0, 12);
    return Highcharts.chart(this.chartHoras!.nativeElement, {
      chart: { type: 'column', height: 320 },
      title: { text: 'Horas estimadas vs. reales por proyecto', style: { fontSize: '13px' } },
      xAxis: { categories: datos.map((d: any) => d.codigo), labels: { rotation: -45, style: { fontSize: '9px' } } },
      yAxis: { title: { text: 'Horas' } },
      tooltip: { shared: true },
      series: [
        { type: 'column', name: 'Estimadas', data: datos.map((d: any) => Number(d.horas_estimadas)), color: '#3b82f6' },
        { type: 'column', name: 'Reales', data: datos.map((d: any) => Number(d.horas_reales)), color: '#10b981' },
      ],
      credits: { enabled: false },
    });
  }

  etiquetaEstado(e: string): string {
    return ETIQUETA[e] || e;
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
