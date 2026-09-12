import { Component, OnInit } from '@angular/core';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';
import { Proyecto } from '../models/sgh.models';

@Component({
  selector: 'app-proyectos-list',
  standalone: false,
  templateUrl: './proyectos-list.component.html',
})
export class ProyectosListComponent implements OnInit {
  proyectos: Proyecto[] = [];
  loading = false;
  error = '';
  filtroNumdoc = '';
  fecini = '';
  fecfin = '';

  constructor(private service: SghService, private swal: SwalService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    this.service
      .listProyectos(this.filtroNumdoc || undefined, this.fecini || undefined, this.fecfin || undefined)
      .subscribe({
        next: (d) => {
          this.proyectos = d;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.message;
          this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error al cargar proyectos';
        },
      });
  }

  async anular(p: Proyecto): Promise<void> {
    const motivo = await this.swal.entrada({
      titulo: 'Anular proyecto',
      texto: `Motivo de anulación del proyecto ${p.numdoc ?? p.idProyect}:`,
      placeholder: 'Motivo',
      textoConfirmar: 'Anular',
    });
    if (!motivo) return;
    this.service.anularProyecto(p.idProyect, motivo).subscribe({
      next: () => {
        this.swal.exito('Proyecto anulado');
        this.cargar();
      },
      error: (err) => {
        const msg = err.error?.message;
        this.swal.error('Error al anular', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo anular el proyecto'));
      },
    });
  }

  async eliminar(p: Proyecto): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Eliminar proyecto ${p.numdoc ?? p.idProyect}?`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.service.removeProyecto(p.idProyect).subscribe({
      next: () => {
        this.swal.exito('Proyecto eliminado');
        this.cargar();
      },
      error: (err) => {
        const msg = err.error?.message;
        this.swal.error('Error al eliminar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo eliminar el proyecto'));
      },
    });
  }

  imprimir(p: Proyecto): void {
    this.swal.cargando('Generando PDF...');
    this.service.pdfProyecto(p.idProyect).subscribe({
      next: (blob) => {
        this.swal.cerrar();
        abrirPdf(blob, `proyecto-${p.numdoc || p.idProyect}.pdf`);
      },
      error: () => {
        this.swal.cerrar();
        this.swal.error('Error al imprimir', 'No se pudo generar el PDF del proyecto');
      },
    });
  }
}
