import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';
import { Proyecto, ProyectoActividadRow, Actividad } from '../models/sgh.models';

@Component({
  selector: 'app-proyecto-detalle',
  standalone: false,
  templateUrl: './proyecto-detalle.component.html',
})
export class ProyectoDetalleComponent implements OnInit {
  proyecto?: Proyecto;
  detalle: ProyectoActividadRow[] = [];
  actividades: Actividad[] = [];
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private service: SghService,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.params['id']);
    this.service.getProyecto(id).subscribe({
      next: (p) => {
        this.proyecto = p;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.setError(err);
      },
    });
    this.service.detalleProyecto(id, true).subscribe((d) => (this.detalle = d));
    this.service.actividadesDelProyecto(id).subscribe((a) => (this.actividades = a));
  }

  totalPlan(): number {
    return this.detalle.reduce((acc, d) => acc + Number(d.hour || 0), 0);
  }

  totalEjec(): number {
    return this.detalle.reduce((acc, d) => acc + Number(d.hourE || 0), 0);
  }

  pctEjec(): number {
    const plan = this.totalPlan();
    return plan ? Math.round((this.totalEjec() / plan) * 10000) / 100 : 0;
  }

  /** Color del estado (semáforo) por fase, igual que el reporte anterior. */
  colorEstado(d: ProyectoActividadRow): string {
    const h = Number(d.hour || 0);
    const hE = Number(d.hourE || 0);
    if (h === 0) return hE > 0 ? '#FF4444' : '#F3F1F8';
    if (hE === 0) return '#F3F1F8';
    const calc = h / hE;
    if (calc < 1) return '#FF4444';
    if (calc === 1) return '#44CC44';
    return '#F7F312';
  }

  imprimir(): void {
    if (!this.proyecto) return;
    this.swal.cargando('Generando PDF...');
    this.service.pdfProyecto(this.proyecto.idProyect).subscribe({
      next: (blob) => {
        this.swal.cerrar();
        abrirPdf(blob, `proyecto-${this.proyecto?.numdoc || this.proyecto?.idProyect}.pdf`);
      },
      error: () => {
        this.swal.cerrar();
        this.swal.error('Error al imprimir', 'No se pudo generar el PDF del proyecto');
      },
    });
  }

  setError(err: any): void {
    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error al cargar';
  }
}
