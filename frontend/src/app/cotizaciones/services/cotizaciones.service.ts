import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CotClient, CotRegion, CotTemplate, CotEmpresa, CotTasaIva, Budget, CotVencidas, CotRangoUsuario, CotTarifa } from '../models/cotizacion.model';

@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private api = `${environment.apiUrl}/cotizaciones`;

  constructor(private http: HttpClient) {}

  /* Clientes */
  listarClientes(q?: string): Observable<CotClient[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<CotClient[]>(`${this.api}/clientes`, { params });
  }
  crearCliente(dto: Partial<CotClient>): Observable<CotClient> {
    return this.http.post<CotClient>(`${this.api}/clientes`, dto);
  }
  actualizarCliente(id: number, dto: Partial<CotClient>): Observable<CotClient> {
    return this.http.put<CotClient>(`${this.api}/clientes/${id}`, dto);
  }
  eliminarCliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/clientes/${id}`);
  }
  sincronizarClientes(): Observable<{ insertados: number; actualizados: number }> {
    return this.http.post<{ insertados: number; actualizados: number }>(`${this.api}/clientes/sincronizar`, {});
  }

  /* Regiones */
  listarRegiones(incluirInactivos = false): Observable<CotRegion[]> {
    return this.http.get<CotRegion[]>(`${this.api}/regiones`, {
      params: incluirInactivos ? new HttpParams().set('incluirInactivos', 'true') : undefined,
    });
  }
  crearRegion(dto: Partial<CotRegion>): Observable<CotRegion> {
    return this.http.post<CotRegion>(`${this.api}/regiones`, dto);
  }
  actualizarRegion(id: number, dto: Partial<CotRegion>): Observable<CotRegion> {
    return this.http.put<CotRegion>(`${this.api}/regiones/${id}`, dto);
  }
  eliminarRegion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/regiones/${id}`);
  }

  /* Plantillas */
  listarPlantillas(): Observable<CotTemplate[]> {
    return this.http.get<CotTemplate[]>(`${this.api}/plantillas`);
  }
  crearPlantilla(dto: Partial<CotTemplate>): Observable<CotTemplate> {
    return this.http.post<CotTemplate>(`${this.api}/plantillas`, dto);
  }
  actualizarPlantilla(id: number, dto: Partial<CotTemplate>): Observable<CotTemplate> {
    return this.http.put<CotTemplate>(`${this.api}/plantillas/${id}`, dto);
  }
  eliminarPlantilla(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/plantillas/${id}`);
  }

  /* Empresas */
  listarEmpresas(): Observable<CotEmpresa[]> {
    return this.http.get<CotEmpresa[]>(`${this.api}/empresas`);
  }
  crearEmpresa(dto: Partial<CotEmpresa>): Observable<CotEmpresa> {
    return this.http.post<CotEmpresa>(`${this.api}/empresas`, dto);
  }
  actualizarEmpresa(id: number, dto: Partial<CotEmpresa>): Observable<CotEmpresa> {
    return this.http.put<CotEmpresa>(`${this.api}/empresas/${id}`, dto);
  }
  eliminarEmpresa(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/empresas/${id}`);
  }

  /* Tasas de IVA (parámetros) */
  listarTasas(incluirInactivos = false): Observable<CotTasaIva[]> {
    return this.http.get<CotTasaIva[]>(`${this.api}/tasas-iva`, {
      params: incluirInactivos ? new HttpParams().set('incluirInactivos', 'true') : undefined,
    });
  }
  actualizarTasa(id: number, dto: Partial<CotTasaIva>): Observable<CotTasaIva> {
    return this.http.put<CotTasaIva>(`${this.api}/tasas-iva/${id}`, dto);
  }

  /* Rangos de usuarios */
  listarRangos(): Observable<CotRangoUsuario[]> {
    return this.http.get<CotRangoUsuario[]>(`${this.api}/rangos`);
  }
  crearRango(dto: Partial<CotRangoUsuario>): Observable<CotRangoUsuario> {
    return this.http.post<CotRangoUsuario>(`${this.api}/rangos`, dto);
  }
  actualizarRango(id: number, dto: Partial<CotRangoUsuario>): Observable<CotRangoUsuario> {
    return this.http.put<CotRangoUsuario>(`${this.api}/rangos/${id}`, dto);
  }
  eliminarRango(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/rangos/${id}`);
  }

  /* Tarifas (región + rango + modalidad) */
  listarTarifas(incluirInactivos = false): Observable<CotTarifa[]> {
    return this.http.get<CotTarifa[]>(`${this.api}/tarifas`, {
      params: incluirInactivos ? new HttpParams().set('incluirInactivos', 'true') : undefined,
    });
  }
  crearTarifa(dto: Partial<CotTarifa>): Observable<CotTarifa> {
    return this.http.post<CotTarifa>(`${this.api}/tarifas`, dto);
  }
  actualizarTarifa(id: number, dto: Partial<CotTarifa>): Observable<CotTarifa> {
    return this.http.put<CotTarifa>(`${this.api}/tarifas/${id}`, dto);
  }
  eliminarTarifa(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/tarifas/${id}`);
  }

  /** Rango que corresponde a un número de usuarios. */
  getRango(nroUser: number): Observable<CotRangoUsuario | null> {
    return this.http.get<CotRangoUsuario | null>(`${this.api}/rango`, {
      params: new HttpParams().set('nroUser', String(nroUser)),
    });
  }

  /** Tarifa por región + nro de usuarios + modalidad. */
  getTarifa(idRegion: number, nroUser: number, modalidad: string): Observable<CotTarifa | null> {
    const params = new HttpParams()
      .set('idRegion', String(idRegion))
      .set('nroUser', String(nroUser))
      .set('modalidad', modalidad);
    return this.http.get<CotTarifa | null>(`${this.api}/tarifa`, { params });
  }

  /* Cotizaciones */
  listarBudgets(filtros?: {
    status?: number;
    idClient?: number;
    q?: string;
    de?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  }): Observable<{ data: Budget[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    let params = new HttpParams();
    if (filtros?.status !== undefined) params = params.set('status', String(filtros.status));
    if (filtros?.idClient) params = params.set('idClient', String(filtros.idClient));
    if (filtros?.q) params = params.set('q', String(filtros.q));
    if (filtros?.de) params = params.set('de', String(filtros.de));
    if (filtros?.hasta) params = params.set('hasta', String(filtros.hasta));
    if (filtros?.page) params = params.set('page', String(filtros.page));
    if (filtros?.limit) params = params.set('limit', String(filtros.limit));
    return this.http.get<{ data: Budget[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
      `${this.api}`,
      { params },
    );
  }
  getBudget(id: number): Observable<Budget> {
    return this.http.get<Budget>(`${this.api}/${id}`);
  }

  /** Cotizaciones vencidas (últimos 15 días) y por vencer (próximos 5 días). */
  listarVencidas(diasAlerta = 15, diasPorVencer = 5): Observable<CotVencidas> {
    const params = new HttpParams()
      .set('diasAlerta', String(diasAlerta))
      .set('diasPorVencer', String(diasPorVencer));
    return this.http.get<CotVencidas>(`${this.api}/vencidas`, { params });
  }  crearBudget(dto: Partial<Budget>): Observable<Budget> {
    return this.http.post<Budget>(`${this.api}`, dto);
  }
  actualizarBudget(id: number, dto: Partial<Budget>): Observable<Budget> {
    return this.http.put<Budget>(`${this.api}/${id}`, dto);
  }
  recalcular(id: number): Observable<Budget> {
    return this.http.post<Budget>(`${this.api}/${id}/calcular`, {});
  }
  cambiarEstado(id: number, status: number): Observable<Budget> {
    return this.http.post<Budget>(`${this.api}/${id}/estado/${status}`, {});
  }
  registrarHistorial(id: number, nota: string): Observable<void> {
    return this.http.post<void>(`${this.api}/${id}/historial`, { nota });
  }
  eliminarBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  /** Duplica una cotización existente como una nueva (BORRADOR). */
  duplicarBudget(id: number): Observable<Budget> {
    return this.http.post<Budget>(`${this.api}/${id}/duplicar`, {});
  }

  /** Descarga/abre el PDF elegante de una cotización. */
  pdfCotizacion(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/${id}/pdf`, { responseType: 'blob' });
  }

  /** Envía la cotización por correo (PDF adjunto al email del cliente). */
  enviarCotizacion(id: number): Observable<{ enviado: boolean; email?: string }> {
    return this.http.post<{ enviado: boolean; email?: string }>(`${this.api}/${id}/enviar`, {});
  }

  /** Indicadores del dashboard de cotizaciones. */
  getKpis(filtros?: { de?: string; hasta?: string; idEmpresa?: number; idClient?: number }): Observable<any> {
    let params = new HttpParams();
    if (filtros?.de) params = params.set('de', filtros.de);
    if (filtros?.hasta) params = params.set('hasta', filtros.hasta);
    if (filtros?.idEmpresa) params = params.set('idEmpresa', String(filtros.idEmpresa));
    if (filtros?.idClient) params = params.set('idClient', String(filtros.idClient));
    return this.http.get<any>(`${this.api}/kpis`, { params });
  }
}