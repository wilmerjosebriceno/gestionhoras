import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MantisClientService } from './mantis-client.service';
import { LlmService } from '../agente/llm.service';
import { MensajeLlm } from '../agente/agente.tipos';
import { MantisConsultaDto } from './dto/mantis.dto';

export interface MantisIssueView {
  id: number;
  summary: string;
  project: string;
  reporter: string;
  handler: string;
  status: string;
  statusId?: number;
  priority?: string;
  severity?: string;
  dateSubmitted?: string;
  lastUpdated?: string;
}

export interface MantisResumen {
  total: number;
  porEstado: { nombre: string; total: number }[];
  porProyecto: { nombre: string; total: number }[];
  porAsignado: { nombre: string; total: number }[];
  porMes: { mes: string; total: number }[];
}

@Injectable()
export class MantisService {
  private readonly logger = new Logger(MantisService.name);

  constructor(
    private readonly client: MantisClientService,
    private readonly llm: LlmService,
  ) {}

  /** Catálogos precargados para la pantalla (proyectos, usuarios, estados). */
  async filtros() {
    const [proyectos, usuarios, estatus] = await Promise.all([
      this.client.getProjects().catch(() => []),
      this.client.getUsers().catch(() => []),
      this.client.getStatuses().catch(() => []),
    ]);
    return { proyectos, usuarios, estatus };
  }

  private normalizar(issue: any): MantisIssueView {
    const nombre = (u: any) =>
      u ? u.real_name || u.name || String(u.id) : '—';
    const aFecha = (v: number | string | undefined): string => {
      if (!v) return '';
      const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    };
    const fechaIss = (it: any) => aFecha(it.created_at ?? it.date_submitted);
    const fechaUpd = (it: any) => aFecha(it.updated_at ?? it.last_updated);

    return {
      id: Number(issue.id),
      summary: issue.summary ?? '',
      project: issue.project?.name ?? '',
      reporter: nombre(issue.reporter),
      handler: nombre(issue.handler),
      status: issue.status?.label ?? issue.status?.name ?? '',
      statusId: issue.status ? Number(issue.status.id) : undefined,
      priority: issue.priority?.name ?? '',
      severity: issue.severity?.name ?? '',
      dateSubmitted: fechaIss(issue),
      lastUpdated: fechaUpd(issue),
    };
  }

  async consultar(dto: MantisConsultaDto): Promise<{
    total: number;
    issues: MantisIssueView[];
  }> {
    if (!this.client.configurado) {
      throw new BadRequestException(
        'Mantis no está configurado en el servidor. Defina MANTIS_BASE_URL y MANTIS_API_TOKEN en el .env',
      );
    }
    const raw = await this.client.searchIssues({
      projectId: dto.projectId ? Number(dto.projectId) : undefined,
      texto: dto.texto,
      statusId: dto.statusId ? Number(dto.statusId) : undefined,
      reporterId: dto.reporterId ? Number(dto.reporterId) : undefined,
      handlerId: dto.handlerId ? Number(dto.handlerId) : undefined,
      desde: dto.desde,
      hasta: dto.hasta,
      max: dto.max ? Number(dto.max) : 300,
    });
    return { total: raw.length, issues: raw.map((i) => this.normalizar(i)) };
  }

  async resumen(dto: MantisConsultaDto): Promise<MantisResumen> {
    const { issues } = await this.consultar(dto);
    const porEstado: Record<string, number> = {};
    const porProyecto: Record<string, number> = {};
    const porAsignado: Record<string, number> = {};
    const porMes: Record<string, number> = {};

    for (const it of issues) {
      porEstado[it.status] = (porEstado[it.status] || 0) + 1;
      porProyecto[it.project] = (porProyecto[it.project] || 0) + 1;
      porAsignado[it.handler] = (porAsignado[it.handler] || 0) + 1;
      const mes = (it.dateSubmitted || '').slice(0, 7);
      if (mes) porMes[mes] = (porMes[mes] || 0) + 1;
    }

    const aArr = (o: Record<string, number>) =>
      Object.entries(o)
        .map(([k, v]) => ({ nombre: k, total: v }))
        .sort((a, b) => b.total - a.total);

    return {
      total: issues.length,
      porEstado: aArr(porEstado),
      porProyecto: aArr(porProyecto).slice(0, 10),
      porAsignado: aArr(porAsignado).slice(0, 10),
      porMes: Object.entries(porMes)
        .map(([k, v]) => ({ mes: k, total: v }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  }

  /** Genera un análisis ejecutivo en español usando el LLM sobre el resultado filtrado. */
  async analizar(dto: MantisConsultaDto): Promise<{ texto: string }> {
    const { issues } = await this.consultar({ ...dto, max: 200 });
    const res = await this.resumen({ ...dto, max: 200 });

    const muestra = issues
      .slice(0, 30)
      .map(
        (i) =>
          `#${i.id} [${i.status}] ${i.project} - ${i.summary} (asignado: ${i.handler})`,
      )
      .join('\n');

    const prompt = [
      'Eres un analista de gestión de proyectos. Con base en el conjunto de incidencias de Mantis resumido abajo,',
      'redacta un análisis ejecutivo CONCISO en español (máx. 350 palabras) que incluya:',
      '1) Distribución por estado y qué indica; 2) Proyectos más afectados; 3) Asignados con mayor carga;',
      '4) Riesgos observados y 3 recomendaciones accionables.',
      '',
      `Total de incidencias: ${res.total}`,
      `Por estado: ${res.porEstado.map((x) => `${x.nombre}=${x.total}`).join(', ')}`,
      `Principales proyectos: ${res.porProyecto
        .slice(0, 5)
        .map((x) => `${x.nombre}=${x.total}`)
        .join(', ')}`,
      `Principales asignados: ${res.porAsignado
        .slice(0, 5)
        .map((x) => `${x.nombre}=${x.total}`)
        .join(', ')}`,
      '',
      'Muestra de incidencias:',
      muestra || '(sin incidencias)',
    ].join('\n');

    const mensajes: MensajeLlm[] = [
      {
        role: 'system',
        content: 'Eres un asistente de análisis de proyectos, preciso y objetivo.',
      },
      { role: 'user', content: prompt },
    ];

    try {
      const resp = await this.llm.completar(mensajes, []);
      return { texto: resp.content || 'No se generó análisis.' };
    } catch (e: any) {
      this.logger.warn(`Análisis de Mantis falló: ${e?.message}`);
      return {
        texto: `No se pudo generar el análisis con IA: ${e?.message || 'error'}`,
      };
    }
  }
}
