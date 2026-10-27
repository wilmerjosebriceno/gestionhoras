/**
 * Utilidades de programacion (tipo MS Project) para GPI.
 *
 * Trabajan con indices de dia (ms/86400000) para evitar problemas de zona
 * horaria. Un "calendario" define que dias son laborables y cuantas horas
 * aporta cada uno; las excepciones (feriados) los sobrescriben.
 */

export const DAY = 86400000;

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export interface Calendario {
  lunes?: boolean;
  martes?: boolean;
  miercoles?: boolean;
  jueves?: boolean;
  viernes?: boolean;
  sabado?: boolean;
  domingo?: boolean;
  horas_por_dia?: number;
}

export type Excepciones = Map<string, { laborable: boolean; horas: number }>;

export const toIdx = (iso: string | Date): number =>
  Math.floor(new Date(String(iso).slice(0, 10) + 'T00:00:00Z').getTime() / DAY);

export const fromIdx = (idx: number): string => new Date(idx * DAY).toISOString().slice(0, 10);

/** Dias laborables y horas del dia `idx` segun calendario + excepciones. */
export function diaInfo(idx: number, cal: Calendario, exc: Excepciones): { laborable: boolean; horas: number } {
  const key = fromIdx(idx);
  const ex = exc.get(key);
  const base = Number(cal?.horas_por_dia) || 8;
  if (ex) return { laborable: ex.laborable, horas: ex.laborable ? (Number(ex.horas) || base) : 0 };
  const flag = (cal as any)?.[DIAS[new Date(idx * DAY).getUTCDay()]];
  return { laborable: !!flag, horas: flag ? base : 0 };
}

/** Primer dia laborable >= idx. */
export function nextWorkingIdx(idx: number, cal: Calendario, exc: Excepciones): number {
  let i = idx;
  let guard = 0;
  while (!diaInfo(i, cal, exc).laborable && guard++ < 100000) i++;
  return i;
}

/** Indice del ultimo dia que consume `horas` a partir de `startIdx` (min un dia). */
export function consumirHoras(startIdx: number, horas: number, cal: Calendario, exc: Excepciones): number {
  let idx = nextWorkingIdx(startIdx, cal, exc);
  if (horas <= 0) return idx;
  let restante = horas;
  let last = idx;
  let guard = 0;
  while (restante > 0 && guard++ < 100000) {
    const info = diaInfo(idx, cal, exc);
    if (info.laborable && info.horas > 0) {
      restante -= info.horas;
      last = idx;
    }
    idx++;
  }
  return last;
}

/** Orden topologico (Kahn) de actividades segun dependencias predecesora -> actividad. */
export function ordenTopologico(ids: number[], edges: Array<{ id_actividad: number; id_predecesora: number }>): number[] {
  const set = new Set(ids);
  const adj = new Map<number, number[]>();
  const indeg = new Map<number, number>();
  for (const id of ids) {
    adj.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    if (!set.has(e.id_actividad) || !set.has(e.id_predecesora)) continue;
    adj.get(e.id_predecesora)!.push(e.id_actividad);
    indeg.set(e.id_actividad, (indeg.get(e.id_actividad) || 0) + 1);
  }
  const cola = ids.filter((id) => (indeg.get(id) || 0) === 0);
  const out: number[] = [];
  while (cola.length) {
    const n = cola.shift()!;
    out.push(n);
    for (const m of adj.get(n) || []) {
      indeg.set(m, (indeg.get(m) || 0) - 1);
      if ((indeg.get(m) || 0) === 0) cola.push(m);
    }
  }
  // Si hay ciclos, anexar los que falten (sin romper la ejecucion).
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}
