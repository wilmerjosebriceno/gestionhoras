import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GrupoService } from '../../core/services/grupo.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-grupos-form',
  standalone: false,
  templateUrl: './grupos-form.component.html',
})
export class GruposFormComponent implements OnInit {
  dto: any = { grupo: '', denominacion: '' };
  editando = false;
  error = '';
  loading = false;
  usuarios: string[] = [];
  private grupo?: string;

  constructor(
    private service: GrupoService,
    private route: ActivatedRoute,
    private router: Router,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.grupo = this.route.snapshot.params['grupo'];
    if (this.grupo) {
      this.editando = true;
      this.service.findOne(this.grupo).subscribe((g) => {
        this.dto = { grupo: g.grupo, denominacion: g.denominacion };
      });
    }
  }

  guardar(): void {
    this.error = '';
    this.loading = true;
    const obs = this.editando
      ? this.service.update(this.grupo!, this.dto)
      : this.service.create(this.dto as any);
    obs.subscribe({
      next: () => {
        this.swal.exito(this.editando ? 'Grupo actualizado' : 'Grupo creado');
        this.router.navigate(['/sec/grupos']);
      },
      error: (err) => {
        const msg = err.error?.message;
        this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al guardar');
        this.swal.error('Error al guardar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo guardar el grupo'));
        this.loading = false;
      },
    });
  }

  agregarUsuario(login: string): void {
    if (login && !this.usuarios.includes(login.toUpperCase())) {
      this.usuarios.push(login.toUpperCase());
    }
  }

  quitarUsuario(login: string): void {
    this.usuarios = this.usuarios.filter((u) => u !== login);
  }

  asignarUsuarios(): void {
    this.loading = true;
    this.service.asignarUsuarios(this.grupo!, this.usuarios).subscribe({
      next: () => {
        this.swal.exito('Usuarios asignados exitosamente');
        this.loading = false;
      },
      error: (err) => {
        const msg = err.error?.message;
        this.swal.error('Error al asignar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudieron asignar los usuarios'));
        this.loading = false;
      },
    });
  }
}
