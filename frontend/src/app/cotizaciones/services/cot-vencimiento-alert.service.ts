import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { CotizacionesService } from './cotizaciones.service';
import { Budget } from '../models/cotizacion.model';

/**
 * Alerta de cotizaciones vencidas / por vencer.
 * Se muestra al entrar al módulo de Cotizaciones (listado o dashboard),
 * una sola vez por día (bandera en localStorage).
 */
@Injectable({ providedIn: 'root' })
export class CotVencimientoAlertService {
  constructor(
    private readonly service: CotizacionesService,
    private readonly router: Router,
  ) {}

  private get clave(): string {
    return `cot_venc_alerta_${new Date().toISOString().slice(0, 10)}`;
  }

  /** Muestra el popup si aplica (hay vencidas o por vencer) y no se mostró hoy. */
  mostrarSiAplica(): void {
    if (localStorage.getItem(this.clave)) return;
    this.service.listarVencidas().subscribe({
      next: (r) => {
        if (!r?.totalVencidas && !r?.totalPorVencer) return;
        localStorage.setItem(this.clave, '1');
        this.mostrar(r.vencidas, r.porVencer);
      },
      error: () => { /* silencioso: la alerta no debe romper la navegación */ },
    });
  }

  private esc(v: any): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private tabla(items: Budget[], tipo: 'vencida' | 'porVencer'): string {
    if (!items?.length) return '';
    const filas = items.map((b) => {
      const dias = Number((b as any).dias ?? 0);
      const etiqueta = tipo === 'vencida'
        ? `<span style="color:#dc2626;font-weight:600">Vencida hace ${Math.abs(dias)} día(s)</span>`
        : `<span style="color:#d97706;font-weight:600">Vence en ${Math.abs(dias)} día(s)</span>`;
      return `<tr>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;white-space:nowrap">${this.esc(b.codeBudget)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:left">${this.esc(b.client?.nameClient)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;white-space:nowrap">${this.esc(b.vencimiento)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #eee;white-space:nowrap">${etiqueta}</td>
      </tr>`;
    }).join('');
    return `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:4px">
        <thead>
          <tr style="background:#f3f4f6;color:#374151">
            <th style="padding:5px 6px;text-align:left">Código</th>
            <th style="padding:5px 6px;text-align:left">Cliente</th>
            <th style="padding:5px 6px;text-align:left">Vence</th>
            <th style="padding:5px 6px;text-align:left">Situación</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>`;
  }

  private mostrar(vencidas: Budget[], porVencer: Budget[]): void {
    const total = (vencidas?.length || 0) + (porVencer?.length || 0);
    const bloqueVenc = vencidas?.length
      ? `<p style="text-align:left;margin:10px 0 0;font-weight:700;color:#dc2626">🔴 Vencidas (últimos 15 días) — ${vencidas.length}</p>${this.tabla(vencidas, 'vencida')}`
      : '';
    const bloquePor = porVencer?.length
      ? `<p style="text-align:left;margin:14px 0 0;font-weight:700;color:#d97706">🟠 Por vencer (próximos 5 días) — ${porVencer.length}</p>${this.tabla(porVencer, 'porVencer')}`
      : '';

    Swal.fire({
      icon: vencidas?.length ? 'warning' : 'info',
      title: `Cotizaciones por atender (${total})`,
      html: `<div style="max-height:55vh;overflow-y:auto">${bloqueVenc}${bloquePor}</div>`,
      width: 720,
      confirmButtonText: 'Ir a Cotizaciones',
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
    }).then((r) => {
      if (r.isConfirmed) this.router.navigate(['/cot']);
    });
  }
}
