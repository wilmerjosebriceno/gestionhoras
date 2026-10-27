import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Proceso,
  ItemActividad,
  Categoria,
  TipoActividad,
  Cliente,
  UsuarioSgh,
  EstructuraFila,
  Proyecto,
  ProyectoActividadRow,
  Actividad,
  ActividadAttachment,
  DetalleActividadRow,
  Fase,
  Seguimiento,
  Hito,
  PaginadoActividades,
} from '../models/sgh.models';
import type { VerificacionScrin, ExploracionScrin } from './monitor-horas.service';

@Injectable({ providedIn: 'root' })
export class SghService {
  private api = `${environment.apiUrl}/sgh`;

  constructor(private http: HttpClient) {}

  /* ==================== DASHBOARD ==================== */
  dashboardResumen(): Observable<{
    totalActividades: number;
    totalProyectos: number;
    totalHoras: number;
    totalFases: number;
  }> {
    return this.http.get<any>(`${this.api}/dashboard/resumen`);
  }

  dashboardClientesAnual(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/clientes-anual`);
  }

  dashboardClientesAnio(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/clientes-anio`);
  }

  dashboardUsuariosAnio(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/usuarios-anio`);
  }

  dashboardUsuariosFiscal(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/usuarios-fiscal`);
  }

  dashboardProyectos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/proyectos`);
  }

  dashboardAvanceFases(idProyect: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/dashboard/avance-fases/${idProyect}`);
  }

  /* ==================== PROCESOS ==================== */
  listProcesos(active?: number): Observable<Proceso[]> {
    return this.http.get<Proceso[]>(`${this.api}/procesos`, { params: this.param('active', active) });
  }

  createProceso(dto: Partial<Proceso>): Observable<Proceso> {
    return this.http.post<Proceso>(`${this.api}/procesos`, dto);
  }

  updateProceso(id: number, dto: Partial<Proceso>): Observable<Proceso> {
    return this.http.put<Proceso>(`${this.api}/procesos/${id}`, dto);
  }

  removeProceso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/procesos/${id}`);
  }

  /* ==================== ITEMS ==================== */
  listItems(active?: number): Observable<ItemActividad[]> {
    return this.http.get<ItemActividad[]>(`${this.api}/items`, { params: this.param('active', active) });
  }

  createItem(dto: Partial<ItemActividad>): Observable<ItemActividad> {
    return this.http.post<ItemActividad>(`${this.api}/items`, dto);
  }

  updateItem(id: number, dto: Partial<ItemActividad>): Observable<ItemActividad> {
    return this.http.put<ItemActividad>(`${this.api}/items/${id}`, dto);
  }

  removeItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/items/${id}`);
  }

  /* ==================== CATEGORÍAS ==================== */
  listCategorias(active?: number): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.api}/categorias`, { params: this.param('active', active) });
  }

  createCategoria(dto: Partial<Categoria>): Observable<Categoria> {
    return this.http.post<Categoria>(`${this.api}/categorias`, dto);
  }

  updateCategoria(id: number, dto: Partial<Categoria>): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.api}/categorias/${id}`, dto);
  }

  removeCategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/categorias/${id}`);
  }

  /* ==================== TIPOS ==================== */
  listTipos(active?: number): Observable<TipoActividad[]> {
    return this.http.get<TipoActividad[]>(`${this.api}/tipos`, { params: this.param('active', active) });
  }

  createTipo(dto: Partial<TipoActividad>): Observable<TipoActividad> {
    return this.http.post<TipoActividad>(`${this.api}/tipos`, dto);
  }

  updateTipo(id: number, dto: Partial<TipoActividad>): Observable<TipoActividad> {
    return this.http.put<TipoActividad>(`${this.api}/tipos/${id}`, dto);
  }

  removeTipo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/tipos/${id}`);
  }

  /* ==================== CLIENTES ==================== */
  listClientes(active?: number, filtro?: string): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(`${this.api}/clientes`, {
      params: { ...this.param('active', active), ...(filtro ? { filtro } : {}) },
    });
  }

  createCliente(dto: Partial<Cliente>): Observable<Cliente> {
    return this.http.post<Cliente>(`${this.api}/clientes`, dto);
  }

  updateCliente(id: number, dto: Partial<Cliente>): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.api}/clientes/${id}`, dto);
  }

  removeCliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/clientes/${id}`);
  }

  proyectosDelCliente(idClient: number): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(`${this.api}/clientes/${idClient}/proyectos`);
  }

  /* ==================== USUARIOS SGH ==================== */
  listUsuariosSgh(active?: number): Observable<UsuarioSgh[]> {
    return this.http.get<UsuarioSgh[]>(`${this.api}/usuarios`, { params: this.param('active', active) });
  }

  createUsuarioSgh(dto: Partial<UsuarioSgh>): Observable<UsuarioSgh> {
    return this.http.post<UsuarioSgh>(`${this.api}/usuarios`, dto);
  }

  updateUsuarioSgh(id: number, dto: Partial<UsuarioSgh>): Observable<UsuarioSgh> {
    return this.http.put<UsuarioSgh>(`${this.api}/usuarios/${id}`, dto);
  }

  removeUsuarioSgh(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/usuarios/${id}`);
  }

  /**
   * "Probar conexión" de Scrin para un usuario SGH (pantalla Usuarios SGH).
   * Valida el token y el ID contra Scrin en vivo. Solo administradores (rol A/S).
   */
  verificarScrinUsuario(
    id: number,
    dto: { scrinEmploymentId?: number; scrinToken?: string } = {},
  ): Observable<VerificacionScrin> {
    return this.http.post<VerificacionScrin>(
      `${this.api}/scrin/monitor/usuarios/${id}/verificar`,
      dto,
    );
  }

  /**
   * Consulta un token de Scrin y devuelve TODOS los IDs de empleado que expone.
   * Sirve para saber qué ID asignar a cada usuario (incluso con un token nuevo).
   * Solo administradores (rol A/S).
   */
  explorarTokenScrin(scrinToken: string): Observable<ExploracionScrin> {
    return this.http.post<ExploracionScrin>(`${this.api}/scrin/monitor/token/empleados`, {
      scrinToken,
    });
  }

  /* ==================== ESTRUCTURA ==================== */
  listEstructura(): Observable<EstructuraFila[]> {
    return this.http.get<EstructuraFila[]>(`${this.api}/estructura`);
  }

  itemsActivos(): Observable<ItemActividad[]> {
    return this.http.get<ItemActividad[]>(`${this.api}/estructura/items-activos`);
  }

  asignacionEstructura(idItemActivity: number): Observable<EstructuraFila[]> {
    return this.http.get<EstructuraFila[]>(`${this.api}/estructura/asignacion`, {
      params: { idItemActivity },
    });
  }

  guardarAsignacion(idItemActivity: number, asignaciones: EstructuraFila[]): Observable<any> {
    return this.http.post<any>(`${this.api}/estructura/asignacion`, { idItemActivity, asignaciones });
  }

  /* ==================== PROYECTOS ==================== */
  listProyectos(numdoc?: string, fecini?: string, fecfin?: string): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(`${this.api}/proyectos`, {
      params: { ...this.param('numdoc', numdoc), ...this.param('fecini', fecini), ...this.param('fecfin', fecfin) },
    });
  }

  getProyecto(id: number): Observable<Proyecto> {
    return this.http.get<Proyecto>(`${this.api}/proyectos/${id}`);
  }

  detalleProyecto(id: number, soloActivos?: boolean): Observable<ProyectoActividadRow[]> {
    return this.http.get<ProyectoActividadRow[]>(`${this.api}/proyectos/${id}/detalle`, {
      params: soloActivos ? { soloActivos: 1 } : {},
    });
  }

  actividadesDelProyecto(id: number): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.api}/proyectos/${id}/actividades`);
  }

  generarCronogramaProyecto(id: number): Observable<any> {
    return this.http.get<any>(`${this.api}/proyectos/${id}/cronograma/generar`);
  }

  createProyecto(dto: Partial<Proyecto> & { actividades?: ProyectoActividadRow[] }): Observable<Proyecto> {
    return this.http.post<Proyecto>(`${this.api}/proyectos`, dto);
  }

  updateProyecto(id: number, dto: Partial<Proyecto> & { actividades?: ProyectoActividadRow[] }): Observable<Proyecto> {
    return this.http.put<Proyecto>(`${this.api}/proyectos/${id}`, dto);
  }

  anularProyecto(id: number, motivo: string): Observable<any> {
    return this.http.post<any>(`${this.api}/proyectos/${id}/anular`, { motivo });
  }

  removeProyecto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/proyectos/${id}`);
  }

  /* ==================== ACTIVIDADES ==================== */
  listActividades(opciones?: {
    numdoc?: string;
    fecini?: string;
    fecfin?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PaginadoActividades> {
    const o = opciones ?? {};
    return this.http.get<PaginadoActividades>(`${this.api}/actividades`, {
      params: {
        ...this.param('numdoc', o.numdoc),
        ...this.param('fecini', o.fecini),
        ...this.param('fecfin', o.fecfin),
        ...this.param('page', o.page ?? 1),
        ...this.param('pageSize', o.pageSize ?? 50),
      },
    });
  }

  getActividad(id: number): Observable<Actividad> {
    return this.http.get<Actividad>(`${this.api}/actividades/${id}`);
  }

  createActividad(dto: Partial<Actividad> & { detalles?: DetalleActividadRow[] }): Observable<Actividad> {
    return this.http.post<Actividad>(`${this.api}/actividades`, dto);
  }

  updateActividad(id: number, dto: Partial<Actividad> & { detalles?: DetalleActividadRow[] }): Observable<Actividad> {
    return this.http.put<Actividad>(`${this.api}/actividades/${id}`, dto);
  }

  anularActividad(id: number, motivo: string): Observable<any> {
    return this.http.post<any>(`${this.api}/actividades/${id}/anular`, { motivo });
  }

  removeActividad(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/actividades/${id}`);
  }

  /* ==================== ADJUNTOS DE ACTIVIDAD ==================== */
  listAdjuntos(id: number): Observable<ActividadAttachment[]> {
    return this.http.get<ActividadAttachment[]>(`${this.api}/actividades/${id}/attachments`);
  }

  subirAdjuntos(id: number, archivos: File[]): Observable<ActividadAttachment[]> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('archivos', a, a.name));
    return this.http.post<ActividadAttachment[]>(`${this.api}/actividades/${id}/attachments`, fd);
  }

  descargarAdjunto(id: number, adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.api}/actividades/${id}/attachments/${adjuntoId}`, {
      responseType: 'blob',
    });
  }

  eliminarAdjunto(id: number, adjuntoId: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/actividades/${id}/attachments/${adjuntoId}`);
  }

  reporteActividades(params: {
    fecini?: string;
    fecfin?: string;
    idType?: number;
    idProcess?: number;
    idUser?: number;
    idClient?: number;
    online?: number;
  }): Observable<Actividad[]> {
    const q: Record<string, string> = {};
    if (params.fecini) q['fecini'] = params.fecini;
    if (params.fecfin) q['fecfin'] = params.fecfin;
    if (params.idType) q['idType'] = String(params.idType);
    if (params.idProcess) q['idProcess'] = String(params.idProcess);
    if (params.idUser) q['idUser'] = String(params.idUser);
    if (params.idClient) q['idClient'] = String(params.idClient);
    if (params.online === 0 || params.online === 1) q['online'] = String(params.online);
    return this.http.get<Actividad[]>(`${this.api}/actividades/reporte`, { params: q });
  }

  /** PDF del formato "INFORME DIARIO DE ACTIVIDADES" de una actividad. */
  pdfActividad(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/actividades/${id}/pdf`, { responseType: 'blob' });
  }

  /** PDF "GESTION PROYECTO": horas contratadas vs ejecutadas. */
  pdfProyecto(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/proyectos/${id}/pdf`, { responseType: 'blob' });
  }

  /** PDF del formato de habilitación de generación de tickets de la institución (cliente). */
  pdfFormatoHabilitacionCliente(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/clientes/${id}/formato-habilitacion/pdf`, {
      responseType: 'blob',
    });
  }

  /** Envía por correo el formato de habilitación (PDF) a la institución o a calidad. */
  enviarFormatoHabilitacionCliente(
    id: number,
    payload: { destinatario?: string; mensaje?: string } = {},
  ): Observable<any> {
    return this.http.post<any>(
      `${this.api}/clientes/${id}/formato-habilitacion/enviar-correo`,
      payload,
    );
  }

  /** PDF del reporte de actividades con los filtros indicados. */
  pdfReporte(params: {
    fecini?: string;
    fecfin?: string;
    idType?: number;
    idProcess?: number;
    idUser?: number;
    idClient?: number;
    online?: number;
  }): Observable<Blob> {
    const q: Record<string, string> = {};
    if (params.fecini) q['fecini'] = params.fecini;
    if (params.fecfin) q['fecfin'] = params.fecfin;
    if (params.idType) q['idType'] = String(params.idType);
    if (params.idProcess) q['idProcess'] = String(params.idProcess);
    if (params.idUser) q['idUser'] = String(params.idUser);
    if (params.idClient) q['idClient'] = String(params.idClient);
    if (params.online === 0 || params.online === 1) q['online'] = String(params.online);
    return this.http.get(`${this.api}/actividades/reporte/pdf`, { params: q, responseType: 'blob' });
  }

  /* ==================== LOGOS DE EMPRESA ==================== */
  listLogos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/logos`);
  }

  previewLogo(empresa: string): Observable<{ empresa: string; dataUri: string; nombre: string; existe: boolean }> {
    return this.http.get<any>(`${this.api}/logos/${empresa}/preview`);
  }

  uploadLogo(empresa: string, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<any>(`${this.api}/logos/${empresa}/upload`, form);
  }

  /* ==================== CRONOGRAMA ==================== */
  cronogramaProyecto(idProyect: number): Observable<{ numdoc?: string; responsable?: string; dateIni?: string; dateFin?: string; nameClient?: string }> {
    return this.http.get<any>(`${this.api}/cronograma/proyecto/${idProyect}`);
  }

  cronogramaFases(idProyect: number): Observable<Fase[]> {
    return this.http.get<Fase[]>(`${this.api}/cronograma/proyecto/${idProyect}/fases`);
  }

  updateFase(idCron: number, dto: Partial<Fase>): Observable<Fase> {
    return this.http.put<Fase>(`${this.api}/cronograma/fases/${idCron}`, dto);
  }

  seguimientoFase(idCron: number): Observable<Seguimiento[]> {
    return this.http.get<Seguimiento[]>(`${this.api}/cronograma/fases/${idCron}/seguimiento`);
  }

  registrarSeguimiento(dto: {
    idCron: number;
    idProyect: number;
    idUser: number;
    statusNew?: number;
    avanceNew: number;
    comentario?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.api}/cronograma/seguimiento`, dto);
  }

  hitosProyecto(idProyect: number): Observable<Hito[]> {
    return this.http.get<Hito[]>(`${this.api}/cronograma/proyecto/${idProyect}/hitos`);
  }

  createHito(dto: Partial<Hito>): Observable<Hito> {
    return this.http.post<Hito>(`${this.api}/cronograma/hitos`, dto);
  }

  updateHito(idHito: number, dto: Partial<Hito>): Observable<Hito> {
    return this.http.put<Hito>(`${this.api}/cronograma/hitos/${idHito}`, dto);
  }

  removeHito(idHito: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/cronograma/hitos/${idHito}`);
  }

  private param(name: string, value?: string | number): Record<string, string> {
    return value !== undefined && value !== null && value !== '' ? { [name]: String(value) } : {};
  }
}
