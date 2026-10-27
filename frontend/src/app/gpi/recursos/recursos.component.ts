import { Component, OnInit } from '@angular/core';
import { GpiRecurso, GpiService } from '../services/gpi.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-gpi-recursos',
  standalone: false,
  templateUrl: './recursos.component.html',
})
export class RecursosComponent implements OnInit {
  cargando = false;
  recursos: GpiRecurso[] = [];
  mostrarForm = false;
  guardando = false;
  tipos = ['consultor', 'desarrollador', 'analista', 'lider', 'qa', 'soporte', 'otro'];
  form: any = this.vacio();

  constructor(private readonly gpi: GpiService, private readonly swal: SwalService) {}

  ngOnInit(): void {
    this.cargar();
  }

  private vacio() {
    return { nombre: '', email: '', cargo: '', tipo: 'consultor', area: '', capacidadSemanal: 40, tarifaHora: null };
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.listarRecursos().subscribe({
      next: (r) => {
        this.recursos = r;
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar recursos', this.msg(e));
      },
    });
  }

  nuevo(): void {
    this.form = this.vacio();
    this.mostrarForm = true;
  }

  guardar(): void {
    if (!this.form.nombre?.trim()) {
      this.swal.advertencia('El nombre es obligatorio');
      return;
    }
    const payload: any = {
      nombre: this.form.nombre.trim(),
      tipo: this.form.tipo,
      capacidadSemanal: Number(this.form.capacidadSemanal) || 40,
    };
    if (this.form.email) payload.email = this.form.email.trim();
    if (this.form.cargo) payload.cargo = this.form.cargo.trim();
    if (this.form.area) payload.area = this.form.area.trim();
    if (this.form.tarifaHora) payload.tarifaHora = Number(this.form.tarifaHora);

    this.guardando = true;
    this.gpi.crearRecurso(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarForm = false;
        this.swal.exito('Recurso creado');
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        this.swal.error('No se pudo crear', this.msg(e));
      },
    });
  }

  eliminar(r: GpiRecurso): void {
    this.swal
      .confirmar({ titulo: 'Eliminar recurso', texto: `¿Eliminar «${r.nombre}»?`, textoConfirmar: 'Sí, eliminar' })
      .then((ok) => {
        if (!ok) return;
        this.gpi.eliminarRecurso(r.id_recurso).subscribe({
          next: () => {
            this.swal.exito('Recurso eliminado');
            this.cargar();
          },
          error: (e) => this.swal.error('No se pudo eliminar', this.msg(e)),
        });
      });
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
