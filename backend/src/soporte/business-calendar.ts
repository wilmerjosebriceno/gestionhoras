/**
 * Calendario laborable para las alertas de Soporte.
 *
 * Regla (configurable): se cuentan solo dias laborables (por defecto lunes a
 * viernes) y cada dia laborable aporta 24 horas. Los fines de semana no
 * consumen tiempo. El calculo se hace en la zona horaria configurada
 * (por defecto America/Caracas, sin horario de verano).
 *
 *   addWorkingHours(Fri 17:00, 24)  -> Mon 17:00
 *   addWorkingHours(Sat 09:00, 24)  -> Tue 00:00
 */

function diasDesdeEnv(): number[] {
  const raw = (process.env.SOPORTE_ALERTA_DIAS || '1,2,3,4,5').trim();
  const dias = raw
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return dias.length ? dias : [1, 2, 3, 4, 5];
}

const DIAS_LABORABLES = diasDesdeEnv();

/** Desplazamiento (ms) de la zona configurada respecto a UTC. */
function calcularOffset(): number {
  const override = (process.env.SOPORTE_ALERTA_UTC_OFFSET || '').trim();
  if (override) return Number(override) * 3600000;
  const tz = (process.env.SOPORTE_ALERTA_TZ || 'America/Caracas').trim();
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const x of dtf.formatToParts(new Date())) p[x.type] = x.value;
    const asUTC = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    // Redondear al minuto: evita desfases sub-segundo por la precision del formato.
    return Math.round((asUTC - Date.now()) / 60000) * 60000;
  } catch {
    return -4 * 3600000; // Venezuela (UTC-4)
  }
}

const OFFSET = calcularOffset();

function esLaborableDiaUTC(dayStartWallMs: number): boolean {
  const dow = new Date(dayStartWallMs).getUTCDay(); // 0=domingo .. 6=sabado
  const iso = dow === 0 ? 7 : dow;
  return DIAS_LABORABLES.includes(iso);
}

function inicioDiaWall(wallMs: number): number {
  const d = new Date(wallMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** true si la fecha cae en un dia laborable (segun la zona configurada). */
export function esDiaLaborable(date: Date = new Date()): boolean {
  const wall = date.getTime() + OFFSET;
  return esLaborableDiaUTC(inicioDiaWall(wall));
}

/** Componentes locales (fecha YYYY-MM-DD, hora 0-23) en la zona configurada. */
export function ahoraEnCalendario(date: Date = new Date()): { fecha: string; hora: number } {
  const w = new Date(date.getTime() + OFFSET);
  const y = w.getUTCFullYear();
  const m = w.getUTCMonth() + 1;
  const d = w.getUTCDate();
  return {
    fecha: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    hora: w.getUTCHours(),
  };
}

/** Horas laborables transcurridas entre dos fechas (fines de semana = 0). */
export function workingHoursBetween(desde: Date, hasta: Date): number {
  const a = desde.getTime() + OFFSET;
  const b = hasta.getTime() + OFFSET;
  if (b <= a) return 0;

  let total = 0;
  let cursor = a;
  let guard = 0;
  while (cursor < b && guard++ < 100000) {
    const dayStart = inicioDiaWall(cursor);
    const dayEnd = dayStart + 86400000;
    const ini = Math.max(cursor, dayStart);
    const fin = Math.min(b, dayEnd);
    if (esLaborableDiaUTC(dayStart)) total += fin - ini;
    cursor = dayEnd;
  }
  return total / 3600000;
}

/** Fecha en que se cumplen `horas` laborables a partir de `inicio`. */
export function addWorkingHours(inicio: Date, horas: number): Date {
  const objetivo = Math.max(0, horas) * 3600000;
  let cursor = inicio.getTime() + OFFSET;
  let acumulado = 0;
  let guard = 0;
  while (acumulado < objetivo && guard++ < 100000) {
    const dayStart = inicioDiaWall(cursor);
    const dayEnd = dayStart + 86400000;
    if (esLaborableDiaUTC(dayStart)) {
      const tramo = Math.min(dayEnd, cursor + (objetivo - acumulado)) - cursor;
      acumulado += tramo;
      cursor += tramo;
    } else {
      cursor = dayEnd;
    }
  }
  return new Date(cursor - OFFSET);
}
