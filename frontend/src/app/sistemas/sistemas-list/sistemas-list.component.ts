import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SistemaService } from '../../core/services/sistema.service';
import { SwalService } from '../../core/services/swal.service';
import { Sistema } from '../../core/models/sistema.model';

@Component({
  selector: 'app-sistemas-list',
  standalone: false,
  templateUrl: './sistemas-list.component.html',
})
export class SistemasListComponent implements OnInit {
  sistemas: Sistema[] = [];
  loading = false;
  error = '';

  constructor(private service: SistemaService, private router: Router, private swal: SwalService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.findAll().subscribe({
      next: (s) => { this.sistemas = s; this.loading = false; },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al cargar');
      },
    });
  }

  async eliminar(sistema: Sistema): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Eliminar sistema ${sistema.sistema}?`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.service.remove(sistema.sistema).subscribe({
      next: () => {
        this.swal.exito('Sistema eliminado');
        this.cargar();
      },
      error: (err) => {
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al eliminar');
        this.swal.error('Error al eliminar', this.error);
      },
    });
  }
}
