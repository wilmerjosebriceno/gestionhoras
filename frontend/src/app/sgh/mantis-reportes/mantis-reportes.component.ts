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
import { MantisService, MantisIssueView, MantisResumen } from '../services/mantis.service';
import { SwalService } from '../../core/services/swal.service';

type Tab = 'tabla' | 'dashboard' | 'ia';

@Component({
  selector: 'app-mantis-reportes',
  standalone: false,
  templateUrl: './mantis-reportes.component.html',
})
export class MantisReportesComponent implements OnInit, AfterViewInit, OnDestroy {
  proyectos: { id: number; name: string }[] = [];
  usuarios: { id: number; name: string; real_name?: string }[] = [];
  estatus: { id: string; name: string }[] = [];

  proyectoId?: number;
  statusId?: number;
  reporterId?: number;
  handlerId?: number;
  texto = '';
  desde = '';
  hasta = '';

  tab: Tab = 'tabla';
  loading = false;
  cargandoFiltros = false;
  consultado = false;
  issues: MantisIssueView[] = [];
  resumen: MantisResumen | null = null;

  analizando = false;
  analisisTexto = '';

  @ViewChild('chartEstado') chartEstado?: ElementRef;
  @ViewChild('chartProyecto') chartProyecto?: ElementRef;
  @ViewChild('chartAsignado') chartAsignado?: ElementRef;
  @ViewChild('chartMes') chartMes?: ElementRef;
  private charts: Highcharts.Chart[] = [];

  constructor(
    private readonly mantis: MantisService,
    private readonly swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.cargarFiltros();
  }

  ngAfterViewInit(): void {
    if (this.tab === 'dashboard') this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private cargarFiltros(): void {
    this.cargandoFiltros = true;
    this.mantis.filtros().subscribe({
      next: (f) => {
        this.proyectos = f.proyectos ?? [];
        this.usuarios = f.usuarios ?? [];
        this.estatus = f.estatus ?? [];
        this.cargandoFiltros = false;
        // Filtros precargados desde Mantis. El usuario pulsa "Consultar" para ejecutar.
      },
      error: (e) => {
        this.cargandoFiltros = false;
        this.swal.error('Error al cargar catálogos de Mantis', this.msg(e));
      },
    });
  }

  private dto(): any {
    const d: any = {};
    if (this.proyectoId != null) d.projectId = Number(this.proyectoId);
    if (this.statusId != null) d.statusId = Number(this.statusId);
    if (this.reporterId != null) d.reporterId = Number(this.reporterId);
    if (this.handlerId != null) d.handlerId = Number(this.handlerId);
    if (this.texto?.trim()) d.texto = this.texto.trim();
    if (this.desde) d.desde = this.desde;
    if (this.hasta) d.hasta = this.hasta;
    return d;
  }

  consultar(): void {
    this.loading = true;
    this.consultado = false;
    const d = this.dto();
    forkJoin({
      data: this.mantis.consultar(d),
      res: this.mantis.resumen(d),
    }).subscribe({
      next: ({ data, res }) => {
        this.issues = data.issues ?? [];
        this.resumen = res;
        this.consultado = true;
        this.loading = false;
        if (this.tab === 'dashboard') setTimeout(() => this.renderCharts(), 0);
      },
      error: (e) => {
        this.loading = false;
        this.swal.error('Error al consultar Mantis', this.msg(e));
      },
    });
  }

  limpiar(): void {
    this.proyectoId = undefined;
    this.statusId = undefined;
    this.reporterId = undefined;
    this.handlerId = undefined;
    this.texto = '';
    this.desde = '';
    this.hasta = '';
    this.consultar();
  }

  cambiarTab(t: Tab): void {
    this.tab = t;
    if (t === 'dashboard') setTimeout(() => this.renderCharts(), 0);
  }

  analizar(): void {
    this.analizando = true;
    this.analisisTexto = '';
    this.tab = 'ia';
    this.mantis.analizar(this.dto()).subscribe({
      next: (r) => {
        this.analisisTexto = r.texto;
        this.analizando = false;
      },
      error: (e) => {
        this.analizando = false;
        this.analisisTexto = 'Error: ' + this.msg(e);
      },
    });
  }

  exportarCsv(): void {
    if (!this.issues.length) {
      this.swal.advertencia('Exportar', 'No hay datos para exportar.');
      return;
    }
    const headers = [
      'ID',
      'Resumen',
      'Proyecto',
      'Informador',
      'Asignado',
      'Estado',
      'Prioridad',
      'Severidad',
      'Fecha',
    ];
    const rows = this.issues.map((i) => [
      i.id,
      i.summary,
      i.project,
      i.reporter,
      i.handler,
      i.status,
      i.priority,
      i.severity,
      i.dateSubmitted,
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mantis-reportes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private renderCharts(): void {
    this.destroyCharts();
    const refs: Array<{ el?: ElementRef; fn: () => Highcharts.Chart }> = [
      { el: this.chartEstado, fn: () => this.renderEstado() },
      { el: this.chartProyecto, fn: () => this.renderProyecto() },
      { el: this.chartAsignado, fn: () => this.renderAsignado() },
      { el: this.chartMes, fn: () => this.renderMes() },
    ];
    refs.forEach(({ el, fn }) => {
      try {
        if (el) this.charts.push(fn());
      } catch (e) {
        console.warn('Error renderizando gráfico Mantis', e);
      }
    });
  }

  private renderEstado(): Highcharts.Chart {
    const data = this.resumen?.porEstado ?? [];
    return Highcharts.chart(this.chartEstado!.nativeElement, {
      chart: { type: 'pie', height: 320 },
      title: { text: 'Incidencias por Estado', style: { fontSize: '13px' } },
      tooltip: { pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)' },
      plotOptions: {
        pie: { dataLabels: { enabled: true, format: '{point.name}: {point.y}' } },
      },
      series: [
        {
          type: 'pie',
          name: 'Incidencias',
          data: data.map((d) => ({ name: d.nombre, y: d.total })),
        },
      ],
      credits: { enabled: false },
    });
  }

  private renderProyecto(): Highcharts.Chart {
    const data = this.resumen?.porProyecto ?? [];
    return Highcharts.chart(this.chartProyecto!.nativeElement, {
      chart: { type: 'bar', height: 320 },
      title: { text: 'Top Proyectos', style: { fontSize: '13px' } },
      xAxis: { categories: data.map((d) => d.nombre), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: 'Incidencias' } },
      legend: { enabled: false },
      plotOptions: { bar: { colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ type: 'bar', name: 'Incidencias', data: data.map((d) => d.total) }],
      credits: { enabled: false },
    });
  }

  private renderAsignado(): Highcharts.Chart {
    const data = this.resumen?.porAsignado ?? [];
    return Highcharts.chart(this.chartAsignado!.nativeElement, {
      chart: { type: 'column', height: 320 },
      title: { text: 'Top Asignados', style: { fontSize: '13px' } },
      xAxis: { categories: data.map((d) => d.nombre), labels: { style: { fontSize: '10px' }, rotation: -35 } },
      yAxis: { title: { text: 'Incidencias' } },
      legend: { enabled: false },
      plotOptions: { column: { colorByPoint: true, dataLabels: { enabled: true } } },
      series: [{ type: 'column', name: 'Incidencias', data: data.map((d) => d.total) }],
      credits: { enabled: false },
    });
  }

  private renderMes(): Highcharts.Chart {
    const data = this.resumen?.porMes ?? [];
    return Highcharts.chart(this.chartMes!.nativeElement, {
      chart: { type: 'spline', height: 320 },
      title: { text: 'Tendencia por Mes', style: { fontSize: '13px' } },
      xAxis: { categories: data.map((d) => d.mes), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: 'Incidencias' } },
      legend: { enabled: false },
      plotOptions: { spline: { dataLabels: { enabled: true } } },
      series: [{ type: 'spline', name: 'Incidencias', data: data.map((d) => d.total) }],
      credits: { enabled: false },
    });
  }
}
