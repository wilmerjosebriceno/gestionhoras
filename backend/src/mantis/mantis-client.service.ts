import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env.config';

export interface MantisCategoria {
  id: number;
  name: string;
  enabled?: boolean;
}

/** Campo personalizado de un proyecto de Mantis. */
export interface MantisCustomField {
  id: number;
  name: string;
  /** Obligatorio al reportar (`require_report` en Mantis). */
  requireReport: boolean;
  /** Valores permitidos cuando el campo es de tipo lista. */
  possibleValues: string[];
  type?: number | string;
}

export interface MantisProject {
  id: number;
  name: string;
  categories?: MantisCategoria[];
  customFields?: MantisCustomField[];
}

export interface MantisUser {
  id: number;
  name: string;
  real_name?: string;
  email?: string;
}

export interface MantisStatusDef {
  id: string;
  name: string;
}

/** Incidencia puntual con sus notas/historial (respuesta de GET /issues/:id). */
export interface MantisIssueDetalle {
  id: number;
  summary?: string;
  status?: { id: number; name: string; label?: string };
  resolution?: { id: number; name: string; label?: string } | null;
  handler?: MantisUser | null;
  reporter?: MantisUser | null;
  created_at?: string;
  updated_at?: string;
  notes?: any[];
  history?: any[];
  [key: string]: any;
}

export interface MantisIssue {
  id: number;
  summary: string;
  project?: { id: number; name: string };
  reporter?: { id: number; name: string; real_name?: string } | null;
  handler?: { id: number; name: string; real_name?: string } | null;
  status?: { id: number; name: string; label?: string };
  priority?: { id: number; name: string };
  severity?: { id: number; name: string };
  category?: { id: number; name: string } | string | null;
  date_submitted?: number | string;
  last_updated?: number | string;
  [key: string]: any;
}

/**
 * Cliente mínimo para la REST API de MantisBT 2.28.0.
 * - Base: MANTIS_BASE_URL + "/api/rest"
 * - Auth: encabezado "Authorization: <API_TOKEN>" (token de "Mi cuenta -> Tokens API").
 * - Lectura (GET) y creación de incidencias (POST /issues).
 *
 * Nota: los nombres de parámetros de filtrado de /issues varían entre instalaciones.
 * Por robustez, aquí solo enviamos project_id y search al servidor y aplicamos
 * estado/informador/asignado/fechas del lado del cliente.
 */
@Injectable()
export class MantisClientService {
  private readonly logger = new Logger(MantisClientService.name);

  private get base(): string {
    const u = (env.mantis.baseUrl || '').replace(/\/+$/, '');
    return u ? `${u}/api/rest` : '';
  }

  private get authHeader(): string {
    return env.mantis.apiToken || '';
  }

  get configurado(): boolean {
    return !!this.base && !!this.authHeader;
  }

  private async request<T = any>(
    path: string,
    opciones: { method?: string; body?: unknown; timeoutMs?: number } = {},
  ): Promise<T> {
    if (!this.configurado) {
      throw new Error(
        'Mantis no está configurado. Defina MANTIS_BASE_URL y MANTIS_API_TOKEN en el .env',
      );
    }
    const url = `${this.base}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opciones.timeoutMs ?? env.mantis.timeoutMs,
    );

    try {
      const res = await fetch(url, {
        method: opciones.method ?? 'GET',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
        signal: controller.signal,
      });
      const texto = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(`Mantis ${path} respondió ${res.status}: ${texto.slice(0, 300)}`);
      }
      if (!texto) return undefined as T;
      return JSON.parse(texto) as T;
    } catch (err: any) {
      this.logger.error(`Error llamando a Mantis ${path}: ${err?.message || err}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async getProjects(): Promise<MantisProject[]> {
    const data: any = await this.request('/projects');
    const lista = data?.projects ?? [];
    return (Array.isArray(lista) ? lista : []).map((p: any) => ({
      id: Number(p.id),
      name: p.name,
    }));
  }

  private cacheUsuarios: { ts: number; data: MantisUser[] } | null = null;

  async getUsers(projectId?: number): Promise<MantisUser[]> {
    const mapUser = (u: any): MantisUser => ({
      id: Number(u.id),
      name: u.name,
      real_name: u.real_name,
      email: u.email,
    });

    // Si piden los de un proyecto específico, solo esos.
    if (projectId) {
      const data: any = await this.request(`/projects/${projectId}/users`);
      return (data?.users ?? []).map(mapUser);
    }

    // TODOS los usuarios de Mantis, sin filtros:
    // 1) unión de los miembros de cada proyecto
    // 2) participantes (reporter/handler) de issues recientes, por si hay usuarios
    //    sin membresía de proyecto.
    if (this.cacheUsuarios && Date.now() - this.cacheUsuarios.ts < 10 * 60_000) {
      return this.cacheUsuarios.data;
    }

    const mapa = new Map<number, MantisUser>();

    const proyectos = await this.getProjects();
    const CONC = 12;
    for (let i = 0; i < proyectos.length; i += CONC) {
      const lote = proyectos.slice(i, i + CONC).map((p) => p.id);
      const respuestas = await Promise.all(
        lote.map((id) =>
          this.request(`/projects/${id}/users`)
            .then((d: any) => (d?.users ?? []) as any[])
            .catch(() => [] as any[]),
        ),
      );
      for (const lista of respuestas) {
        for (const u of lista) if (u && u.id != null) mapa.set(Number(u.id), mapUser(u));
      }
    }

    try {
      const issues = await this.searchIssues({ max: 200 });
      for (const it of issues) {
        for (const u of [it.reporter, it.handler]) {
          if (u && u.id != null) mapa.set(Number(u.id), mapUser(u));
        }
      }
    } catch {
      /* si falla el scan de issues, se mantiene la unión de proyectos */
    }

    const data = [...mapa.values()].sort((a, b) =>
      (a.real_name || a.name).localeCompare(b.real_name || b.name),
    );
    this.cacheUsuarios = { ts: Date.now(), data };
    return data;
  }

  /** Devuelve [{id, name}] a partir de status_enum_string (valor tipo arreglo en Mantis 2.28). */
  async getStatuses(): Promise<MantisStatusDef[]> {
    try {
      const data: any = await this.request('/config?option=status_enum_string');
      const configs: any[] = data?.configs ?? [];
      const cfg = configs.find((c) => c.option === 'status_enum_string');
      const valor = cfg?.value;
      if (Array.isArray(valor)) {
        return valor.map((v: any) => ({ id: String(v.id), name: v.label || v.name }));
      }
      return [];
    } catch (e) {
      this.logger.warn(`No se pudieron obtener los estados de Mantis: ${e?.message}`);
      return [];
    }
  }

  /**
   * Busca issues. Envía project_id + search al servidor y aplica el resto de
   * filtros localmente para ser robusto ante diferencias en la API.
   */
  async searchIssues(filtros: {
    projectId?: number;
    texto?: string;
    statusId?: number;
    reporterId?: number;
    handlerId?: number;
    desde?: string;
    hasta?: string;
    max?: number;
  }): Promise<MantisIssue[]> {
    const acum: any[] = [];
    const max = filtros.max ?? 1000;
    const pageSize = 100;
    let page = 1;

    while (acum.length < max) {
      const qs = new URLSearchParams();
      qs.set('page_size', String(pageSize));
      qs.set('page', String(page));
      if (filtros.projectId) qs.set('project_id', String(filtros.projectId));
      if (filtros.texto) qs.set('search', filtros.texto);

      const data: any = await this.request(`/issues?${qs.toString()}`);
      const issues: any[] = data?.issues ?? [];
      if (!issues.length) break;

      for (const it of issues) {
        if (acum.length >= max) break;
        acum.push(it);
      }
      if (acum.length >= max) break;
      if (issues.length < pageSize) break;
      page++;
    }

    return this.filtrarLocal(acum, filtros);
  }

  private filtrarLocal(
    issues: any[],
    f: {
      statusId?: number;
      reporterId?: number;
      handlerId?: number;
      desde?: string;
      hasta?: string;
    },
  ): MantisIssue[] {
    const desdeTs = f.desde ? Date.parse(`${f.desde}T00:00:00`) : undefined;
    const hastaTs = f.hasta ? Date.parse(`${f.hasta}T23:59:59`) : undefined;

    return issues.filter((it) => {
      if (f.statusId && Number(it?.status?.id) !== Number(f.statusId)) return false;
      if (f.reporterId && Number(it?.reporter?.id) !== Number(f.reporterId)) return false;
      if (f.handlerId) {
        if (!it?.handler || Number(it.handler.id) !== Number(f.handlerId)) return false;
      }
      const ts =
        typeof it.date_submitted === 'number'
          ? it.date_submitted * 1000
          : Date.parse(it.date_submitted);
      if (desdeTs && (!ts || ts < desdeTs)) return false;
      if (hastaTs && (!ts || ts > hastaTs)) return false;
      return true;
    });
  }

  /** Un proyecto puntual (con sus categorías), o null si no existe en Mantis. */
  async getProject(id: number): Promise<MantisProject | null> {
    const data: any = await this.request(`/projects/${id}`);
    const p = (data?.projects ?? [])[0];
    if (!p) return null;
    return {
      id: Number(p.id),
      name: p.name,
      categories: (p.categories ?? []).map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        enabled: String(c.status) === '1',
      })),
      customFields: (p.custom_fields ?? []).map((f: any) => ({
        id: Number(f.id),
        name: String(f.name ?? ''),
        requireReport: !!f.require_report,
        possibleValues: String(f.possible_values ?? '')
          .split('|')
          .map((v: string) => v.trim())
          .filter((v: string) => v.length > 0),
        type: f.type,
      })),
    };
  }

  /** Una incidencia puntual con sus notas e historial (o null si no existe). */
  async getIssue(id: number): Promise<MantisIssueDetalle | null> {
    const data: any = await this.request(`/issues/${id}`);
    return (data?.issues ?? [])[0] ?? null;
  }

  /**
   * Página cruda de incidencias (tal cual las devuelve Mantis), para el espejo
   * local del dashboard. El listado ya incluye `history` de cada caso.
   */
  async issuesPagina(page: number, pageSize = 1000, timeoutMs?: number): Promise<any[]> {
    const data: any = await this.request(`/issues?page_size=${pageSize}&page=${page}`, {
      timeoutMs,
    });
    return (data?.issues ?? []) as any[];
  }

  /** Lee un enum de configuracion de Mantis (status/priority/severity_enum_string). */  private async enumConfig(
    option: string,
  ): Promise<Array<{ id: number; name: string; label?: string }>> {
    const data: any = await this.request(`/config?option=${option}`);
    const cfg = (data?.configs ?? []).find((c: any) => c.option === option);
    const valor = cfg?.value;
    if (!Array.isArray(valor)) return [];
    return valor.map((v: any) => ({
      id: Number(v.id),
      name: String(v.name),
      label: v.label,
    }));
  }

  /** Prioridades definidas en esta instalacion (id + name + label). */
  getPrioridades() {
    return this.enumConfig('priority_enum_string');
  }

  /** Severidades definidas en esta instalacion (id + name + label). */
  getSeveridades() {
    return this.enumConfig('severity_enum_string');
  }

  /**
   * Crea una incidencia en MantisBT (POST /issues).
   * Solo se envían los campos presentes; el resto los pone Mantis por defecto
   * (el informador es el dueño del token).
   */
  async crearIssue(datos: {
    projectId: number;
    summary: string;
    description: string;
    categoryId?: number;
    priorityId?: number;
    severityId?: number;
    handlerId?: number;
    reporterId?: number;
    additionalInfo?: string;
    /** Campos personalizados obligatorios del proyecto (p. ej. «MODULOS ERP»). */
    customFields?: Array<{ id: number; value: string }>;
  }): Promise<{ id: number; url: string }> {
    if (!this.configurado) {
      throw new Error(
        'Mantis no está configurado. Defina MANTIS_BASE_URL y MANTIS_API_TOKEN en el .env',
      );
    }

    const body: Record<string, unknown> = {
      project: { id: Number(datos.projectId) },
      summary: datos.summary,
      description: datos.description,
    };
    if (datos.categoryId != null) body.category = { id: Number(datos.categoryId) };
    if (datos.priorityId != null) body.priority = { id: Number(datos.priorityId) };
    if (datos.severityId != null) body.severity = { id: Number(datos.severityId) };
    if (datos.handlerId != null) body.handler = { id: Number(datos.handlerId) };
    if (datos.reporterId != null) body.reporter = { id: Number(datos.reporterId) };
    if (datos.additionalInfo) body.additional_information = datos.additionalInfo;
    if (datos.customFields?.length) {
      body.custom_fields = datos.customFields.map((c) => ({
        field: { id: Number(c.id) },
        value: c.value,
      }));
    }

    const res = await this.request<{ issue?: { id?: number } }>('/issues', {
      method: 'POST',
      body,
    });
    const id = Number(res?.issue?.id);
    if (!id) {
      throw new Error('Mantis no devolvió el id de la incidencia creada');
    }

    const baseWeb = (env.mantis.baseUrl || '').replace(/\/+$/, '');
    return { id, url: `${baseWeb}/view.php?id=${id}` };
  }
}
