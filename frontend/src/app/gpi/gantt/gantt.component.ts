import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GpiService } from '../services/gpi.service';

const DAY = 86400000;
const dayIndex = (s?: string | null): number | null =>
  s ? Math.floor(new Date(String(s).slice(0, 10) + 'T00:00:00Z').getTime() / DAY) : null;

@Component({
  selector: 'app-gpi-gantt',
  standalone: false,
  templateUrl: './gantt.component.html',
})
export class GpiGanttComponent implements OnChanges {
  @Input() proyectoId!: number;

  cargando = false;
  actividades: any[] = [];
  dependencias: any[] = [];
  filas: any[] = [];
  rangeStart = 0;
  totalDays = 1;
  dayWidth = 30;
  hoyOffset = -1;

  constructor(private readonly gpi: GpiService) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['proyectoId'] && this.proyectoId) this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.gantt(this.proyectoId).subscribe({
      next: (d) => {
        this.actividades = d.actividades || [];
        this.dependencias = d.dependencias || [];
        this.calcular(d.proyecto);
        this.cargando = false;
      },
      error: () => {
        this.actividades = [];
        this.filas = [];
        this.cargando = false;
      },
    });
  }

  private calcular(proyecto: any): void {
    const inis = this.actividades.map((a) => dayIndex(a.fecha_ini_plan)).filter((x) => x != null) as number[];
    const fins = this.actividades.map((a) => dayIndex(a.fecha_fin_plan ?? a.fecha_ini_plan)).filter((x) => x != null) as number[];
    const hoyIdx = dayIndex(new Date().toISOString()) as number;

    let start = inis.length ? Math.min(...inis) : (dayIndex(proyecto?.fecha_ini_plan) ?? hoyIdx);
    let end = fins.length ? Math.max(...fins) : (dayIndex(proyecto?.fecha_fin_plan) ?? start + 30);
    if (end < start) end = start + 30;
    start -= 2;
    end += 2;

    this.rangeStart = start;
    this.totalDays = end - start + 1;
    this.hoyOffset = hoyIdx >= start && hoyIdx <= end ? hoyIdx - start : -1;

    const porId = new Map(this.actividades.map((a) => [a.id_actividad, a]));
    const nivelDe = (a: any): number => {
      let n = 0;
      let p = a.id_padre;
      let g = 0;
      while (p && porId.get(p) && g++ < 50) {
        n++;
        p = porId.get(p).id_padre;
      }
      return n;
    };

    this.filas = this.actividades.map((a) => {
      const ini = dayIndex(a.fecha_ini_plan) ?? start;
      const fin = dayIndex(a.fecha_fin_plan ?? a.fecha_ini_plan) ?? ini;
      const offset = Math.max(0, ini - start);
      const dur = Math.max(1, fin - ini + 1);
      const iniB = dayIndex(a.fecha_ini_base);
      const finB = dayIndex(a.fecha_fin_base);
      return {
        ...a,
        _left: offset * this.dayWidth,
        _width: dur * this.dayWidth,
        _leftBase: iniB != null ? Math.max(0, iniB - start) * this.dayWidth : null,
        _widthBase: iniB != null && finB != null ? Math.max(1, finB - iniB + 1) * this.dayWidth : null,
        _esHito: a.tipo === 'hito',
        _nivel: nivelDe(a),
        _predecesoras: this.dependencias.filter((d) => d.id_actividad === a.id_actividad).length,
      };
    });
  }

  anchoTotal(): number {
    return this.totalDays * this.dayWidth;
  }

  ticks(): Array<{ left: number; label: string; mes: boolean; finDeSemana: boolean }> {
    const out: Array<{ left: number; label: string; mes: boolean; finDeSemana: boolean }> = [];
    for (let i = 0; i < this.totalDays; i++) {
      const d = new Date((this.rangeStart + i) * DAY);
      const dow = d.getUTCDay();
      out.push({
        left: i * this.dayWidth,
        label: String(d.getUTCDate()),
        mes: d.getUTCDate() === 1,
        finDeSemana: dow === 0 || dow === 6,
      });
    }
    return out;
  }

  colorEstado(e: string): string {
    return (
      {
        pendiente: '#94a3b8',
        en_proceso: '#3b82f6',
        bloqueada: '#ef4444',
        completada: '#10b981',
        cancelada: '#d1d5db',
      } as Record<string, string>
    )[e] || '#94a3b8';
  }
}
