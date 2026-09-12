import { Component, OnInit } from '@angular/core';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';
import { Actividad } from '../models/sgh.models';

@Component({
  selector: 'app-actividades-list',
  standalone: false,
  templateUrl: './actividades-list.component.html',
})
export class ActividadesListComponent implements OnInit {
  actividades: Actividad[] = [];
  loading = false;
  error = '';
  filtroNumdoc = '';
  fecini = '';
  fecfin = '';

  page = 1;
  pageSize = 50;
  total = 0;
  totalPages = 0;

  constructor(private service: SghService, private swal: SwalService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    this.service
      .listActividades({
        numdoc: this.filtroNumdoc || undefined,
        fecini: this.fecini || undefined,
        fecfin: this.fecfin || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (p) => {
          this.actividades = p.data;
          this.total = p.total;
          this.totalPages = p.totalPages || 0;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.message;
          this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error al cargar actividades';
        },
      });
  }

  irPagina(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.cargar();
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.cargar();
  }

  paginaInicio(): void {
    this.irPagina(1);
  }

  paginaAnterior(): void {
    this.irPagina(this.page - 1);
  }

  paginaSiguiente(): void {
    this.irPagina(this.page + 1);
  }

  paginaFin(): void {
    this.irPagina(this.totalPages);
  }

  async anular(a: Actividad): Promise<void> {
    const motivo = await this.swal.entrada({
      titulo: 'Anular actividad',
      texto: `Motivo de anulación de la actividad ${a.numdoc}:`,
      placeholder: 'Motivo',
      textoConfirmar: 'Anular',
    });
    if (!motivo) return;
    this.service.anularActividad(a.idActivity, motivo).subscribe({
      next: () => {
        this.swal.exito('Actividad anulada');
        this.cargar();
      },
      error: (err) => {
        const msg = err.error?.message;
        this.swal.error('Error al anular', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo anular la actividad'));
      },
    });
  }

  async eliminar(a: Actividad): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Eliminar actividad ${a.numdoc}?`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.service.removeActividad(a.idActivity).subscribe({
      next: () => {
        this.swal.exito('Actividad eliminada');
        this.cargar();
      },
      error: (err) => {
        const msg = err.error?.message;
        this.swal.error('Error al eliminar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo eliminar la actividad'));
      },
    });
  }

  imprimir(a: Actividad): void {
    this.swal.cargando('Generando PDF...');
    this.service.pdfActividad(a.idActivity).subscribe({
      next: (blob) => {
        this.swal.cerrar();
        abrirPdf(blob, `actividad-${a.numdoc}.pdf`);
      },
      error: () => {
        this.swal.cerrar();
        this.swal.error('Error al imprimir', 'No se pudo generar el formato PDF');
      },
    });
  }
}
