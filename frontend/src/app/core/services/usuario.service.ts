import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario, CreateUsuario, UpdateUsuario, QueryUsuario, UsuarioResponse } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private api = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  findAll(query?: QueryUsuario): Observable<UsuarioResponse> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params = params.set(k, v.toString());
      });
    }
    return this.http.get<UsuarioResponse>(this.api, { params });
  }

  findOne(login: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.api}/${login}`);
  }

  create(dto: CreateUsuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.api, dto);
  }

  update(login: string, dto: UpdateUsuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.api}/${login}`, dto);
  }

  remove(login: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${login}`);
  }

  resetPassword(login: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/${login}/reset-password`, {});
  }

  desbloquear(login: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/${login}/desbloquear`, {});
  }

  getFirma(login: string): Observable<{ firma: string; dataUri: string }> {
    return this.http.get<{ firma: string; dataUri: string }>(`${this.api}/${login}/firma`);
  }

  subirFirma(login: string, file: File): Observable<{ firma: string; dataUri: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ firma: string; dataUri: string }>(`${this.api}/${login}/firma`, fd);
  }

  eliminarFirma(login: string): Observable<{ firma: string }> {
    return this.http.delete<{ firma: string }>(`${this.api}/${login}/firma`);
  }

  /** Backfill: sincroniza sec_user.firma desde storage/firmas (solo admin). */
  sincronizarFirmas(): Observable<{ revisados: number; actualizados: number; sinUsuario: number; detalles: Array<{ archivo: string; login: string; estado: string }> }> {
    return this.http.post<{ revisados: number; actualizados: number; sinUsuario: number; detalles: Array<{ archivo: string; login: string; estado: string }> }>(`${this.api}/firmas/sincronizar`, {});
  }
}
