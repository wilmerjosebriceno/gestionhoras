import { Injectable, Logger } from '@nestjs/common';

export interface ScrinProject {
  id: string;
  name: string;
  color?: string;
}

export interface ScrinEmployment {
  id: number;
  name: string;
  email?: string;
  projects?: { employmentId: number; projectId: string; payRate?: number | null }[];
  accountInfo?: { timeZone?: { name?: string; utcOffset?: number } };
}

export interface ScrinCompany {
  id: number;
  name: string;
  employments: ScrinEmployment[];
  projects: ScrinProject[];
}

export interface ScrinCommonData {
  companies: ScrinCompany[];
  currentCompanyId: number;
  accountId?: number;
  employmentId?: number;
  timeZone?: { name?: string; utcOffset?: number };
}

export interface ScrinActivityRaw {
  activityId?: string;
  id: string;
  employmentId: number;
  note?: string;
  from: number;
  to: number;
  offline?: boolean;
  projectId?: string | null;
  taskId?: string | null;
}

export interface ScrinProjectRef {
  projectId: string;
  projectName: string;
}

const SCRIN_BASE = 'https://scrin.io/api/v2';

@Injectable()
export class ScrinClientService {
  private readonly logger = new Logger(ScrinClientService.name);

  async getCommonData(token: string): Promise<ScrinCommonData> {
    return this.post<ScrinCommonData>(token, 'GetCommonData', {});
  }

  async getActivities(
    token: string,
    employmentId: number,
    fromSec: number,
    toSec: number,
  ): Promise<ScrinActivityRaw[]> {
    return this.post<ScrinActivityRaw[]>(token, 'GetActivities', [
      { employmentId, from: fromSec, to: toSec },
    ]);
  }

  /**
   * Construye el catalogo `projectId (GUID) -> nombre` a partir de GetCommonData.
   */
  buildProjectCatalog(data: ScrinCommonData): Map<string, string> {
    const catalog = new Map<string, string>();
    for (const company of data.companies ?? []) {
      for (const p of company.projects ?? []) {
        catalog.set(p.id, p.name);
      }
    }
    return catalog;
  }

  /** Offset en minutos respecto de UTC reportado por la cuenta (ej. -240 = UTC-4). */
  getUtcOffset(data: ScrinCommonData): number {
    return (
      data.timeZone?.utcOffset ??
      data.companies?.[0]?.employments?.[0]?.accountInfo?.timeZone?.utcOffset ??
      0
    );
  }

  /** Inicio del dia local (epoch segundos) para una fecha YYYY-MM-DD. */
  startOfDay(date: string, utcOffsetMin: number): number {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0);
    return Math.floor(utcMs / 1000) - utcOffsetMin * 60;
  }

  /** Fin del dia local (epoch segundos) para una fecha YYYY-MM-DD. */
  endOfDay(date: string, utcOffsetMin: number): number {
    return this.startOfDay(date, utcOffsetMin) + 24 * 60 * 60 - 1;
  }

  /** Convierte epoch segundos a fecha/hora local segun el offset de la cuenta. */
  toLocal(epochSec: number, utcOffsetMin: number): { date: string; time: string } {
    const d = new Date((epochSec + utcOffsetMin * 60) * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`,
    };
  }

  private async post<T>(token: string, endpoint: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${SCRIN_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'X-SSM-Token': token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Scrin ${endpoint} respondio ${res.status}: ${text.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.error(`Error llamando a Scrin ${endpoint}: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
