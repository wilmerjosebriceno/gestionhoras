import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ArbolItem {
  nombre: string;
  pagina: string;
  hijos?: ArbolItem[];
}

export interface PermisoRow {
  idAcceso?: string;
  idUser?: string;
  idSistema?: string;
  sistemaCode?: string;
  pagina: string;
  denPagina?: string;
  acceso?: number;
  seleccionar?: number;
  insertar?: number;
  actualizar?: number;
  eliminar?: number;
  ejecutar?: number;
  imprimir?: number;
  anular?: number;
}

@Injectable({ providedIn: 'root' })
export class PermisoService {
  private api = `${environment.apiUrl}/permisos`;

  constructor(private http: HttpClient) {}

  getSistemas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/sistemas`);
  }

  getArbol(sistema: string): Observable<ArbolItem[]> {
    return this.http.get<ArbolItem[]>(`${this.api}/arbol/${sistema}`);
  }

  getListarUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/listar/usuarios`);
  }

  getListarGrupos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/listar/grupos`);
  }

  getPermisosUsuario(login: string, sistema?: string): Observable<PermisoRow[]> {
    let params = new HttpParams();
    if (sistema) params = params.set('sistema', sistema);
    return this.http.get<PermisoRow[]>(`${this.api}/usuario/${login}`, { params });
  }

  getPermisosGrupo(grupo: string, sistema?: string): Observable<PermisoRow[]> {
    let params = new HttpParams();
    if (sistema) params = params.set('sistema', sistema);
    return this.http.get<PermisoRow[]>(`${this.api}/grupo/${grupo}`, { params });
  }

  guardarPermisos(dto: {
    tipo: 'U' | 'G';
    sistema: string;
    logins?: string[];
    grupos?: string[];
    permisos: Array<{
      pagina: string;
      denpagina?: string;
      acceso?: number;
      seleccionar?: number;
      insertar?: number;
      actualizar?: number;
      eliminar?: number;
      ejecutar?: number;
      imprimir?: number;
      anular?: number;
    }>;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/guardar`, dto);
  }

  verificarPermiso(pagina: string, sistema: string = 'SEC'): Observable<{ tienePermiso: boolean }> {
    return this.http.get<{ tienePermiso: boolean }>(
      `${this.api}/verificar/${pagina}`,
      { params: new HttpParams().set('sistema', sistema) },
    );
  }
}
