import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Grupo, CreateGrupo, UpdateGrupo } from '../models/grupo.model';

@Injectable({ providedIn: 'root' })
export class GrupoService {
  private api = `${environment.apiUrl}/grupos`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<Grupo[]> {
    return this.http.get<Grupo[]>(this.api);
  }

  findOne(grupo: string): Observable<Grupo> {
    return this.http.get<Grupo>(`${this.api}/${grupo}`);
  }

  create(dto: CreateGrupo): Observable<Grupo> {
    return this.http.post<Grupo>(this.api, dto);
  }

  update(grupo: string, dto: UpdateGrupo): Observable<Grupo> {
    return this.http.put<Grupo>(`${this.api}/${grupo}`, dto);
  }

  remove(grupo: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${grupo}`);
  }

  asignarUsuarios(grupo: string, logins: string[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/${grupo}/usuarios`, { logins });
  }
}
