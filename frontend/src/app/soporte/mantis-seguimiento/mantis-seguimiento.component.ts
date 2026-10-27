import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import Highcharts from 'highcharts';
import { MantisSeguimiento, SoporteService } from '../services/soporte.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-mantis-seguimiento',
  standalone: false,
  templateUrl: './mantis-seguimiento.component.html',
})
export class MantisSeguimientoComponent implements OnInit, OnChanges, OnDestroy {
  @Input() issueId: number | null = null;

  busquedaId: number | null = null;
  cargando = false;
  error: string | null = null;
  caso: MantisSeguimiento | null = null;

  @ViewChild('chartHitos') chartHitos?: ElementRef;
  @ViewChild('chartDuracion') chartDuracion?: ElementRef;
  private charts: Highcharts.Chart[] = [];

  constructor(
    private readonly soporte: SoporteService,
    private readonly swal: SwalService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.issueId) this.cargar(this.issueId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['issueId'] && this.issueId) this.cargar(this.issueId);
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
  }

  buscar(): void {
    const id = Number(this.busquedaId);
    if (!id || id <= 0) {
      this.swal.advertencia('Caso inválido', 'Ingrese un ID de incidencia de Mantis válido.');
      return;
    }
    this.cargar(id);
  }

  private cargar(id: number): void {
    this.cargando = true;
    this.error = null;
    this.caso = null;
    this.soporte.seguimientoCaso(id).subscribe({
      next: (c) => {
        this.caso = c;
        this.cargando = false;
        this.cdr.detectChanges();
        setTimeout(() => this.renderCharts(), 0);
      },
      error: (e) => {
        this.cargando = false;
        this.error = e?.error?.message || e?.message || 'No se pudo consultar el caso.';
      },
    });
  }

  private renderCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    if (!this.caso) return;

    const timeline = this.caso.timeline ?? [];
    const hitos = timeline.map((t) => ({
      x: t.inicio ? new Date(t.inicio).getTime() : Date.now(),
      y: 0,
      name: t.estado,
      informador: t.informador,
      responsable: t.responsable,
      duracion: t.duracionDias,
    }));

    if (this.chartHitos?.nativeElement) {
      this.charts.push(
        Highcharts.chart(this.chartHitos.nativeElement, {
          chart: { type: 'scatter', height: 230 },
          title: { text: 'Hitos del caso (cambios de estado)', style: { fontSize: '13px' } },
          xAxis: { type: 'datetime', title: { text: 'Fecha' }, tickPixelInterval: 90 },
          yAxis: { visible: false, min: -1, max: 1 },
          legend: { enabled: false },
          tooltip: {
            formatter: function (this: any) {
              return (
                `<b>${this.name}</b><br>` +
                `${Highcharts.dateFormat('%d/%m/%Y %H:%M', this.x)}<br>` +
                `Informador: ${this.informador ?? '—'}<br>` +
                `Responsable: ${this.responsable ?? '—'}<br>` +
                `Duración de la etapa: ${this.duracion} d`
              );
            },
          },
          plotOptions: {
            scatter: {
              marker: { radius: 6, fillColor: '#2563eb', lineColor: '#1e40af', lineWidth: 1 },
              dataLabels: {
                enabled: true,
                formatter: function (this: any) {
                  return this.name;
                },
                style: { fontSize: '10px', color: '#1e293b', textOutline: 'none' },
              },
            },
          },
          series: [{ type: 'scatter', data: hitos as any, color: '#2563eb' }],
          credits: { enabled: false },
        }),
      );
    }

    const etapas = timeline.map((t) => `${t.etapa}. ${t.estado}`);
    const duraciones = timeline.map((t) => t.duracionDias);
    if (this.chartDuracion?.nativeElement) {
      this.charts.push(
        Highcharts.chart(this.chartDuracion.nativeElement, {
          chart: { type: 'bar', height: Math.max(220, etapas.length * 34) },
          title: { text: 'Duración por etapa (días)', style: { fontSize: '13px' } },
          xAxis: { categories: etapas, labels: { style: { fontSize: '10px' } } },
          yAxis: { title: { text: 'Días' }, min: 0 },
          legend: { enabled: false },
          tooltip: { valueSuffix: ' días' },
          plotOptions: {
            bar: { dataLabels: { enabled: true, format: '{y}' }, color: '#10b981' },
          },
          series: [{ type: 'bar', data: duraciones, color: '#10b981' }],
          credits: { enabled: false },
        }),
      );
    }
  }
}
