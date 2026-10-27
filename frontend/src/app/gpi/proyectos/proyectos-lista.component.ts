import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GpiProyecto, GpiRecurso, GpiService } from '../services/gpi.service';
import { SwalService } from '../../core/services/swal.service';

const ESTADOS = ['planificado', 'en_ejecucion', 'en_pausa', 'cerrado', 'cancelado'];

@Component({
  selector: 'app-gpi-proyectos-lista',
  standalone: false,
  templateUrl: './proyectos-lista.component.html',
})
export class ProyectosListaComponent implements OnInit {
  cargando = false;
  proyectos: GpiProyecto[] = [];
  recursos: GpiRecurso[] = [];
  total = 0;
  page = 1;
  limit = 20;
  totalPaginas = 1;
  search = '';
  estado = '';
  estados = ESTADOS;

  mostrarForm = false;
  guardando = false;
  form: any = this.formVacio();

  constructor(
    private readonly gpi: GpiService,
    private readonly swal: SwalService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.gpi.listarRecursos().subscribe({ next: (r) => (this.recursos = r), error: () => {} });
  }

  private formVacio() {
    return {
      codigo: '',
      nombre: '',
      descripcion: '',
      idGerente: null,
      estado: 'planificado',
      prioridad: 3,
      fechaIniPlan: '',
      fechaFinPlan: '',
      horasEstimadas: 0,
    };
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.listarProyectos({ search: this.search, estado: this.estado, page: this.page, limit: this.limit }).subscribe({
      next: (res) => {
        this.proyectos = res.data;
        this.total = res.total;
        this.totalPaginas = res.totalPaginas;
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar proyectos', this.msg(e));
      },
    });
  }

  buscar(): void {
    this.page = 1;
    this.cargar();
  }

  nuevo(): void {
    this.form = this.formVacio();
    this.mostrarForm = true;
  }

  cancelar(): void {
    this.mostrarForm = false;
  }

  guardar(): void {
    if (!this.form.codigo?.trim() || !this.form.nombre?.trim()) {
      this.swal.advertencia('Campos requeridos', 'El código y el nombre son obligatorios.');
      return;
    }
    const payload: any = {
      codigo: this.form.codigo.trim(),
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion?.trim() || undefined,
      estado: this.form.estado,
      prioridad: Number(this.form.prioridad) || 3,
      horasEstimadas: Number(this.form.horasEstimadas) || 0,
    };
    if (this.form.idGerente) payload.idGerente = Number(this.form.idGerente);
    if (this.form.fechaIniPlan) payload.fechaIniPlan = this.form.fechaIniPlan;
    if (this.form.fechaFinPlan) payload.fechaFinPlan = this.form.fechaFinPlan;

    this.guardando = true;
    this.gpi.crearProyecto(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarForm = false;
        this.swal.exito('Proyecto creado', 'El proyecto se registró correctamente.');
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        this.swal.error('No se pudo crear', this.msg(e));
      },
    });
  }

  abrir(p: GpiProyecto): void {
    this.router.navigate(['/gpi/proyectos', p.id_proyecto]);
  }

  eliminar(p: GpiProyecto, ev: Event): void {
    ev.stopPropagation();
    this.swal
      .confirmar({ titulo: 'Eliminar proyecto', texto: `¿Eliminar «${p.nombre}»?`, textoConfirmar: 'Sí, eliminar' })
      .then((ok) => {
        if (!ok) return;
        this.gpi.eliminarProyecto(p.id_proyecto).subscribe({
          next: () => {
            this.swal.exito('Proyecto eliminado');
            this.cargar();
          },
          error: (e) => this.swal.error('No se pudo eliminar', this.msg(e)),
        });
      });
  }

  irAPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.page = p;
    this.cargar();
  }

  etiquetaEstado(e: string): string {
    return { planificado: 'Planificado', en_ejecucion: 'En ejecución', en_pausa: 'En pausa', cerrado: 'Cerrado', cancelado: 'Cancelado' }[e] || e;
  }

  claseEstado(e: string): string {
    return {
      planificado: 'bg-gray-100 text-gray-700',
      en_ejecucion: 'bg-blue-100 text-blue-700',
      en_pausa: 'bg-amber-100 text-amber-700',
      cerrado: 'bg-emerald-100 text-emerald-700',
      cancelado: 'bg-red-100 text-red-700',
    }[e] || 'bg-gray-100 text-gray-700';
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
