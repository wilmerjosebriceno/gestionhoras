import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SistemaService } from '../../core/services/sistema.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-sistemas-form',
  standalone: false,
  templateUrl: './sistemas-form.component.html',
})
export class SistemasFormComponent implements OnInit {
  dto: {
    sistema: string;
    denominacion: string;
    descripcion: string;
    ruta: string;
    estatus: number;
  } = { sistema: '', denominacion: '', descripcion: '', ruta: '', estatus: 1 };
  editando = false;
  error = '';

  constructor(
    private service: SistemaService,
    private route: ActivatedRoute,
    private router: Router,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    const codigo = this.route.snapshot.params['sistema'];
    if (codigo) {
      this.editando = true;
      this.service.findOne(codigo).subscribe((s) => {
        this.dto = {
          sistema: s.sistema,
          denominacion: s.denominacion,
          descripcion: s.descripcion ?? '',
          ruta: s.ruta ?? '',
          estatus: s.estatus ?? 1,
        };
      });
    }
  }

  guardar(): void {
    this.error = '';
    const obs = this.editando
      ? this.service.update(this.dto.sistema, {
          denominacion: this.dto.denominacion,
          descripcion: this.dto.descripcion,
          ruta: this.dto.ruta,
          estatus: this.dto.estatus,
        })
      : this.service.create(this.dto);
    obs.subscribe({
      next: () => {
        this.swal.exito(this.editando ? 'Sistema actualizado' : 'Sistema creado');
        this.router.navigate(['/sec/sistemas']);
      },
      error: (err) => {
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al guardar');
        this.swal.error('Error al guardar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo guardar el sistema'));
      },
    });
  }
}