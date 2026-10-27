import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ScrinConfig {
  idUser: number;
  login: string;
  nameUser: string;
  scrinCompanyId: number | null;
  scrinEmploymentId: number | null;
  hasToken: boolean;
  tokenPreview: string | null;
  configurado: boolean;
}

export interface ScrinConfigDto {
  scrinCompanyId?: number;
  scrinEmploymentId?: number;
  scrinToken?: string;
}

export interface MonitorActivity {
  idScrinActivity: number;
  idUser?: number;
  activityId: string;
  employeeId?: number;
  employeeName?: string;
  scrinProjectId?: string;
  scrinProjectName?: string;
  fromTs?: number;
  toTs?: number;
  dateActivity?: string;
  hourIni?: string;
  hourFin?: string;
  durationMinutes: number;
  offline: number;
  note?: string;
  selected: number;
  syncStatus: number;
  idProyect?: number;
  idScrinSummary?: number;
  idActivity?: number;
}

export interface MonitorSummary {
  idScrinSummary: number;
  scrinProjectId?: string;
  scrinProjectName?: string;
  dateFrom?: string;
  dateTo?: string;
  activitiesCount: number;
  totalMinutes: number;
  idProyect?: number;
  idClient?: number;
  idType?: number;
  idProcess?: number;
  idItemActivity?: number;
  note?: string;
  status: number;
  idActivity?: number;
  proyectoLabel?: string | null;
}

export interface FetchResult {
  from: string;
  to: string;
  fetched: number;
  inserted: number;
  duplicates: number;
}

export interface ConsultaScrinUsuario {
  idUser: number;
  login: string;
  nameUser: string;
  scrinConfigurado?: boolean;
  scrinCompanyId: number | null;
  scrinEmploymentId: number | null;
  tokenPreview: string | null;
}

export interface ConsultaFetchResultado {
  idUser: number;
  nameUser: string | null;
  ok: boolean;
  from?: string;
  to?: string;
  fetched?: number;
  inserted?: number;
  duplicates?: number;
  error?: string;
}

export interface ConsultaActividad extends MonitorActivity {
  userName?: string | null;
  proyectoLabel?: string | null;
  clienteLabel?: string | null;
}

export interface EmpleadoScrin {
  id: number;
  name: string;
  companyId: number;
  company: string;
}

/** Resultado de "Probar conexión" (validación en vivo contra Scrin). */
export interface VerificacionScrin {
  veredicto: 'OK' | 'SIN_TOKEN' | 'SIN_ID' | 'TOKEN_INVALIDO' | 'ID_NO_EXISTE' | 'NOMBRE_NO_COINCIDE';
  mensaje: string;
  tokenOk?: boolean;
  duenoToken?: { id: number; name: string } | null;
  empresaToken?: string | null;
  idConfigurado?: number | null;
  empleadoConfigurado?: { id: number; name: string } | null;
  sugerido?: { id: number; name: string } | null;
  empleados: EmpleadoScrin[];
}

/** Resultado de "Consultar token": los IDs de empleado que expone un token. */
export interface ExploracionScrin {
  tokenOk: boolean;
  duenoToken?: { id: number; name: string } | null;
  empresas: Array<{ id: number; name: string }>;
  empleados: EmpleadoScrin[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class MonitorHorasService {
  private api = `${environment.apiUrl}/sgh/scrin/monitor`;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<ScrinConfig> {
    return this.http.get<ScrinConfig>(`${this.api}/config`);
  }

  saveConfig(dto: ScrinConfigDto): Observable<ScrinConfig> {
    return this.http.put<ScrinConfig>(`${this.api}/config`, dto);
  }

  /** Boton "Probar conexión": valida token e ID contra Scrin en vivo. */
  verificarConfig(dto: {
    scrinEmploymentId?: number;
    scrinToken?: string;
  }): Observable<VerificacionScrin> {
    return this.http.post<VerificacionScrin>(`${this.api}/config/verificar`, dto);
  }

  fetch(from: string, to: string): Observable<FetchResult> {
    return this.http.post<FetchResult>(`${this.api}/fetch`, { from, to });
  }

  listActivities(opts: { from?: string; to?: string; selected?: boolean; status?: number } = {}): Observable<MonitorActivity[]> {
    const params: Record<string, string> = {};
    if (opts.from) params['from'] = opts.from;
    if (opts.to) params['to'] = opts.to;
    if (opts.selected) params['selected'] = '1';
    if (opts.status !== undefined) params['status'] = String(opts.status);
    return this.http.get<MonitorActivity[]>(`${this.api}/activities`, { params });
  }

  check(id: number, selected: boolean): Observable<MonitorActivity> {
    return this.http.patch<MonitorActivity>(`${this.api}/activities/${id}/check`, {
      selected: selected ? 1 : 0,
    });
  }

  /** Checklist: marca/desmarca todos los pendientes en una sola peticion. */
  checkAll(
    selected: boolean,
    from?: string,
    to?: string,
  ): Observable<{ updated: number; selected: number }> {
    const body: Record<string, unknown> = { selected: selected ? 1 : 0 };
    if (from) body['from'] = from;
    if (to) body['to'] = to;
    return this.http.patch<{ updated: number; selected: number }>(
      `${this.api}/activities/check-all`,
      body,
    );
  }

  buildSummary(from: string, to: string): Observable<MonitorSummary[]> {
    return this.http.post<MonitorSummary[]>(`${this.api}/summary`, { from, to });
  }

  listSummary(from?: string, to?: string): Observable<MonitorSummary[]> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<MonitorSummary[]>(`${this.api}/summary`, { params });
  }

  assignSummary(
    id: number,
    dto: { idProyect: number; idType?: number; idProcess?: number; idItemActivity?: number; note?: string },
  ): Observable<MonitorSummary> {
    return this.http.put<MonitorSummary>(`${this.api}/summary/${id}/assign`, dto);
  }

  processSummary(id: number): Observable<{ summary: MonitorSummary; actividad: unknown }> {
    return this.http.post<{ summary: MonitorSummary; actividad: unknown }>(
      `${this.api}/summary/${id}/process`,
      {},
    );
  }

  /* ==================== CONSULTA MULTIUSUARIO (SOLO LECTURA) ==================== */

  consultaUsuarios(): Observable<ConsultaScrinUsuario[]> {
    return this.http.get<ConsultaScrinUsuario[]>(`${this.api}/consulta/usuarios`);
  }

  consultaFetch(
    idUsers: number[],
    from: string,
    to: string,
  ): Observable<{ resultados: ConsultaFetchResultado[] }> {
    return this.http.post<{ resultados: ConsultaFetchResultado[] }>(`${this.api}/consulta/fetch`, {
      idUsers,
      from,
      to,
    });
  }

  consultaActividades(idUsers: number[], from?: string, to?: string, syncStatus?: number): Observable<ConsultaActividad[]> {
    const params: Record<string, string> = {};
    if (idUsers.length) params['idUsers'] = idUsers.join(',');
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    if (syncStatus !== undefined) params['syncStatus'] = String(syncStatus);
    return this.http.get<ConsultaActividad[]>(`${this.api}/consulta/actividades`, { params });
  }
}
