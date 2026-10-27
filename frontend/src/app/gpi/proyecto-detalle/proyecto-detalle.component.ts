import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  GpiActividad,
  GpiAsignacion,
  GpiMiembro,
  GpiProyecto,
  GpiRecurso,
  GpiRol,
  GpiService,
} from '../services/gpi.service';
import { SwalService } from '../../core/services/swal.service';
import { AyudaContextoService } from '../../core/services/ayuda-contexto.service';

@Component({
  selector: 'app-gpi-proyecto-detalle',
  standalone: false,
  templateUrl: './proyecto-detalle.component.html',
})
export class ProyectoDetalleComponent implements OnInit, OnDestroy {
  id = 0;
  cargando = false;
  tab: 'equipo' | 'actividades' | 'asignaciones' | 'gantt' | 'partes' | 'carga' | 'calendario' = 'equipo';

  proyecto: GpiProyecto | null = null;
  miembros: GpiMiembro[] = [];
  actividades: GpiActividad[] = [];
  actividadesVista: any[] = [];
  asignaciones: GpiAsignacion[] = [];
  recursos: GpiRecurso[] = [];
  roles: GpiRol[] = [];

  // Alta de miembro
  miembroForm: any = { idRecurso: null, idRol: null, dedicacionPct: 100 };

  // Alta de actividad
  mostrarActividad = false;
  actividadForm: any = this.actividadVacia();

  // Alta de asignación
  asignacionForm: any = { idActividad: null, idMiembro: null, horasEstimadas: 0 };

  // Editor de horas por fecha
  horasEditor: { id_asignacion: number; filas: Array<{ fecha: string; horas: number }> } | null = null;
  guardandoHoras = false;
  programando = false;
  nivelando = false;
  guardandoBase = false;

  // Partes de horas (real)
  partes: any[] = [];
  parteForm: any = { idAsignacion: null, fecha: new Date().toISOString().slice(0, 10), horas: 0, descripcion: '' };

  estadosActividad = ['pendiente', 'en_proceso', 'bloqueada', 'completada', 'cancelada'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly gpi: GpiService,
    private readonly swal: SwalService,
    private readonly router: Router,
    private readonly ayudaCtx: AyudaContextoService,
  ) {}

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
    this.actualizarAyudaContexto();
    this.gpi.catalogos().subscribe({
      next: (c) => {
        this.recursos = c.recursos;
        this.roles = c.roles;
      },
      error: () => {},
    });
  }

  private actividadVacia() {
    return {
      nombre: '',
      tipo: 'tarea',
      idPadre: null,
      idResponsable: null,
      fechaIniPlan: '',
      fechaFinPlan: '',
      horasEstimadas: 0,
      orden: 0,
    };
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.obtenerProyecto(this.id).subscribe({
      next: (p) => {
        this.proyecto = p;
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar el proyecto', this.msg(e));
      },
    });
    this.cargarMiembros();
    this.cargarActividades();
    this.cargarAsignaciones();
  }

  cargarMiembros(): void {
    this.gpi.listarMiembros(this.id).subscribe({ next: (m) => (this.miembros = m), error: () => {} });
  }
  cargarActividades(): void {
    this.gpi.listarActividades(this.id).subscribe({
      next: (a) => {
        this.actividades = a;
        this.organizarActividades();
      },
      error: () => {},
    });
  }

  /** Ordena las actividades en forma de arbol (WBS) y calcula su nivel. */
  private organizarActividades(): void {
    const hijos = new Map<number | null, GpiActividad[]>();
    for (const a of this.actividades) {
      const p = a.id_padre ?? null;
      if (!hijos.has(p)) hijos.set(p, []);
      hijos.get(p)!.push(a);
    }
    const out: any[] = [];
    const visitar = (padre: number | null, nivel: number) => {
      for (const a of hijos.get(padre) || []) {
        out.push({ ...a, _nivel: nivel });
        visitar(a.id_actividad, nivel + 1);
      }
    };
    visitar(null, 0);
    // Actividades cuyo padre no existe o ciclos: se agregan al final sin nivel.
    for (const a of this.actividades) {
      if (!out.some((x) => x.id_actividad === a.id_actividad)) out.push({ ...a, _nivel: 0 });
    }
    this.actividadesVista = out;
  }
  cargarAsignaciones(): void {
    this.gpi.listarAsignaciones({ proyectoId: this.id }).subscribe({ next: (a) => (this.asignaciones = a), error: () => {} });
  }

  /* ==================== Equipo ==================== */
  agregarMiembro(): void {
    if (!this.miembroForm.idRecurso) {
      this.swal.advertencia('Seleccione un recurso');
      return;
    }
    const payload: any = {
      idRecurso: Number(this.miembroForm.idRecurso),
      dedicacionPct: Number(this.miembroForm.dedicacionPct) || 100,
    };
    if (this.miembroForm.idRol) payload.idRol = Number(this.miembroForm.idRol);
    this.gpi.crearMiembro(this.id, payload).subscribe({
      next: () => {
        this.swal.exito('Recurso agregado al equipo');
        this.miembroForm = { idRecurso: null, idRol: null, dedicacionPct: 100 };
        this.cargarMiembros();
      },
      error: (e) => this.swal.error('No se pudo agregar', this.msg(e)),
    });
  }

  quitarMiembro(m: GpiMiembro): void {
    this.gpi.eliminarMiembro(m.id_miembro).subscribe({
      next: () => {
        this.cargarMiembros();
        this.cargarAsignaciones();
      },
      error: (e) => this.swal.error('No se pudo quitar', this.msg(e)),
    });
  }

  /* ==================== Actividades ==================== */
  nuevaActividad(): void {
    this.actividadForm = this.actividadVacia();
    this.mostrarActividad = true;
  }

  guardarActividad(): void {
    if (!this.actividadForm.nombre?.trim()) {
      this.swal.advertencia('Nombre requerido');
      return;
    }
    const payload: any = {
      idProyecto: this.id,
      nombre: this.actividadForm.nombre.trim(),
      tipo: this.actividadForm.tipo,
      horasEstimadas: Number(this.actividadForm.horasEstimadas) || 0,
      orden: Number(this.actividadForm.orden) || 0,
    };
    if (this.actividadForm.idResponsable) payload.idResponsable = Number(this.actividadForm.idResponsable);
    if (this.actividadForm.idPadre) payload.idPadre = Number(this.actividadForm.idPadre);
    if (this.actividadForm.fechaIniPlan) payload.fechaIniPlan = this.actividadForm.fechaIniPlan;
    if (this.actividadForm.fechaFinPlan) payload.fechaFinPlan = this.actividadForm.fechaFinPlan;
    this.gpi.crearActividad(payload).subscribe({
      next: () => {
        this.mostrarActividad = false;
        this.swal.exito('Actividad creada');
        this.cargarActividades();
      },
      error: (e) => this.swal.error('No se pudo crear', this.msg(e)),
    });
  }

  cambiarEstadoActividad(a: GpiActividad, estado: string): void {
    this.gpi.actualizarActividad(a.id_actividad, { estado }).subscribe({
      next: () => this.cargarActividades(),
      error: (e) => this.swal.error('No se pudo actualizar', this.msg(e)),
    });
  }

  eliminarActividad(a: GpiActividad): void {
    this.gpi.eliminarActividad(a.id_actividad).subscribe({
      next: () => {
        this.cargarActividades();
        this.cargarAsignaciones();
      },
      error: (e) => this.swal.error('No se pudo eliminar', this.msg(e)),
    });
  }

  /* ==================== Asignaciones ==================== */
  crearAsignacion(): void {
    if (!this.asignacionForm.idActividad || !this.asignacionForm.idMiembro) {
      this.swal.advertencia('Seleccione actividad y recurso');
      return;
    }
    const payload = {
      idActividad: Number(this.asignacionForm.idActividad),
      idMiembro: Number(this.asignacionForm.idMiembro),
      horasEstimadas: Number(this.asignacionForm.horasEstimadas) || 0,
    };
    this.gpi.crearAsignacion(payload).subscribe({
      next: () => {
        this.swal.exito('Recurso asignado a la actividad');
        this.asignacionForm = { idActividad: null, idMiembro: null, horasEstimadas: 0 };
        this.cargarAsignaciones();
        this.cargarActividades();
      },
      error: (e) => this.swal.error('No se pudo asignar', this.msg(e)),
    });
  }

  eliminarAsignacion(a: GpiAsignacion): void {
    this.gpi.eliminarAsignacion(a.id_asignacion).subscribe({
      next: () => {
        this.cargarAsignaciones();
        this.cargarActividades();
      },
      error: (e) => this.swal.error('No se pudo eliminar', this.msg(e)),
    });
  }

  abrirHoras(a: GpiAsignacion): void {
    this.gpi.obtenerHoras(a.id_asignacion).subscribe({
      next: (horas) => {
        this.horasEditor = {
          id_asignacion: a.id_asignacion,
          filas: horas.map((h) => ({ fecha: h.fecha.slice(0, 10), horas: Number(h.horas_estimadas) })),
        };
        if (!this.horasEditor.filas.length) this.agregarFilaHoras();
      },
      error: (e) => this.swal.error('No se pudieron cargar las horas', this.msg(e)),
    });
  }

  agregarFilaHoras(): void {
    if (!this.horasEditor) return;
    const hoy = new Date().toISOString().slice(0, 10);
    this.horasEditor.filas.push({ fecha: hoy, horas: 0 });
  }

  quitarFilaHoras(i: number): void {
    this.horasEditor?.filas.splice(i, 1);
  }

  totalEditorHoras(): number {
    return (this.horasEditor?.filas || []).reduce((s, f) => s + (Number(f.horas) || 0), 0);
  }

  guardarHoras(): void {
    if (!this.horasEditor) return;
    const horas = this.horasEditor.filas
      .filter((f) => f.fecha && Number(f.horas) > 0)
      .map((f) => ({ fecha: f.fecha, horas: Number(f.horas) }));
    this.guardandoHoras = true;
    this.gpi.guardarHoras(this.horasEditor.id_asignacion, horas).subscribe({
      next: () => {
        this.guardandoHoras = false;
        this.horasEditor = null;
        this.swal.exito('Horas guardadas');
        this.cargarAsignaciones();
        this.cargarActividades();
      },
      error: (e) => {
        this.guardandoHoras = false;
        this.swal.error('No se pudieron guardar', this.msg(e));
      },
    });
  }

  /* ==================== Proyecto ==================== */
  cambiarEstadoProyecto(estado: string): void {
    this.gpi.actualizarProyecto(this.id, { estado }).subscribe({
      next: () => this.cargar(),
      error: (e) => this.swal.error('No se pudo actualizar', this.msg(e)),
    });
  }

  volver(): void {
    this.router.navigate(['/gpi/proyectos']);
  }

  /* ==================== Programación y nivelación ==================== */
  programarProyecto(): void {
    this.programando = true;
    this.swal.cargando('Programando fechas…');
    this.gpi.programar(this.id).subscribe({
      next: (r) => {
        this.swal.cerrar();
        this.programando = false;
        this.swal.exito('Programación aplicada', `${r.programadas} actividad(es) reprogramadas según el calendario.`);
        this.cargar();
      },
      error: (e) => {
        this.swal.cerrar();
        this.programando = false;
        this.swal.error('No se pudo programar', this.msg(e));
      },
    });
  }

  nivelarProyecto(): void {
    this.nivelando = true;
    this.swal.cargando('Nivelando recursos…');
    this.gpi.nivelar(this.id).subscribe({
      next: (r) => {
        this.swal.cerrar();
        this.nivelando = false;
        this.swal.exito('Nivelación aplicada', `${r.totalBloques} bloque(s) de horas redistribuidos por capacidad.`);
        this.cargar();
        this.cargarAsignaciones();
      },
      error: (e) => {
        this.swal.cerrar();
        this.nivelando = false;
        this.swal.error('No se pudo nivelar', this.msg(e));
      },
    });
  }

  guardarLineaBase(): void {
    this.guardandoBase = true;
    this.swal.cargando('Guardando línea base…');
    this.gpi.guardarBaseline(this.id).subscribe({
      next: () => {
        this.swal.cerrar();
        this.guardandoBase = false;
        this.swal.exito('Línea base guardada', 'Las fechas y horas actuales quedaron como referencia.');
        this.cargar();
      },
      error: (e) => {
        this.swal.cerrar();
        this.guardandoBase = false;
        this.swal.error('No se pudo guardar la línea base', this.msg(e));
      },
    });
  }

  /* ==================== Pestañas ==================== */
  cambiarTab(t: 'equipo' | 'actividades' | 'asignaciones' | 'gantt' | 'partes' | 'carga' | 'calendario'): void {
    this.tab = t;
    if (t === 'partes') this.cargarPartes();
    this.actualizarAyudaContexto();
  }

  ngOnDestroy(): void {
    this.ayudaCtx.clear();
  }

  /** La ayuda en linea sigue la pestaña activa (GPI/<pagina>). */
  private actualizarAyudaContexto(): void {
    const mapa: Record<string, string> = {
      equipo: 'proyectos',
      actividades: 'actividades',
      asignaciones: 'asignaciones',
      gantt: 'gantt',
      partes: 'partes_horas',
      carga: 'carga',
      calendario: 'calendario',
    };
    this.ayudaCtx.set('GPI', mapa[this.tab] || 'proyectos');
  }

  /* ==================== Partes de horas (real) ==================== */
  cargarPartes(): void {
    this.gpi.listarPartesHoras({ proyectoId: this.id }).subscribe({ next: (p) => (this.partes = p), error: () => {} });
  }

  crearParte(): void {
    if (!this.parteForm.idAsignacion) {
      this.swal.advertencia('Seleccione una asignación');
      return;
    }
    const horas = Number(this.parteForm.horas) || 0;
    if (horas <= 0) {
      this.swal.advertencia('Indique las horas trabajadas');
      return;
    }
    const payload: any = {
      idAsignacion: Number(this.parteForm.idAsignacion),
      fecha: this.parteForm.fecha,
      horas,
    };
    if (this.parteForm.descripcion?.trim()) payload.descripcion = this.parteForm.descripcion.trim();
    this.gpi.crearParteHora(payload).subscribe({
      next: () => {
        this.swal.exito('Parte registrado');
        this.parteForm.horas = 0;
        this.parteForm.descripcion = '';
        this.cargarPartes();
      },
      error: (e) => this.swal.error('No se pudo registrar', this.msg(e)),
    });
  }

  aprobarParte(p: any): void {
    this.gpi.aprobarParteHora(p.id).subscribe({
      next: () => {
        this.swal.exito('Parte aprobado');
        this.cargarPartes();
      },
      error: (e) => this.swal.error('No se pudo aprobar', this.msg(e)),
    });
  }

  etiquetaEstado(e: string): string {
    return { planificado: 'Planificado', en_ejecucion: 'En ejecución', en_pausa: 'En pausa', cerrado: 'Cerrado', cancelado: 'Cancelado' }[e] || e;
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
