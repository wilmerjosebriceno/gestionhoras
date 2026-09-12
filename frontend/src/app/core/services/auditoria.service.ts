import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LogEntry, QueryLog, LogResponse, Evento, ResumenAuditoria } from '../models/log.model';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private api = `${environment.apiUrl}/auditoria`;

  constructor(private http: HttpClient) {}

  findAll(query?: QueryLog): Observable<LogResponse> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params = params.set(k, v.toString());
      });
    }
    return this.http.get<LogResponse>(`${this.api}/logs`, { params });
  }

  getEventos(): Observable<Evento[]> {
    return this.http.get<Evento[]>(`${this.api}/eventos`);
  }

  getResumen(): Observable<ResumenAuditoria> {
    return this.http.get<ResumenAuditoria>(`${this.api}/resumen`);
  }
}
