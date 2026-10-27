import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GpiService } from '../services/gpi.service';

@Component({
  selector: 'app-gpi-carga',
  standalone: false,
  templateUrl: './carga.component.html',
})
export class GpiCargaComponent implements OnChanges {
  @Input() proyectoId!: number;

  cargando = false;
  desde = '';
  hasta = '';
  fechas: string[] = [];
  filas: Array<{
    id_recurso: number;
    recurso: string;
    horasPorFecha: Record<string, number>;
    total: number;
    capacidadDia: number;
    sobrecarga: boolean;
  }> = [];

  constructor(private readonly gpi: GpiService) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['proyectoId'] && this.proyectoId) {
      this.initRango();
      this.cargar();
    }
  }

  private initRango(): void {
    const hoy = new Date();
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.desde = ini.toISOString().slice(0, 10);
    this.hasta = fin.toISOString().slice(0, 10);
  }

  cargar(): void {
    this.cargando = true;
    const data = { rows: [] as any[], cap: new Map<number, number>() };
    this.gpi.carga(this.proyectoId, this.desde, this.hasta).subscribe({
      next: (rows) => {
        data.rows = rows || [];
        this.gpi.catalogos().subscribe({
          next: (c) => {
            for (const r of c.recursos) {
              data.cap.set(r.id_recurso, Number(r.capacidad_semanal) || 40);
            }
            this.construir(data.rows, data.cap);
            this.cargando = false;
          },
          error: () => {
            this.construir(data.rows, data.cap);
            this.cargando = false;
          },
        });
      },
      error: () => {
        this.filas = [];
        this.fechas = [];
        this.cargando = false;
      },
    });
  }

  private construir(rows: any[], cap: Map<number, number>): void {
    const fechasSet = new Set<string>();
    const porRecurso = new Map<number, { id_recurso: number; recurso: string; horasPorFecha: Record<string, number> }>();
    for (const r of rows) {
      const f = String(r.fecha).slice(0, 10);
      fechasSet.add(f);
      if (!porRecurso.has(r.id_recurso)) {
        porRecurso.set(r.id_recurso, { id_recurso: r.id_recurso, recurso: r.recurso, horasPorFecha: {} });
      }
      const e = porRecurso.get(r.id_recurso)!;
      e.horasPorFecha[f] = (e.horasPorFecha[f] || 0) + Number(r.horas);
    }
    this.fechas = [...fechasSet].sort();
    this.filas = [...porRecurso.values()]
      .map((e) => {
        const capacidadDia = Math.round(((cap.get(e.id_recurso) ?? 40) / 5) * 100) / 100;
        const total = Object.values(e.horasPorFecha).reduce((s, h) => s + h, 0);
        const sobrecarga = Object.values(e.horasPorFecha).some((h) => h > capacidadDia + 0.001);
        return { ...e, total: Math.round(total * 100) / 100, capacidadDia, sobrecarga };
      })
      .sort((a, b) => a.recurso.localeCompare(b.recurso));
  }

  celdaExcede(fila: any, fecha: string): boolean {
    return (fila.horasPorFecha[fecha] || 0) > fila.capacidadDia + 0.001;
  }

  totalFecha(fecha: string): number {
    return Math.round(this.filas.reduce((s, f) => s + (f.horasPorFecha[fecha] || 0), 0) * 100) / 100;
  }
}
