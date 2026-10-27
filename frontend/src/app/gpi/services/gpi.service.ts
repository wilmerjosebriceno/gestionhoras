import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GpiProyecto {
  id_proyecto: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  estado: string;
  prioridad: number;
  fecha_ini_plan?: string | null;
  fecha_fin_plan?: string | null;
  fecha_ini_real?: string | null;
  fecha_fin_real?: string | null;
  horas_estimadas: number;
  horas_reales: number;
  avance_pct: number;
  id_gerente?: number | null;
  gerente_nombre?: string | null;
  actividades?: number;
  miembros?: number;
}

export interface GpiRecurso {
  id_recurso: number;
  id_usuario?: number | null;
  nombre: string;
  email?: string | null;
  cargo?: string | null;
  tipo: string;
  area?: string | null;
  capacidad_semanal: number;
  tarifa_hora?: number | null;
  activo: boolean;
}

export interface GpiRol {
  id_rol: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface GpiMiembro {
  id_miembro: number;
  id_proyecto: number;
  id_recurso: number;
  id_rol?: number | null;
  dedicacion_pct: number;
  horas_asignadas: number;
  fecha_alta?: string | null;
  fecha_baja?: string | null;
  activo: boolean;
  recurso_nombre: string;
  recurso_tipo?: string | null;
  rol_nombre?: string | null;
}

export interface GpiActividad {
  id_actividad: number;
  id_proyecto: number;
  id_padre?: number | null;
  codigo_wbs?: string | null;
  nombre: string;
  descripcion?: string | null;
  tipo: string;
  id_responsable?: number | null;
  estado: string;
  prioridad: number;
  fecha_ini_plan?: string | null;
  fecha_fin_plan?: string | null;
  fecha_ini_real?: string | null;
  fecha_fin_real?: string | null;
  fecha_ini_base?: string | null;
  fecha_fin_base?: string | null;
  horas_base?: number | null;
  horas_estimadas: number;
  horas_reales: number;
  avance_pct: number;
  orden: number;
  responsable_nombre?: string | null;
  horas_asignadas?: number;
}

export interface GpiAsignacion {
  id_asignacion: number;
  id_actividad: number;
  id_miembro: number;
  horas_estimadas: number;
  fecha_ini?: string | null;
  fecha_fin?: string | null;
  porcentaje?: number | null;
  activo: boolean;
  actividad_nombre: string;
  id_proyecto: number;
  id_recurso: number;
  recurso_nombre: string;
  horas_distribuidas: number;
}

export interface GpiAsignacionHora {
  id: number;
  id_asignacion: number;
  fecha: string;
  horas_estimadas: number;
}

@Injectable({ providedIn: 'root' })
export class GpiService {
  private api = `${environment.apiUrl}/gpi`;

  constructor(private readonly http: HttpClient) {}

  catalogos(): Observable<{ recursos: GpiRecurso[]; roles: GpiRol[] }> {
    return this.http.get<{ recursos: GpiRecurso[]; roles: GpiRol[] }>(`${this.api}/catalogos`);
  }

  /* Proyectos */
  listarProyectos(filtros: any = {}): Observable<{ data: GpiProyecto[]; total: number; totalPaginas: number }> {
    const params: any = {};
    if (filtros.search) params.search = filtros.search;
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.page) params.page = filtros.page;
    if (filtros.limit) params.limit = filtros.limit;
    return this.http.get<any>(`${this.api}/proyectos`, { params });
  }
  obtenerProyecto(id: number): Observable<GpiProyecto> {
    return this.http.get<GpiProyecto>(`${this.api}/proyectos/${id}`);
  }
  crearProyecto(payload: any): Observable<any> {
    return this.http.post(`${this.api}/proyectos`, payload);
  }
  actualizarProyecto(id: number, payload: any): Observable<any> {
    return this.http.patch(`${this.api}/proyectos/${id}`, payload);
  }
  eliminarProyecto(id: number): Observable<any> {
    return this.http.delete(`${this.api}/proyectos/${id}`);
  }

  /* Miembros */
  listarMiembros(idProyecto: number): Observable<GpiMiembro[]> {
    return this.http.get<GpiMiembro[]>(`${this.api}/proyectos/${idProyecto}/miembros`);
  }
  crearMiembro(idProyecto: number, payload: any): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${idProyecto}/miembros`, payload);
  }
  eliminarMiembro(id: number): Observable<any> {
    return this.http.delete(`${this.api}/miembros/${id}`);
  }

  /* Recursos */
  listarRecursos(): Observable<GpiRecurso[]> {
    return this.http.get<GpiRecurso[]>(`${this.api}/recursos`);
  }
  crearRecurso(payload: any): Observable<any> {
    return this.http.post(`${this.api}/recursos`, payload);
  }
  actualizarRecurso(id: number, payload: any): Observable<any> {
    return this.http.patch(`${this.api}/recursos/${id}`, payload);
  }
  eliminarRecurso(id: number): Observable<any> {
    return this.http.delete(`${this.api}/recursos/${id}`);
  }

  /* Roles */
  listarRoles(): Observable<GpiRol[]> {
    return this.http.get<GpiRol[]>(`${this.api}/roles`);
  }
  crearRol(payload: any): Observable<any> {
    return this.http.post(`${this.api}/roles`, payload);
  }

  /* Actividades */
  listarActividades(proyectoId: number): Observable<GpiActividad[]> {
    return this.http.get<GpiActividad[]>(`${this.api}/actividades`, { params: { proyectoId } });
  }
  crearActividad(payload: any): Observable<any> {
    return this.http.post(`${this.api}/actividades`, payload);
  }
  actualizarActividad(id: number, payload: any): Observable<any> {
    return this.http.patch(`${this.api}/actividades/${id}`, payload);
  }
  eliminarActividad(id: number): Observable<any> {
    return this.http.delete(`${this.api}/actividades/${id}`);
  }

  /* Dependencias */
  listarDependencias(proyectoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dependencias`, { params: { proyectoId } });
  }
  crearDependencia(payload: any): Observable<any> {
    return this.http.post(`${this.api}/dependencias`, payload);
  }
  eliminarDependencia(id: number): Observable<any> {
    return this.http.delete(`${this.api}/dependencias/${id}`);
  }

  /* Asignaciones */
  listarAsignaciones(filtros: any = {}): Observable<GpiAsignacion[]> {
    const params: any = {};
    if (filtros.proyectoId) params.proyectoId = filtros.proyectoId;
    if (filtros.actividadId) params.actividadId = filtros.actividadId;
    return this.http.get<GpiAsignacion[]>(`${this.api}/asignaciones`, { params });
  }
  crearAsignacion(payload: any): Observable<any> {
    return this.http.post(`${this.api}/asignaciones`, payload);
  }
  actualizarAsignacion(id: number, payload: any): Observable<any> {
    return this.http.patch(`${this.api}/asignaciones/${id}`, payload);
  }
  eliminarAsignacion(id: number): Observable<any> {
    return this.http.delete(`${this.api}/asignaciones/${id}`);
  }
  obtenerHoras(id: number): Observable<GpiAsignacionHora[]> {
    return this.http.get<GpiAsignacionHora[]>(`${this.api}/asignaciones/${id}/horas`);
  }
  guardarHoras(id: number, horas: Array<{ fecha: string; horas: number }>): Observable<GpiAsignacionHora[]> {
    return this.http.put<GpiAsignacionHora[]>(`${this.api}/asignaciones/${id}/horas`, { horas });
  }

  /* Partes de horas */
  listarPartesHoras(filtros: any = {}): Observable<any[]> {
    const params: any = {};
    if (filtros.proyectoId) params.proyectoId = filtros.proyectoId;
    if (filtros.asignacionId) params.asignacionId = filtros.asignacionId;
    return this.http.get<any[]>(`${this.api}/partes-horas`, { params });
  }
  crearParteHora(payload: any): Observable<any> {
    return this.http.post(`${this.api}/partes-horas`, payload);
  }
  aprobarParteHora(id: number): Observable<any> {
    return this.http.post(`${this.api}/partes-horas/${id}/aprobar`, {});
  }

  /* Vistas */
  gantt(id: number): Observable<any> {
    return this.http.get<any>(`${this.api}/proyectos/${id}/gantt`);
  }
  carga(id: number, desde?: string, hasta?: string): Observable<any[]> {
    const params: any = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    return this.http.get<any[]>(`${this.api}/proyectos/${id}/carga`, { params });
  }

  /* Calendario */
  listarCalendarios(proyectoId?: number): Observable<any[]> {
    const params: any = {};
    if (proyectoId) params.proyectoId = proyectoId;
    return this.http.get<any[]>(`${this.api}/calendario`, { params });
  }
  crearCalendario(payload: any): Observable<any> {
    return this.http.post(`${this.api}/calendario`, payload);
  }
  listarExcepciones(idCalendario: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/calendario/${idCalendario}/excepciones`);
  }
  crearExcepcion(idCalendario: number, payload: any): Observable<any> {
    return this.http.post(`${this.api}/calendario/${idCalendario}/excepciones`, payload);
  }
  eliminarExcepcion(id: number): Observable<any> {
    return this.http.delete(`${this.api}/calendario/excepciones/${id}`);
  }

  /* Programacion y nivelacion */
  programar(id: number, fechaInicio?: string): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${id}/programar`, { fechaInicio: fechaInicio || undefined });
  }
  nivelar(id: number): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${id}/nivelar`, {});
  }

  /* Linea base */
  guardarBaseline(id: number): Observable<any> {
    return this.http.post(`${this.api}/proyectos/${id}/baseline`, {});
  }

  /* Dashboard */
  dashboard(): Observable<any> {
    return this.http.get<any>(`${this.api}/dashboard`);
  }
}
