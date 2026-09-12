import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import Highcharts from 'highcharts';
import { CotizacionesService } from '../services/cotizaciones.service';
import { CotVencimientoAlertService } from '../services/cot-vencimiento-alert.service';
import { CotClient, CotEmpresa } from '../models/cotizacion.model';
import { ESTADOS_BUDGET } from '../models/cotizacion.model';

const COLOR_ESTADO: Record<number, string> = {
  0: '#9ca3af',
  1: '#f59e0b',
  2: '#16a34a',
  3: '#dc2626',
  4: '#6b7280',
};

@Component({
  selector: 'app-dashboard-kpis',
  standalone: false,
  templateUrl: './dashboard-kpis.component.html',
})
export class DashboardKpisComponent implements OnInit, AfterViewInit, OnDestroy {
  kpis: any = null;
  loading = false;
  clientes: CotClient[] = [];
  empresas: CotEmpresa[] = [];
  estados = ESTADOS_BUDGET;
  venc: { totalVencidas: number; totalPorVencer: number } | null = null;

  // Filtros
  filters: { de: string; hasta: string; idEmpresa?: number; idClient?: number } = { de: '', hasta: '' };

  @ViewChild('chartEstado') chartEstado?: ElementRef;
  @ViewChild('chartDivisa') chartDivisa?: ElementRef;
  @ViewChild('chartRegion') chartRegion?: ElementRef;
  @ViewChild('chartClientes') chartClientes?: ElementRef;
  @ViewChild('chartPlantillas') chartPlantillas?: ElementRef;

  private charts: Highcharts.Chart[] = [];

  constructor(
    private service: CotizacionesService,
    private alertaVencimiento: CotVencimientoAlertService,
  ) {}

  ngOnInit(): void {
    this.service.listarClientes().subscribe((c) => (this.clientes = c));
    this.service.listarEmpresas().subscribe((e) => (this.empresas = e));
    this.service.listarVencidas().subscribe((r) => (this.venc = r));
    this.alertaVencimiento.mostrarSiAplica();
    this.cargar();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.charts.forEach((ch) => ch.destroy());
    this.charts = [];
  }

  cargar(): void {
    this.loading = true;
    this.service.getKpis(this.filters).subscribe({
      next: (k) => {
        this.kpis = k;
        this.loading = false;
        // Los contenedores de los graficos estan dentro de *ngIf: renderizarlos
        // despues de que Angular actualice el DOM (ViewChild refs listos).
        setTimeout(() => this.renderCharts(), 0);
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  limpiar(): void {
    this.filters = { de: '', hasta: '' };
    this.cargar();
  }

  private str(v: any): string {
    return `${v}`;
  }

  private destroyCharts(): void {
    this.charts.forEach((ch) => ch.destroy());
    this.charts = [];
  }

  private renderCharts(): void {
    if (!this.kpis) return;
    this.destroyCharts();
    const refs: Array<{ el?: ElementRef; fn: () => Highcharts.Chart }> = [
      { el: this.chartEstado, fn: () => this.renderEstado() },
      { el: this.chartDivisa, fn: () => this.renderDivisa() },
      { el: this.chartRegion, fn: () => this.renderRegion() },
      { el: this.chartClientes, fn: () => this.renderClientes() },
      { el: this.chartPlantillas, fn: () => this.renderPlantillas() },
    ];
    refs.forEach(({ el, fn }) => {
      try {
        if (el) this.charts.push(fn());
      } catch (e) {
        console.warn('Error renderizando gráfico', e);
      }
    });
  }

  private moneda(v: any): string {
    return 'Bs. ' + Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private usd(v: any): string {
    return '$ ' + Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private renderEstado(): Highcharts.Chart {
    const data = (this.kpis.porEstado || []).map((r: any) => ({
      name: this.estados[Number(r.status)] || `Estado ${r.status}`,
      y: Number(r.cantidad),
      monto: Number(r.monto),
      color: COLOR_ESTADO[Number(r.status)] || '#6366f1',
    }));
    return Highcharts.chart(this.chartEstado!.nativeElement, {
      chart: { type: 'pie', height: 280 },
      title: { text: 'Distribución por Estado', style: { fontSize: '13px' } },
      tooltip: { pointFormat: '<b>{point.y}</b> cotizaciones · {point.monto:.2f} Bs' },
      plotOptions: { pie: { allowPointSelect: true, cursor: 'pointer', dataLabels: { enabled: false }, showInLegend: true } },
      series: [{ name: 'Estados', colorByPoint: true, data }],
      credits: { enabled: false },
    });
  }

  private renderDivisa(): Highcharts.Chart {
    const meses = (this.kpis.tendencia || []).map((r: any) => this.str(r.mes));
    const montoBs = (this.kpis.tendencia || []).map((r: any) => Number(r.monto));
    const montosUsd = (this.kpis.tendencia || []).map((r: any) => Number(r.montoUsd));
    const acumuladoBs = meses.map((_: any, i: number) => montoBs.slice(0, i + 1).reduce((a: number, b: number) => a + b, 0));
    return Highcharts.chart(this.chartDivisa!.nativeElement, {
      chart: { type: 'column', height: 280 },
      title: { text: 'Montos en Divisa (Mensual)', style: { fontSize: '13px' } },
      xAxis: { categories: meses, title: { text: null } },
      yAxis: [
        { title: { text: 'Bs.' }, labels: { format: 'Bs {value}' } },
        { title: { text: 'USD' }, opposite: true, labels: { format: '${value}' } },
      ],
      tooltip: { shared: true },
      series: [
        { name: 'Monto (Bs)', data: montoBs },
        { name: 'Monto (USD)', type: 'spline', yAxis: 1, data: montosUsd },
        { name: 'Acumulado (Bs)', type: 'spline', data: acumuladoBs, color: '#0ea5e9' },
      ],
      credits: { enabled: false },
    });
  }

  private renderRegion(): Highcharts.Chart {
    const datos = [...(this.kpis.porRegion || [])];
    const categorias = datos.map((r: any) => r.region || 'Sin región');
    const montos = datos.map((r: any) => Number(r.monto));
    const horas = datos.map((r: any) => Number(r.horas));
    const cotizaciones = datos.map((r: any) => Number(r.cotizaciones));
    return Highcharts.chart(this.chartRegion!.nativeElement, {
      chart: { type: 'column', height: 280 },
      title: { text: 'Montos por Región', style: { fontSize: '13px' } },
      xAxis: { categories: categorias, labels: { style: { fontSize: '10px' } } },
      yAxis: [{ title: { text: 'Bs.' }, labels: { format: 'Bs {value}' } },
              { title: { text: 'Horas' }, opposite: true }],
      tooltip: { shared: true },
      series: [
        { name: 'Monto (Bs)', data: montos, color: '#1e40af' },
        { name: 'Horas', type: 'spline', yAxis: 1, data: horas, color: '#f59e0b' },
        { name: 'Cotizaciones', data: cotizaciones, color: '#34d399' },
      ],
      credits: { enabled: false },
    });
  }

  private renderClientes(): Highcharts.Chart {
    const datos = [...(this.kpis.topClientes || [])];
    const categorias = datos.map((c: any) => c.cliente || 'Sin cliente');
    const cantidades = datos.map((c: any) => Number(c.cantidad));
    const montos = datos.map((c: any) => Number(c.monto));
    return Highcharts.chart(this.chartClientes!.nativeElement, {
      chart: { type: 'bar', height: 280 },
      title: { text: 'Top Clientes por Cotizaciones', style: { fontSize: '13px' } },
      xAxis: { categories: categorias, title: { text: null }, labels: { style: { fontSize: '10px' } } },
      yAxis: [{ title: { text: 'Cotizaciones' }, allowDecimals: false },
              { title: { text: 'Monto' }, opposite: true }],
      tooltip: { shared: true },
      series: [
        { name: 'Cotizaciones', data: cantidades },
        { name: 'Monto (Bs)', type: 'bar', yAxis: 1, data: montos, color: '#34d399' },
      ],
      credits: { enabled: false },
    });
  }

  private renderPlantillas(): Highcharts.Chart {
    const datos = [...(this.kpis.topPlantillas || [])];
    const categorias = datos.map((p: any) => p.code || '—');
    const horas = datos.map((p: any) => Number(p.horas));
    const montos = datos.map((p: any) => Number(p.monto));
    return Highcharts.chart(this.chartPlantillas!.nativeElement, {
      chart: { type: 'bar', height: 280 },
      title: { text: 'Top Plantillas (horas)', style: { fontSize: '13px' } },
      xAxis: { categories: categorias, title: { text: null }, labels: { style: { fontSize: '10px' } } },
      yAxis: [{ title: { text: 'Horas' } }, { title: { text: 'Monto' }, opposite: true }],
      tooltip: { shared: true },
      series: [
        { name: 'Horas', data: horas },
        { name: 'Monto (Bs)', type: 'bar', yAxis: 1, data: montos, color: '#38bdf8' },
      ],
      credits: { enabled: false },
    });
  }
}
