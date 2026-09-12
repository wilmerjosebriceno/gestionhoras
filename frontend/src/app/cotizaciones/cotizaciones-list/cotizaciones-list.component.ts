import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CotizacionesService } from '../services/cotizaciones.service';
import { CotVencimientoAlertService } from '../services/cot-vencimiento-alert.service';
import { Budget, ESTADOS_BUDGET } from '../models/cotizacion.model';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';

@Component({
  selector: 'app-cotizaciones-list',
  standalone: false,
  templateUrl: './cotizaciones-list.component.html',
})
export class CotizacionesListComponent implements OnInit {
  budgets: Budget[] = [];
  estados = ESTADOS_BUDGET;
  loading = false;
  error = '';

  // Filtros / búsqueda
  statusFiltro?: number;
  buscar = '';
  de = '';
  hasta = '';

  // Paginación
  meta = { total: 0, page: 1, limit: 50, totalPages: 0 };
  page = 1;
  pageSizeOptions = [10, 25, 50, 100];

  cambiarLimite(): void {
    this.page = 1;
    this.cargar();
  }

  get rangoDesde(): number {
    return (this.meta.page - 1) * this.meta.limit + (this.meta.total > 0 ? 1 : 0);
  }

  get rangoHasta(): number {
    return Math.min(this.meta.page * this.meta.limit, this.meta.total);
  }

  /** Lista de páginas con "..." para saltos (muestra hasta 7 botones). */
  get paginas(): Array<number | string> {
    const total = this.meta.totalPages;
    const actual = this.meta.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const paginas: Array<number | string> = [1];
    const inicio = Math.max(2, actual - 1);
    const fin = Math.min(total - 1, actual + 1);
    if (inicio > 2) paginas.push('...');
    for (let p = inicio; p <= fin; p++) paginas.push(p);
    if (fin < total - 1) paginas.push('...');
    paginas.push(total);
    return paginas;
  }

  constructor(
    private service: CotizacionesService,
    private router: Router,
    private swal: SwalService,
    private alertaVencimiento: CotVencimientoAlertService,
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.alertaVencimiento.mostrarSiAplica();
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    this.service.listarBudgets({
      status: this.statusFiltro,
      q: this.buscar.trim() || undefined,
      de: this.de || undefined,
      hasta: this.hasta || undefined,
      page: this.page,
      limit: this.meta.limit,
    }).subscribe({
      next: (res) => {
        this.budgets = res.data;
        this.meta = res.meta;
        this.page = res.meta.page;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al cargar cotizaciones');
      },
    });
  }

  /** Aplica búsqueda/filtros desde la primera página. */
  aplicar(): void {
    this.page = 1;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.buscar = '';
    this.de = '';
    this.hasta = '';
    this.statusFiltro = undefined;
    this.page = 1;
    this.cargar();
  }

  irPagina(p: number | string): void {
    const n = typeof p === 'string' ? Number(p) : p;
    if (!n || n < 1 || n > this.meta.totalPages || n === this.page) return;
    this.page = n;
    this.cargar();
  }

  /** Situación de vencimiento para la columna de la lista. */
  vencimientoInfo(b: Budget): { texto: string; clase: string } {
    if (!b.vencimiento) return { texto: '—', clase: 'bg-gray-100 text-gray-600' };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const v = new Date(`${String(b.vencimiento).slice(0, 10)}T00:00:00`);
    const dias = Math.round((hoy.getTime() - v.getTime()) / 86400000);
    if (dias > 15) return { texto: `${b.vencimiento} · vencida`, clase: 'bg-red-100 text-red-700' };
    if (dias > 0) return { texto: `${b.vencimiento} · vencida hace ${dias} d`, clase: 'bg-red-100 text-red-700' };
    if (dias >= -5) return { texto: `${b.vencimiento} · vence en ${Math.abs(dias)} d`, clase: 'bg-amber-100 text-amber-700' };
    return { texto: `${b.vencimiento}`, clase: 'bg-green-100 text-green-700' };
  }

  nuevo(): void {
    this.router.navigate(['/cot/editar/nuevo']);
  }
  ver(id: number): void {
    this.router.navigate(['/cot', id]);
  }

  /** Genera y abre el PDF elegante de la cotización. */
  imprimir(b: Budget): void {
    this.swal.cargando('Generando PDF...');
    this.service.pdfCotizacion(b.idBudget).subscribe({
      next: (blob) => {
        this.swal.cerrar();
        abrirPdf(blob, `cotizacion-${b.codeBudget}.pdf`);
      },
      error: () => {
        this.swal.cerrar();
        this.swal.error('Error', 'No se pudo generar el PDF');
      },
    });
  }

  /** Envía la cotización por correo (PDF adjunto). */
  async enviarCorreo(b: Budget): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: 'Enviar cotización',
      textoConfirmar: `Enviar ${b.codeBudget} por correo?`,
    });
    if (!ok) return;
    this.swal.cargando('Enviando correo...');
    this.service.enviarCotizacion(b.idBudget).subscribe({
      next: (res) => {
        this.swal.cerrar();
        this.swal.exito('Cotización enviada', `Enviada a ${res.email}`);
        this.cargar();
      },
      error: (err) => {
        this.swal.cerrar();
        const msg = err.error?.message;
        this.swal.error('Error al enviar', Array.isArray(msg) ? msg.join(' · ') : (msg || 'No se pudo enviar el correo'));
      },
    });
  }

  cambiarEstado(b: Budget): void {
    const nxt = ((b.status ?? 0) + 1) % 4;
    this.service.cambiarEstado(b.idBudget, nxt).subscribe({
      next: () => this.cargar(),
      error: (err) => this.swal.error('Error', err.error?.message || 'No se pudo cambiar estado'),
    });
  }

  /** Clases del badge de estado (incluye ELIMINADA = 4). */
  estadoClase(b: Budget): string {
    switch (b.status) {
      case 1: return 'px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700';
      case 2: return 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-700';
      case 3: return 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-700';
      case 4: return 'px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-500 line-through';
      default: return 'px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700';
    }
  }

  async eliminar(b: Budget): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: 'Eliminar cotización',
      texto: `${b.codeBudget} se marcará como ELIMINADA (borrado lógico). No se elimina de la base de datos.`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.service.eliminarBudget(b.idBudget).subscribe({
      next: () => this.cargar(),
      error: (err) => this.swal.error('Error', err.error?.message || 'No se pudo eliminar'),
    });
  }

  /** Duplica una cotización existente como una nueva (BORRADOR). */
  async duplicar(b: Budget): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: 'Duplicar cotización',
      texto: `Se creará una copia de ${b.codeBudget} como nueva cotización (BORRADOR), con un nuevo número y fecha de hoy.`,
      textoConfirmar: 'Sí, duplicar',
      icono: 'question',
    });
    if (!ok) return;
    this.swal.cargando('Duplicando...');
    this.service.duplicarBudget(b.idBudget).subscribe({
      next: (nueva) => {
        this.swal.cerrar();
        this.swal.exito('Cotización duplicada', `Nueva: ${nueva.codeBudget}`);
        this.router.navigate(['/cot/editar', nueva.idBudget]);
      },
      error: (err) => {
        this.swal.cerrar();
        const msg = err.error?.message;
        this.swal.error('Error al duplicar', Array.isArray(msg) ? msg.join(' · ') : (msg || 'No se pudo duplicar'));
      },
    });
  }

  /** Restaura una cotización ELIMINADA devolviéndola a BORRADOR. */
  async restaurar(b: Budget): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: 'Restaurar cotización',
      texto: `${b.codeBudget} volverá al estado BORRADOR.`,
      textoConfirmar: 'Sí, restaurar',
      icono: 'question',
    });
    if (!ok) return;
    this.service.cambiarEstado(b.idBudget, 0).subscribe({
      next: () => this.cargar(),
      error: (err) => this.swal.error('Error', err.error?.message || 'No se pudo restaurar'),
    });
  }
}