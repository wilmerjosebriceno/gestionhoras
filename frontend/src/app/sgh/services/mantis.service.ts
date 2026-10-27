import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MantisProyecto {
  id: number;
  name: string;
}

export interface MantisUsuario {
  id: number;
  name: string;
  real_name?: string;
}

export interface MantisEstado {
  id: string;
  name: string;
}

export interface MantisIssueView {
  id: number;
  summary: string;
  project: string;
  reporter: string;
  handler: string;
  status: string;
  statusId?: number;
  priority?: string;
  severity?: string;
  dateSubmitted?: string;
  lastUpdated?: string;
}

export interface MantisResumen {
  total: number;
  porEstado: { nombre: string; total: number }[];
  porProyecto: { nombre: string; total: number }[];
  porAsignado: { nombre: string; total: number }[];
  porMes: { mes: string; total: number }[];
}

@Injectable({ providedIn: 'root' })
export class MantisService {
  private api = `${environment.apiUrl}/sgh/mantis`;

  constructor(private http: HttpClient) {}

  filtros(): Observable<{
    proyectos: MantisProyecto[];
    usuarios: MantisUsuario[];
    estatus: MantisEstado[];
  }> {
    return this.http.get<any>(`${this.api}/filtros`);
  }

  consultar(dto: any): Observable<{ total: number; issues: MantisIssueView[] }> {
    return this.http.post<any>(`${this.api}/consultar`, dto);
  }

  resumen(dto: any): Observable<MantisResumen> {
    return this.http.post<MantisResumen>(`${this.api}/resumen`, dto);
  }

  analizar(dto: any): Observable<{ texto: string }> {
    return this.http.post<{ texto: string }>(`${this.api}/analizar`, dto);
  }
}
