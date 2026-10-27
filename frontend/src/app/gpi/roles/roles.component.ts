import { Component, OnInit } from '@angular/core';
import { GpiRol, GpiService } from '../services/gpi.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-gpi-roles',
  standalone: false,
  templateUrl: './roles.component.html',
})
export class RolesComponent implements OnInit {
  cargando = false;
  roles: GpiRol[] = [];
  mostrarForm = false;
  guardando = false;
  form: any = { codigo: '', nombre: '' };

  constructor(private readonly gpi: GpiService, private readonly swal: SwalService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.listarRoles().subscribe({
      next: (r) => {
        this.roles = r;
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar roles', this.msg(e));
      },
    });
  }

  nuevo(): void {
    this.form = { codigo: '', nombre: '' };
    this.mostrarForm = true;
  }

  guardar(): void {
    if (!this.form.codigo?.trim() || !this.form.nombre?.trim()) {
      this.swal.advertencia('Código y nombre son obligatorios');
      return;
    }
    this.guardando = true;
    this.gpi.crearRol({ codigo: this.form.codigo.trim(), nombre: this.form.nombre.trim() }).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarForm = false;
        this.swal.exito('Rol guardado');
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        this.swal.error('No se pudo guardar', this.msg(e));
      },
    });
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
