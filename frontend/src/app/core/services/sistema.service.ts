import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Sistema } from '../models/sistema.model';

@Injectable({ providedIn: 'root' })
export class SistemaService {
  private api = `${environment.apiUrl}/sistemas`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<Sistema[]> {
    return this.http.get<Sistema[]>(this.api);
  }

  findOne(sistema: string): Observable<Sistema> {
    return this.http.get<Sistema>(`${this.api}/${sistema}`);
  }

  create(dto: { sistema: string; denominacion: string; descripcion?: string; ruta?: string; estatus?: number }): Observable<Sistema> {
    return this.http.post<Sistema>(this.api, dto);
  }

  update(sistema: string, dto: { denominacion?: string; descripcion?: string; ruta?: string; estatus?: number }): Observable<Sistema> {
    return this.http.put<Sistema>(`${this.api}/${sistema}`, dto);
  }

  remove(sistema: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${sistema}`);
  }
}
