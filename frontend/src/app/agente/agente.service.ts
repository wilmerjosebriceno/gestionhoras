import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MensajeAgente {
  role: 'user' | 'assistant';
  content: string;
}

export interface RespuestaAgente {
  respuesta: string;
  pasos?: number;
  herramientasUsadas?: string[];
}

@Injectable({ providedIn: 'root' })
export class AgenteService {
  private api = `${environment.apiUrl}/agente`;

  constructor(private http: HttpClient) {}

  estado(): Observable<{ configurado: boolean }> {
    return this.http.get<{ configurado: boolean }>(`${this.api}/estado`);
  }

  chat(messages: MensajeAgente[], contexto?: string): Observable<RespuestaAgente> {
    return this.http.post<RespuestaAgente>(`${this.api}/chat`, { messages, contexto });
  }
}
