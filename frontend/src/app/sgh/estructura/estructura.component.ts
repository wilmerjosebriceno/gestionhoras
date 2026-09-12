import { Component, OnInit } from '@angular/core';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { ItemActividad, EstructuraFila } from '../models/sgh.models';

@Component({
  selector: 'app-estructura',
  standalone: false,
  templateUrl: './estructura.component.html',
})
export class EstructuraComponent implements OnInit {
  items: ItemActividad[] = [];
  idItem?: number;
  filas: EstructuraFila[] = [];
  loading = false;
  error = '';
  exito = '';

  constructor(private service: SghService, private swal: SwalService) {}

  ngOnInit(): void {
    this.service.itemsActivos().subscribe((i) => {
      this.items = i;
      if (i.length > 0) this.seleccionar(i[0].idItemActivity);
    });
  }

  seleccionar(idItem: number): void {
    this.idItem = idItem;
    this.error = '';
    this.exito = '';
    this.loading = true;
    this.service.asignacionEstructura(idItem).subscribe({
      next: (f) => {
        this.filas = f;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.setError(err);
      },
    });
  }

  guardar(): void {
    if (!this.idItem) return;
    this.error = '';
    this.service.guardarAsignacion(this.idItem, this.filas).subscribe({
      next: () => {
        this.exito = 'Asignaciones guardadas correctamente';
        this.swal.exito('Asignaciones guardadas correctamente');
        this.seleccionar(this.idItem!);
      },
      error: (err) => this.setError(err),
    });
  }

  setError(err: any): void {
    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error en la operación';
  }
}
