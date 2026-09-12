import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AyudaSeccion {
  titulo: string;
  texto?: string;
  /** Lista de viñetas (opcional). */
  lista?: string[];
  /** Pasos numerados (opcional). */
  pasos?: string[];
}

export interface AyudaContenido {
  sistema: string;
  pagina: string;
  titulo: string;
  secciones: AyudaSeccion[];
}

export interface AyudaIndice {
  sistema: string;
  pagina: string;
  titulo: string;
}

@Injectable({ providedIn: 'root' })
export class AyudaService {
  private api = `${environment.apiUrl}/ayuda`;

  constructor(private http: HttpClient) {}

  getAyuda(sistema: string, pagina: string): Observable<AyudaContenido> {
    return this.http.get<AyudaContenido>(`${this.api}/${sistema}/${pagina}`);
  }

  getIndice(): Observable<AyudaIndice[]> {
    return this.http.get<AyudaIndice[]>(`${this.api}/indice`);
  }
}
