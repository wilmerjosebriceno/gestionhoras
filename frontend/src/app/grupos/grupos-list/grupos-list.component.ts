import { Component, OnInit } from '@angular/core';
import { GrupoService } from '../../core/services/grupo.service';
import { SwalService } from '../../core/services/swal.service';
import { Grupo } from '../../core/models/grupo.model';

@Component({
  selector: 'app-grupos-list',
  standalone: false,
  templateUrl: './grupos-list.component.html',
})
export class GruposListComponent implements OnInit {
  grupos: Grupo[] = [];
  loading = false;

  constructor(private service: GrupoService, private swal: SwalService) {}

  ngOnInit(): void {
    this.loading = true;
    this.service.findAll().subscribe({
      next: (g) => (this.grupos = g),
      error: () => (this.loading = false),
      complete: () => (this.loading = false),
    });
  }

  async eliminar(g: Grupo): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Eliminar grupo ${g.grupo}?`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.loading = true;
    this.service.remove(g.grupo).subscribe({
      next: () => {
        this.grupos = this.grupos.filter((x) => x.grupo !== g.grupo);
        this.swal.exito('Grupo eliminado');
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message;
        this.swal.error('Error al eliminar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo eliminar el grupo'));
      },
      complete: () => (this.loading = false),
    });
  }
}
