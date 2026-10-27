import { Injectable } from '@angular/core';

/**
 * Contexto de ayuda para pantallas que no tienen ruta propia (p. ej. las
 * pestañas dentro del detalle de un proyecto GPI). La pantalla activa define
 * (sistema, pagina) y el panel de ayuda del layout lo usa en lugar de deducirlo
 * de la URL.
 */
@Injectable({ providedIn: 'root' })
export class AyudaContextoService {
  private _sistema: string | null = null;
  private _pagina: string | null = null;

  set(sistema: string, pagina: string): void {
    this._sistema = sistema;
    this._pagina = pagina;
  }

  clear(): void {
    this._sistema = null;
    this._pagina = null;
  }

  get sistema(): string | null {
    return this._sistema;
  }

  get pagina(): string | null {
    return this._pagina;
  }
}
