import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TicketCatalogoCategoria {
  id: number;
  nombre: string;
  codigo?: string | null;
  padreId?: number | null;
  activo?: boolean;
}

export interface TicketCatalogoGrupo {
  id: number;
  nombre: string;
  nivel: number;
}

export interface TicketAgente {
  id: number;
  username: string;
  rol: string;
}

/** Caso sin atender por mas de N horas laborables. */
export interface CasoAlerta {
  id: number;
  number: string;
  title: string;
  priority: string;
  state: string;
  requester_name: string | null;
  assignee_id: number | null;
  responsable: string;
  created_at: string;
  fechaLimite: string;
  horasTranscurridas: number;
}

/** Usuario de MantisBT (miembro de un proyecto). */
export interface MantisUsuario {
  id: number;
  name: string;
  real_name?: string;
  email?: string;
}

/** Campo personalizado obligatorio de un proyecto de Mantis (p. ej. «MODULOS ERP»). */
export interface MantisCampo {
  id: number;
  name: string;
  requireReport: boolean;
  possibleValues: string[];
}

/** Comentario (nota) de una incidencia de Mantis. */
export interface MantisNota {
  id: number;
  autor: string;
  fecha: string | null;
  texto: string;
  publico: boolean;
}

/** Estado actual de la incidencia asociada al ticket. */
export interface MantisEstado {  issueId: number;
  url: string | null;
  resumen: string;
  status: { id: number; name: string; label: string } | null;
  resolucion: { id: number; name: string; label: string } | null;
  responsable: string | null;
  informador: string | null;
  creadoAt: string | null;
  actualizadoAt: string | null;
  cerrado: boolean;
  resuelto: boolean;
  totalNotas: number;
  notas: MantisNota[];
}

export interface TicketPoliticaSla {
  id: number;
  nombre: string;
  prioridad: string;
  minutos_respuesta: number;
  minutos_resolucion: number;
}

export interface Ticket {
  id: number;
  number: string;
  type: string;
  state: string;
  title: string;
  description: string;
  categoryId: number | null;
  categoryNombre: string | null;
  categoryCodigo: string | null;
  groupId: number | null;
  groupNombre: string | null;
  requesterName: string;
  requesterEmail: string | null;
  idClient: number | null;
  clientName: string | null;
  clientRif: string | null;
  mantisIssueId: number | null;
  mantisUrl: string | null;
  mantisCerrado?: boolean;
  clientMantisProyect: number | null;
  assigneeId: number | null;
  assigneeNombre: string | null;
  impact: string;
  urgency: string;
  priority: string;
  priorityOverridden: boolean;
  channel: string;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  slaResponseBreached: boolean;
  slaResolutionBreached: boolean;
  reopenCount: number;
  holdReason: string | null;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  slaVencido: boolean;
  slaPorVencer: boolean;
}

export interface TicketMensaje {
  id: number;
  body: string;
  is_internal: boolean;
  created_at: string;
  author_id?: number | null;
  author_name: string;
  author_rol?: string;
}

export interface TicketAdjunto {
  id: number;
  filename: string;
  mimetype: string;
  size_bytes: number;
  created_at: string;
  uploaded_by_name?: string;
}

export interface TicketHistorial {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_name: string;
}

export interface TicketDetalle extends Ticket {
  mensajes: TicketMensaje[];
  adjuntos: TicketAdjunto[];
  historial: TicketHistorial[];
}

export interface TicketResumen {
  data: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
}

export interface TicketStats {
  resumen: {
    total: number;
    abiertos: number;
    sin_asignar: number;
    vencidos: number;
    reabiertos: number;
  };
  porEstado: Array<{ state: string; total: number }>;
  porPrioridad: Array<{ priority: string; total: number }>;
  porModulo: Array<{ categoryId: number | null; modulo: string; total: number; abiertos: number; cerrados: number }>;
}

export interface TicketCatalogos {
  categorias: TicketCatalogoCategoria[];
  grupos: TicketCatalogoGrupo[];
  agentes: TicketAgente[];
  politicas: TicketPoliticaSla[];
}

/** Dashboard de Mantis (espejo local). */
export interface MantisDashboard {
  rango: { desde: string; hasta: string };
  sincronizacion: { ultimaSync: string | null; detalle: string | null };
  kpis: {
    total: number;
    abiertos: number;
    cerrados: number;
    sinAsignar: number;
    sinResponsable: number;
    mttrDias: number | null;
    primeraRespuestaDias: number | null;
    cierreDias: number | null;
  };
  tiempos: {
    resolucion: { casos: number; promedioDias: number | null; medianaDias: number | null; p90Dias: number | null };
    primeraRespuesta: { casos: number; promedioDias: number | null; medianaDias: number | null };
    cierre: { casos: number; promedioDias: number | null; medianaDias: number | null };
  };
  porProyecto: Array<{ proyectoId: number | null; proyecto: string; total: number; abiertos: number; cerrados: number }>;
  porEstado: Array<{ estadoId?: number; estado: string; total: number }>;
  porUsuarioAbiertos: Array<{ usuarioId: number | null; usuario: string; abiertos: number; sinAsignar: number }>;
  porUsuario: Array<{ usuarioId: number | null; usuario: string; total: number; abiertos: number }>;
  porInformador: Array<{ usuarioId: number | null; usuario: string; total: number; abiertos: number }>;
  porMes: Array<{ mes: string; recibidos: number; resueltos: number; cerrados: number; mttrDias: number | null }>;
  reapertura: {
    total: number;
    reabiertos: number;
    unaVez: number;
    dosOMas: number;
    maxReaperturas: number;
    tasa: number;
  };
  antiguedad: Array<{ rango: string; total: number }>;
  porCategoria: Array<{ categoria: string; total: number }>;
  porPrioridad: Array<{ prioridad: string; total: number }>;
  porResolucion: Array<{ resolucion: string; total: number }>;
  estancados: {
    dias: number;
    total: number;
    masAntiguo: string | null;
    casos: Array<{
      id: number;
      summary: string;
      projectName: string | null;
      statusName: string | null;
      responsable: string;
      createdAt: string | null;
      updatedAt: string | null;
      diasSinCambios: number;
    }>;
  };
}

export interface FiltrosDashboardUi {
  desde?: string;
  hasta?: string;
  projectId?: number;
  handlerId?: number;
  reporterId?: number;
  statusId?: number;
  /** Estatus a excluir del resultado. */
  excluirStatusIds?: number[];
  /** Si es true, solo casos abiertos (excluye Resolved y Closed). */
  soloAbiertos?: boolean;
  /** Reaperturas: 'si' (>0), '1' (=1) o '2mas' (>=2). */
  reopened?: string;
  estancadosDias?: number;
}

/** Caso de Mantis del espejo local (listado filtrable). */
export interface MantisCaso {
  id: number;
  summary: string;
  project_name: string | null;
  status_name: string | null;
  priority_name: string | null;
  severity_name: string | null;
  handler_name: string | null;
  reporter_name: string | null;
  created_at: string | null;
  acknowledged_at: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
}

/** Etapa del recorrido de un caso (timeline de estados). */
export interface MantisSeguimientoEtapa {
  etapa: number;
  estado: string;
  inicio: string | null;
  fin: string | null;
  duracionDias: number;
  informador: string | null;
  responsable: string | null;
}

export interface MantisSeguimientoNota {
  id: number;
  autor: string;
  fecha: string | null;
  texto: string;
}

/** Recorrido paso a paso de un caso de Mantis. */
export interface MantisSeguimiento {
  id: number;
  summary: string;
  project: { id: number; name: string } | null;
  status: { id: number; name: string; label?: string } | null;
  priority: { id: number; name: string } | null;
  severity: { id: number; name: string } | null;
  handler: MantisUsuario | null;
  reporter: MantisUsuario | null;
  created_at: string | null;
  updated_at: string | null;
  timeline: MantisSeguimientoEtapa[];
  notas: MantisSeguimientoNota[];
  totalDias: number | null;
}

export interface MantisSyncEstado {
  sincronizando: boolean;
  ultimaSync: string | null;
  ultimaFila: string | null;
  casos: number;
  detalle: string | null;
}

@Injectable({ providedIn: 'root' })
export class SoporteService {
  private api = `${environment.apiUrl}/soporte`;

  constructor(private http: HttpClient) {}

  catalogo(): Observable<TicketCatalogos> {
    return this.http.get<TicketCatalogos>(`${this.api}/catalogs`);
  }

  stats(): Observable<TicketStats> {
    return this.http.get<TicketStats>(`${this.api}/stats`);
  }

  /* ==================== Alertas de casos sin atender ==================== */

  alertasSinAtender(): Observable<CasoAlerta[]> {
    return this.http.get<CasoAlerta[]>(`${this.api}/alertas/sin-atender`);
  }

  alertasResumen(): Observable<{ total: number; horas: number }> {
    return this.http.get<{ total: number; horas: number }>(`${this.api}/alertas/resumen`);
  }

  enviarAlerta(): Observable<{
    nuevos: number;
    enviado: boolean;
    simulado: boolean;
    destinatarios: string;
    casos: number;
  }> {
    return this.http.post<any>(`${this.api}/alertas/enviar`, {});
  }

  listar(filtros: any = {}): Observable<TicketResumen> {
    const params: any = {};
    if (filtros.search) params.search = filtros.search;
    if (filtros.state) params.state = filtros.state;
    if (filtros.priority) params.priority = filtros.priority;
    if (filtros.type) params.type = filtros.type;
    if (filtros.groupId != null) params.groupId = filtros.groupId;
    if (filtros.assigneeId != null) params.assigneeId = filtros.assigneeId;
    if (filtros.categoryId != null) params.categoryId = filtros.categoryId;
    if (filtros.soloMios) params.soloMios = true;
    if (filtros.slaEnRiesgo) params.slaEnRiesgo = true;
    if (filtros.page) params.page = filtros.page;
    if (filtros.limit) params.limit = filtros.limit;
    return this.http.get<TicketResumen>(`${this.api}/tickets`, { params });
  }

  obtener(id: number): Observable<TicketDetalle> {
    return this.http.get<TicketDetalle>(`${this.api}/tickets/${id}`);
  }

  crear(payload: any): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.api}/tickets`, payload);
  }

  actualizar(id: number, payload: any): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.api}/tickets/${id}`, payload);
  }

  asignar(id: number, payload: any): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.api}/tickets/${id}/assign`, payload);
  }

  forzarPrioridad(id: number, payload: any): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.api}/tickets/${id}/priority`, payload);
  }

  cambiarEstado(id: number, payload: any): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.api}/tickets/${id}/state`, payload);
  }

  /** Envía la incidencia a MantisBT (acción manual). */
  enviarAMantis(id: number, payload: any = {}): Observable<any> {
    return this.http.post<any>(`${this.api}/tickets/${id}/mantis`, payload);
  }

  /** Usuarios de Mantis con acceso a un proyecto (para asignar el responsable). */
  usuariosMantis(
    proyectoId: number,
  ): Observable<{
    proyecto: { id: number; name: string; customFields?: MantisCampo[] };
    usuarios: MantisUsuario[];
  }> {
    return this.http.get<any>(`${this.api}/mantis/proyecto/${proyectoId}/usuarios`);
  }

  /** Estado y comentarios actuales del caso en Mantis (botón «Sincronizar»). */
  estadoMantis(id: number): Observable<MantisEstado> {
    return this.http.get<MantisEstado>(`${this.api}/tickets/${id}/mantis/estado`);
  }

  /** Envía la carta formal de cierre al cliente por correo. */
  notificarCliente(id: number, payload: any = {}): Observable<any> {
    return this.http.post<any>(`${this.api}/tickets/${id}/notificar`, payload);
  }

  /**
   * Cierra el ticket porque el caso está cerrado en Mantis: crea la
   * conversación de cierre, cierra el ticket y notifica al cliente.
   */
  cerrarDesdeMantis(
    id: number,
    payload: {
      mensaje?: string;
      incluirConversacion?: boolean;
      notificar?: boolean;
      destinatario?: string;
      resolutionCode?: string;
      resolutionNotes?: string;
    } = {},
  ): Observable<any> {
    return this.http.post<any>(`${this.api}/tickets/${id}/cerrar-desde-mantis`, payload);
  }

  /** Envía los documentos adjuntos de la incidencia por correo a calidad. */
  enviarCorreoIncidencia(
    id: number,
    payload: { destinatario?: string; mensaje?: string; incluirConversacion?: boolean } = {},
  ): Observable<any> {
    return this.http.post<any>(`${this.api}/tickets/${id}/enviar-correo`, payload);
  }

  /** Envía manualmente el seguimiento (solo comentarios públicos) al cliente. */
  enviarSeguimiento(
    id: number,
    payload: {
      destinatario?: string;
      mensajeIds?: number[];
      mensaje?: string;
      incluirAdjuntos?: boolean;
      previsualizar?: boolean;
    },
  ): Observable<any> {
    return this.http.post<any>(`${this.api}/tickets/${id}/enviar-seguimiento`, payload);
  }

  /* ==================== Dashboard de Mantis (espejo local) ==================== */

  /** KPIs de Mantis por rango de fechas, proyecto y responsable. */
  dashboardMantis(filtros: FiltrosDashboardUi = {}): Observable<MantisDashboard> {
    return this.http.get<MantisDashboard>(`${this.api}/mantis/dashboard`, {
      params: this.paramsMantis(filtros) as any,
    });
  }

  /** Estado del espejo local (última sincronización, casos). */
  estadoSyncMantis(): Observable<MantisSyncEstado> {
    return this.http.get<MantisSyncEstado>(`${this.api}/mantis/sincronizar/estado`);
  }

  /** Lanza la sincronización del espejo con Mantis (segundo plano). */
  sincronizarMantis(): Observable<{ iniciado: boolean; mensaje: string }> {
    return this.http.post<{ iniciado: boolean; mensaje: string }>(`${this.api}/mantis/sincronizar`, {});
  }

  /** Descarga el CSV: `casos` (detalle) o `resumen` (KPIs). */
  exportarMantis(filtros: FiltrosDashboardUi = {}, tipo: 'casos' | 'resumen' = 'casos'): Observable<Blob> {
    const params = this.paramsMantis(filtros);
    params.tipo = tipo;
    return this.http.get(`${this.api}/mantis/export`, { params: params as any, responseType: 'blob' });
  }

  /** Reporte PDF de casos (con o sin comentarios). */
  reportePdfMantis(filtros: FiltrosDashboardUi & { conDetalle?: boolean } = {}): Observable<Blob> {
    const params = this.paramsMantis(filtros);
    if (filtros.conDetalle === true) params.conDetalle = '1';
    return this.http.get(`${this.api}/mantis/reporte/pdf`, { params: params as any, responseType: 'blob' });
  }

  /** Envía por correo el reporte PDF de casos (con o sin comentarios). */
  enviarReportePdfMantis(
    filtros: FiltrosDashboardUi & { conDetalle?: boolean; destinatario?: string } = {},
  ): Observable<any> {
    return this.http.post<any>(`${this.api}/mantis/reporte/pdf/enviar`, filtros);
  }

  /** Envía por correo la alerta de casos estancados. */
  alertaEstancados(filtros: FiltrosDashboardUi & { destinatario?: string } = {}): Observable<any> {
    return this.http.post<any>(`${this.api}/mantis/alertas/estancados`, filtros);
  }

  /** Listado paginado de casos del espejo (reporte por usuario/proyecto/estado/rango). */
  listarCasosMantis(
    filtros: FiltrosDashboardUi & { limit?: number; offset?: number } = {},
  ): Observable<{ total: number; casos: MantisCaso[]; rango: { desde: string; hasta: string } }> {
    const params: any = this.paramsMantis(filtros);
    if (filtros.limit != null) params.limit = filtros.limit;
    if (filtros.offset != null) params.offset = filtros.offset;
    return this.http.get<{ total: number; casos: MantisCaso[]; rango: { desde: string; hasta: string } }>(
      `${this.api}/mantis/casos`,
      { params },
    );
  }

  /** Recorrido paso a paso de un caso (timeline de estados) en vivo desde Mantis. */
  seguimientoCaso(id: number): Observable<MantisSeguimiento> {
    return this.http.get<MantisSeguimiento>(`${this.api}/mantis/issue/${id}`);
  }

  private paramsMantis(f: FiltrosDashboardUi): any {
    const params: any = {};
    if (f.desde) params.desde = f.desde;
    if (f.hasta) params.hasta = f.hasta;
    if (f.projectId) params.projectId = f.projectId;
    if (f.handlerId) params.handlerId = f.handlerId;
    if (f.reporterId) params.reporterId = f.reporterId;
    if (f.statusId) params.statusId = f.statusId;
    if (f.excluirStatusIds && f.excluirStatusIds.length) {
      params.excluirStatusIds = f.excluirStatusIds.join(',');
    }
    if (f.soloAbiertos) params.soloAbiertos = '1';
    if (f.reopened) params.reopened = f.reopened;
    if (f.estancadosDias) params.estancadosDias = f.estancadosDias;
    return params;
  }

  agregarMensaje(id: number, payload: any): Observable<any> {
    return this.http.post<any>(`${this.api}/tickets/${id}/messages`, payload);
  }

  /** Elimina (baja logica) un comentario del ticket. */
  eliminarMensaje(id: number, mensajeId: number): Observable<any> {
    return this.http.delete<any>(`${this.api}/tickets/${id}/messages/${mensajeId}`);
  }

  subirAdjuntos(id: number, archivos: File[]): Observable<any[]> {
    const formData = new FormData();
    for (const archivo of archivos) {
      formData.append('archivos', archivo, archivo.name);
    }
    return this.http.post<any[]>(`${this.api}/tickets/${id}/attachments`, formData);
  }

  descargarAdjunto(id: number, adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.api}/tickets/${id}/attachments/${adjuntoId}`, {
      responseType: 'blob',
    });
  }

  eliminarAdjunto(id: number, adjuntoId: number): Observable<any> {
    return this.http.delete(`${this.api}/tickets/${id}/attachments/${adjuntoId}`);
  }
}