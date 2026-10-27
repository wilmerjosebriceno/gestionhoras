import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { AgenteSoporte } from './entities/agente-soporte.entity';
import { TicketCategoria } from './entities/ticket-categoria.entity';
import { TicketGrupo } from './entities/ticket-grupo.entity';
import { TicketPoliticaSla } from './entities/ticket-sla.entity';
import { MantisClientService } from '../mantis/mantis-client.service';
import { SoporteMailService } from './soporte-mail.service';
import { env } from '../config/env.config';
import { sanearLATIN9 } from '../common/latin9.util';
import {
  AssignTicketDto,
  CerrarDesdeMantisDto,
  ChangeStateDto,
  CreateMessageDto,
  CreateTicketDto,
  EnviarCorreoIncidenciaDto,
  EnviarMantisDto,
  EnviarSeguimientoDto,
  NotificarCierreDto,
  OverridePriorityDto,
  QueryTicketsDto,
  UpdateTicketDto,
} from './dto/soporte.dto';
import {
  DIAS_REAPERTURA,
  ESTADOS_FINALES,
  ETIQUETA_ESTADO,
  MATRIZ_PRIORIDAD,
  PREFIJO_TIPO,
  TRANSICIONES,
} from './soporte.constants';

/**
 * Correspondencia ticket -> MantisBT.
 * IDs verificados contra la instalacion real (priority_enum_string /
 * severity_enum_string): prioridades 10..60 y severidades 10..80.
 */
const MANTIS_PRIORIDAD: Record<string, number> = {
  P1: 60, // immediate
  P2: 50, // urgent
  P3: 30, // normal
  P4: 20, // low
};

const MANTIS_SEVERIDAD: Record<string, number> = {
  extenso: 80, // block
  significativo: 70, // crash
  moderado: 60, // major
  menor: 50, // minor
};

const MANTIS_SEVERIDAD_POR_NOMBRE: Record<string, number> = {
  block: 80,
  crash: 70,
  major: 60,
  minor: 50,
  tweak: 40,
  text: 30,
  trivial: 20,
  feature: 10,
};

/** Etiquetas legibles para la carta de cierre. */
const TIPO_TICKET: Record<string, string> = {
  incidente: 'Incidente',
  requerimiento: 'Requerimiento',
  problema: 'Problema',
  cambio: 'Cambio',
};

const PRIORIDAD_TICKET: Record<string, string> = {
  P1: 'P1 · Crítica',
  P2: 'P2 · Alta',
  P3: 'P3 · Media',
  P4: 'P4 · Baja',
};

const RESOLUCION_TICKET: Record<string, string> = {
  solucionado: 'Solucionado',
  workaround: 'Mitigación (workaround)',
  no_reproducible: 'No reproducible',
  duplicado: 'Duplicado',
  error_del_usuario: 'Error del usuario',
  cancelado_usuario: 'Cancelado por el usuario',
  requiere_cambio: 'Requiere cambio',
};

/** Usuario autenticado de gestionsigesp (sec_user) */
export interface UsuarioGestor {
  sub: string;
  login: string;
  adminUser: number;
}

interface TicketRow {
  id: number;
  number: string;
  type: string;
  state: string;
  title: string;
  description: string;
  category_id: number | null;
  category_nombre: string | null;
  category_codigo: string | null;
  group_id: number | null;
  group_nombre: string | null;
  service: string | null;
  requester_id: number | null;
  requester_name: string;
  requester_email: string | null;
  requester_phone: string | null;
  id_client: number | null;
  client_name: string | null;
  client_rif: string | null;
  mantis_issue_id: number | null;
  client_mantis_proyect: number | null;
  affected_user: string | null;
  assignee_id: number | null;
  assignee_nombre: string | null;
  impact: string;
  urgency: string;
  priority: string;
  priority_overridden: boolean;
  channel: string;
  sla_policy_id: number | null;
  response_due_at: Date | null;
  resolution_due_at: Date | null;
  first_response_at: Date | null;
  resolved_at: Date | null;
  closed_at: Date | null;
  sla_response_breached: boolean;
  sla_resolution_breached: boolean;
  reopen_count: number;
  hold_reason: string | null;
  resolution_code: string | null;
  resolution_notes: string | null;
  root_cause: string | null;
  parent_id: number | null;
  created_at: Date;
  updated_at: Date;
  /** true si el caso en Mantis (espejo) está cerrado. */
  mantis_cerrado: boolean | null;
}

@Injectable()
export class SoporteService {
  private readonly logger = new Logger(SoporteService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AgenteSoporte)
    private readonly agenteRepo: Repository<AgenteSoporte>,
    @InjectRepository(TicketCategoria)
    private readonly categoriaRepo: Repository<TicketCategoria>,
    @InjectRepository(TicketGrupo)
    private readonly grupoRepo: Repository<TicketGrupo>,
    @InjectRepository(TicketPoliticaSla)
    private readonly slaRepo: Repository<TicketPoliticaSla>,
    private readonly mantisClient: MantisClientService,
    private readonly mail: SoporteMailService,
  ) {}

  /* ==================================================================
   *  Identidad del gestor (traducción sec_user -> sigespweb.usuarios)
   * ================================================================== */

  /**
   * Traduce el usuario de gestionsigesp al id de `sigespweb.usuarios`
   * (columna `assignee_id`/`author_id`/`user_id`). Si el usuario nunca ha
   * gestionado tickets, se crea su registro espejo con rol `editor` (o
   * `admin` si es `adminUser=1`).
   */
  async agenteId(gestor: UsuarioGestor): Promise<AgenteSoporte> {
    const porUsername = await this.agenteRepo.findOne({
      where: { username: gestor.login },
    });
    if (porUsername) {
      return porUsername;
    }

    const alto = (gestor.adminUser === 1);
    const registro = this.agenteRepo.create({
      username: gestor.login,
      email: `${gestor.login}@sigesp.com`,
      rol: alto ? 'admin' : 'editor',
      // Contraseña aleatoria e inutilizable: estos agentes no inician sesión
      // en el portal web, solo se usan como identidad de los tickets.
      password: await bcrypt.hash(`${gestor.login}-${Date.now()}-no-login`, 10),
      creadoEn: new Date(),
    });
    await this.agenteRepo.save(registro);
    this.logger.log(`Agente de soporte creado: ${gestor.login} (id ${registro.id})`);
    return registro;
  }

  /** Datos mínimos de los agentes para el editor de asignación */
  async agentes(): Promise<AgenteSoporte[]> {
    return this.agenteRepo.find({ order: { username: 'ASC' } });
  }

  /* ==================================================================
   *  Bandeja y detalle
   * ================================================================== */

  async listar(filtros: QueryTicketsDto, gestor: UsuarioGestor) {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.search?.trim()) {
      valores.push(`%${filtros.search.trim()}%`);
      condiciones.push(
        `(t.number ILIKE $${valores.length} OR t.title ILIKE $${valores.length} OR t.description ILIKE $${valores.length})`,
      );
    }
    if (filtros.state) {
      valores.push(filtros.state);
      condiciones.push(`t.state = $${valores.length}`);
    }
    if (filtros.priority) {
      valores.push(filtros.priority);
      condiciones.push(`t.priority = $${valores.length}`);
    }
    if (filtros.type) {
      valores.push(filtros.type);
      condiciones.push(`t.type = $${valores.length}`);
    }
    if (filtros.groupId) {
      valores.push(filtros.groupId);
      condiciones.push(`t.group_id = $${valores.length}`);
    }
    if (filtros.assigneeId) {
      valores.push(filtros.assigneeId);
      condiciones.push(`t.assignee_id = $${valores.length}`);
    }
    if (filtros.categoryId) {
      valores.push(filtros.categoryId);
      condiciones.push(`t.category_id = $${valores.length}`);
    }
    if (filtros.soloMios) {
      const agente = await this.agenteId(gestor);
      valores.push(agente.id);
      condiciones.push(`t.assignee_id = $${valores.length}`);
    }
    if (filtros.slaEnRiesgo) {
      condiciones.push(
        `t.resolution_due_at IS NOT NULL
         AND t.resolution_due_at < NOW() + INTERVAL '4 hours'
         AND t.state NOT IN ('resuelto','cerrado','cancelado')`,
      );
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const limit = Math.min(Math.max(filtros.limit ?? 20, 1), 100);
    const page = Math.max(filtros.page ?? 1, 1);
    const offset = (page - 1) * limit;
    valores.push(limit, offset);

    const filas = await this.dataSource.query<TicketRow[]>(
      `SELECT ${this.camposListado()},
              COUNT(*) OVER () AS total
       FROM sigespweb.tickets t
       ${this.joins()}
       ${where}
       ORDER BY t.number DESC, t.id DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores,
    );

    const total = filas.length ? Number((filas as any)[0].total) : 0;

    return {
      data: filas.map((f) => this.aRespuesta(f)),
      total,
      page,
      limit,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async obtener(id: number): Promise<any> {
    const ticket = await this.buscarPorId(id);

    const mensajes = await this.dataSource.query(
      `SELECT m.id, m.body, m.is_internal, m.created_at,
              m.author_id, COALESCE(u.username, m.author_name) AS author_name,
              u.rol AS author_rol
       FROM sigespweb.ticket_messages m
       LEFT JOIN sigespweb.usuarios u ON u.id = m.author_id
       WHERE m.ticket_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC`,
      [id],
    );

    const adjuntos = await this.dataSource.query(
      `SELECT a.id, a.uuid, a.filename, a.mimetype, a.size_bytes, a.hash_sha256, a.created_at,
              COALESCE(u.username, 'Sistema') AS uploaded_by_name
       FROM sigespweb.ticket_attachments a
       LEFT JOIN sigespweb.usuarios u ON u.id = a.uploaded_by
       WHERE a.ticket_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.created_at ASC`,
      [id],
    );

    const historial = await this.dataSource.query(
      `SELECT h.id, h.field, h.old_value, h.new_value, h.created_at,
              COALESCE(u.username, h.user_name, 'Sistema') AS user_name
       FROM sigespweb.ticket_history h
       LEFT JOIN sigespweb.usuarios u ON u.id = h.user_id
       WHERE h.ticket_id = $1
       ORDER BY h.created_at ASC`,
      [id],
    );

    return {
      ...this.aRespuesta(ticket),
      mensajes,
      adjuntos,
      historial,
    };
  }

  async catalogo() {
    const [categorias, grupos, agentes, politicas] = await Promise.all([
      this.categoriaRepo.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      }),
      this.grupoRepo.find({ where: { activo: true }, order: { nivel: 'ASC' } }),
      this.agentes(),
      this.slaRepo.find({ where: { activo: true }, order: { prioridad: 'ASC' } }),
    ]);
    return { categorias, grupos, agentes, politicas };
  }

  /** Indicadores del tablero */
  async estadisticas() {
    const filas = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE state NOT IN ('resuelto','cerrado','cancelado'))::int AS abiertos,
         COUNT(*) FILTER (WHERE state = 'nuevo')::int AS sin_asignar,
         COUNT(*) FILTER (WHERE resolution_due_at < NOW()
                AND state NOT IN ('resuelto','cerrado','cancelado'))::int AS vencidos,
         COUNT(*) FILTER (WHERE reopen_count > 0)::int AS reabiertos
       FROM sigespweb.tickets`,
    );

    const porEstado = await this.dataSource.query(
      `SELECT state, COUNT(*)::int AS total FROM sigespweb.tickets GROUP BY state ORDER BY state`,
    );
    const porPrioridad = await this.dataSource.query(
      `SELECT priority, COUNT(*)::int AS total
       FROM sigespweb.tickets
       WHERE state NOT IN ('cerrado','cancelado')
       GROUP BY priority ORDER BY priority`,
    );

    // Incidencias por modulo/categoria (se usa la categoria asignada al ticket,
    // de modo que cada modulo ERP - Contabilidad, Presupuesto, etc. - sea su
    // propia barra). Si la categoria tiene codigo (SCG, SPG...) se antepone y se
    // omite el prefijo "ERP". Los tickets sin categoria caen en "Sin categoria".
    const porModulo = await this.dataSource.query(
      `SELECT c.id AS "categoryId",
              CASE WHEN c.codigo IS NOT NULL AND TRIM(c.codigo) <> ''
                   THEN c.codigo || ' ' || regexp_replace(c.nombre, '^ERP\\s+', '', 'i')
                   ELSE COALESCE(c.nombre, 'Sin categoria') END AS modulo,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE t.state NOT IN ('resuelto','cerrado','cancelado'))::int AS abiertos,
              COUNT(*) FILTER (WHERE t.state IN ('resuelto','cerrado'))::int AS cerrados
         FROM sigespweb.tickets t
         LEFT JOIN sigespweb.ticket_categories c ON c.id = t.category_id
        GROUP BY c.id, c.codigo, c.nombre
        ORDER BY total DESC, modulo ASC`,
    );

    const resumen = (filas as any[])[0] ?? {};
    return {
      resumen: {
        total: resumen.total ?? 0,
        abiertos: resumen.abiertos ?? 0,
        sin_asignar: resumen.sin_asignar ?? 0,
        vencidos: resumen.vencidos ?? 0,
        reabiertos: resumen.reabiertos ?? 0,
      },
      porEstado,
      porPrioridad,
      porModulo,
    };
  }

  /* ==================================================================
   *  Creación
   * ================================================================== */

  async crear(dto: CreateTicketDto, gestor: UsuarioGestor) {
    const tipo = dto.type ?? 'incidente';
    const impact = (dto.impact ?? 'moderado') as keyof typeof MATRIZ_PRIORIDAD;
    const urgency = (dto.urgency ?? 'media') as keyof typeof MATRIZ_PRIORIDAD[typeof impact];
    const priority = MATRIZ_PRIORIDAD[impact][urgency];
    const agente = await this.agenteId(gestor);

    const ticket = await this.dataSource.transaction(async (tx) => {
      const number = await this.siguienteNumero(tipo as any, tx);
      const sla = await this.politicaSla(priority, tx);

      const insertados = await tx.query<{ id: number }[]>(
        `INSERT INTO sigespweb.tickets (
           number, type, state, title, description, category_id, group_id, service,
           requester_id, requester_name, requester_email, requester_phone, affected_user,
           id_client, client_name, client_rif,
           impact, urgency, priority, channel, sla_policy_id,
           response_due_at, resolution_due_at
         ) VALUES (
           $1,$2,'nuevo',$3,$4,$5,$6,$7,
           $8,$9,$10,$11,$12,
           $13,$14,$15,
           $16,$17,$18,$19,$20,
           NOW() + ($21 || ' minutes')::interval, NOW() + ($22 || ' minutes')::interval
         )
         RETURNING id`,
        [
          number,
          tipo,
          this.latin9(dto.title.trim()),
          this.latin9(dto.description.trim()),
          dto.categoryId ?? null,
          dto.groupId ?? 1,
          dto.service ? this.latin9(dto.service) : null,
          agente.id,
          agente.username,
          `${agente.username}@sigesp.com`,
          null,
          dto.affectedUser ? this.latin9(dto.affectedUser) : null,
          dto.idClient ?? null,
          dto.clientName ? this.latin9(dto.clientName) : null,
          dto.clientRif ? this.latin9(dto.clientRif) : null,
          impact,
          urgency,
          priority,
          dto.channel ?? 'whatsapp',
          sla?.id ?? null,
          sla?.minutos_respuesta ?? 240,
          sla?.minutos_resolucion ?? 2880,
        ],
      );

      const id = insertados[0].id;
      await tx.query(
        `INSERT INTO sigespweb.ticket_history (ticket_id, user_id, user_name, field, old_value, new_value)
         VALUES ($1,$2,$3,'state',NULL,'nuevo'), ($1,$2,$3,'priority',NULL,$4)`,
        [id, agente.id, agente.username, priority],
      );

      return this.cargarConJoins(id, tx);
    });

    this.logger.log(`Ticket creado desde gestionsigesp: ${ticket.number} (${ticket.priority})`);
    return this.aRespuesta(ticket);
  }

  /* ==================================================================
   *  Actualizaciones
   * ================================================================== */

  async actualizar(id: number, dto: UpdateTicketDto, gestor: UsuarioGestor) {
    const actual = await this.buscarPorId(id);
    this.validarEditable(actual);
    const agente = await this.agenteId(gestor);

    const campos: string[] = [];
    const valores: unknown[] = [];
    const cambios: Array<[string, unknown, unknown]> = [];

    const asignar = (columna: string, campo: string, valor: unknown, previo: unknown) => {
      if (valor === undefined || valor === null) return;
      const limpio = typeof valor === 'string' ? this.latin9(valor) : valor;
      valores.push(limpio);
      campos.push(`${columna} = $${valores.length}`);
      cambios.push([campo, previo, limpio]);
    };

    asignar('title', 'title', dto.title?.trim(), actual.title);
    asignar('description', 'description', dto.description?.trim(), actual.description);
    asignar('category_id', 'category_id', dto.categoryId, actual.category_id);
    asignar('group_id', 'group_id', dto.groupId, actual.group_id);
    asignar('service', 'service', dto.service?.trim(), actual.service);
    asignar('affected_user', 'affected_user', dto.affectedUser?.trim(), actual.affected_user);
    asignar('type', 'type', dto.type, actual.type);

    const impact = (dto.impact ?? actual.impact) as keyof typeof MATRIZ_PRIORIDAD;
    const urgency = (dto.urgency ?? actual.urgency) as keyof typeof MATRIZ_PRIORIDAD[typeof impact];
    if (dto.impact || dto.urgency) {
      const nuevaPrioridad = MATRIZ_PRIORIDAD[impact][urgency];
      asignar('impact', 'impact', impact, actual.impact);
      asignar('urgency', 'urgency', urgency, actual.urgency);
      if (nuevaPrioridad !== actual.priority && !actual.priority_overridden) {
        asignar('priority', 'priority', nuevaPrioridad, actual.priority);
        await this.reajustarSla(id, nuevaPrioridad);
      }
    }

    if (!campos.length) {
      return this.aRespuesta(actual);
    }

    valores.push(id);

    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sigespweb.tickets SET ${campos.join(', ')}, updated_at = NOW()
         WHERE id = $${valores.length}`,
        valores,
      );
      for (const [campo, previo, nuevo] of cambios) {
        if (String(previo) !== String(nuevo)) {
          await this.registrarHistorial(tx, id, agente, campo, previo, nuevo);
        }
      }
    });

    return this.aRespuesta(await this.buscarPorId(id));
  }

  async asignar(id: number, dto: AssignTicketDto, gestor: UsuarioGestor) {
    const actual = await this.buscarPorId(id);
    const esAdmin = gestor.adminUser === 1;
    const agente = await this.agenteId(gestor);
    const assigneeId = dto.tomar ? agente.id : dto.assigneeId;

    if (!esAdmin && assigneeId && assigneeId !== agente.id) {
      throw new ForbiddenException('Solo un administrador puede asignar a otro agente');
    }

    const cambios: Array<[string, unknown, unknown]> = [];
    if (assigneeId && assigneeId !== actual.assignee_id) {
      cambios.push(['assignee_id', actual.assignee_id, assigneeId]);
    }
    if (dto.groupId && dto.groupId !== actual.group_id) {
      cambios.push(['group_id', actual.group_id, dto.groupId]);
    }

    if (!cambios.length) {
      return this.aRespuesta(actual);
    }

    const pasaAAsignado = actual.state === 'nuevo' && Boolean(assigneeId);

    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sigespweb.tickets SET
           assignee_id = COALESCE($1, assignee_id),
           group_id    = COALESCE($2, group_id),
           state       = CASE WHEN $3::boolean THEN 'asignado'::sigespweb.ticket_state ELSE state END,
           updated_at  = NOW()
         WHERE id = $4`,
        [assigneeId ?? null, dto.groupId ?? null, pasaAAsignado, id],
      );

      for (const [campo, previo, nuevo] of cambios) {
        await this.registrarHistorial(tx, id, agente, campo, previo, nuevo);
      }
      if (pasaAAsignado) {
        await this.registrarHistorial(tx, id, agente, 'state', 'nuevo', 'asignado');
      }
    });

    return this.aRespuesta(await this.buscarPorId(id));
  }

  async forzarPrioridad(id: number, dto: OverridePriorityDto, gestor: UsuarioGestor) {
    const actual = await this.buscarPorId(id);
    const agente = await this.agenteId(gestor);

    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sigespweb.tickets SET priority = $1, priority_overridden = TRUE, updated_at = NOW()
         WHERE id = $2`,
        [dto.priority, id],
      );
      await this.registrarHistorial(tx, id, agente, 'priority', actual.priority, dto.priority);
      await this.registrarHistorial(
        tx,
        id,
        agente,
        'priority_override',
        null,
        dto.justificacion,
      );
    });

    await this.reajustarSla(id, dto.priority);
    return this.aRespuesta(await this.buscarPorId(id));
  }

  async cambiarEstado(id: number, dto: ChangeStateDto, gestor: UsuarioGestor) {
    const actual = await this.buscarPorId(id);
    const destino = dto.state;
    const permitidos = TRANSICIONES[actual.state as keyof typeof TRANSICIONES] ?? [];

    if (!permitidos.includes(destino as any)) {
      throw new BadRequestException(
        `No se puede pasar de "${actual.state}" a "${destino}". Estados permitidos: ${permitidos.join(', ') || 'ninguno'}`,
      );
    }

    if (destino === 'resuelto') {
      if (!dto.resolutionCode || !dto.resolutionNotes?.trim()) {
        throw new BadRequestException(
          'Para resolver el ticket debes indicar el código de resolución y las notas',
        );
      }
    }
    if (destino === 'cancelado' && dto.motivo === undefined) {
      throw new BadRequestException('Indica el motivo de la cancelación');
    }
    if (actual.state === 'cerrado' && destino === 'en_progreso') {
      const dias =
        (Date.now() - new Date(actual.closed_at!).getTime()) / 86_400_000;
      if (dias > DIAS_REAPERTURA) {
        throw new BadRequestException(
          `Solo se puede reabrir un ticket dentro de los ${DIAS_REAPERTURA} días posteriores al cierre`,
        );
      }
    }

    const reapertura =
      (actual.state === 'resuelto' || actual.state === 'cerrado') && destino === 'en_progreso';
    const agente = await this.agenteId(gestor);

    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sigespweb.tickets SET
           state = $1::sigespweb.ticket_state,
           hold_reason = CASE WHEN $1::sigespweb.ticket_state = 'en_espera'
                              THEN $2::sigespweb.ticket_hold ELSE NULL END,
           resolution_code = CASE WHEN $1::sigespweb.ticket_state = 'resuelto'
                                  THEN $3::sigespweb.ticket_resolution
                                  WHEN $1::sigespweb.ticket_state = 'en_progreso' THEN NULL
                                  ELSE resolution_code END,
           resolution_notes = CASE WHEN $1::sigespweb.ticket_state = 'resuelto' THEN $4
                                   WHEN $1::sigespweb.ticket_state = 'en_progreso' THEN NULL
                                   ELSE resolution_notes END,
           resolved_at = CASE WHEN $1::sigespweb.ticket_state = 'resuelto' THEN NOW()
                              WHEN $1::sigespweb.ticket_state = 'en_progreso' THEN NULL
                              ELSE resolved_at END,
           closed_at = CASE WHEN $1::sigespweb.ticket_state = 'cerrado' THEN NOW()
                            WHEN $1::sigespweb.ticket_state = 'en_progreso' THEN NULL
                            ELSE closed_at END,
           sla_resolution_breached =
             CASE WHEN $1::sigespweb.ticket_state = 'resuelto'
                  THEN (resolution_due_at IS NOT NULL AND NOW() > resolution_due_at)
                  ELSE sla_resolution_breached END,
           reopen_count = CASE WHEN $5::boolean THEN reopen_count + 1 ELSE reopen_count END,
           assignee_id = CASE WHEN assignee_id IS NULL AND $6::boolean THEN $7 ELSE assignee_id END,
           updated_at = NOW()
         WHERE id = $8`,
        [
          destino,
          dto.holdReason ? this.latin9(dto.holdReason) : null,
          dto.resolutionCode ?? null,
          dto.resolutionNotes ? this.latin9(dto.resolutionNotes.trim()) : null,
          reapertura,
          destino === 'en_progreso',
          agente.id,
          id,
        ],
      );

      await this.registrarHistorial(tx, id, agente, 'state', actual.state, destino);
      if (dto.holdReason) {
        await this.registrarHistorial(tx, id, agente, 'hold_reason', null, dto.holdReason);
      }
      if (destino === 'resuelto') {
        await this.registrarHistorial(
          tx,
          id,
          agente,
          'resolution_code',
          null,
          dto.resolutionCode!,
        );
      }
      if (dto.motivo) {
        await this.registrarHistorial(tx, id, agente, 'motivo', null, dto.motivo);
      }
    });

    return this.aRespuesta(await this.buscarPorId(id));
  }

  /* ==================================================================
   *  MantisBT (envío manual)
   * ================================================================== */

  /**
   * Crea la incidencia en MantisBT para un ticket y guarda el vínculo.
   * El proyecto sale del cliente (`sgh_client.id_mantis_proyect`) salvo que se
   * indique otro. Es una acción manual (botón «Enviar a Mantis»).
   */
  async enviarAMantis(id: number, dto: EnviarMantisDto, gestor: UsuarioGestor) {
    const ticket = await this.buscarPorId(id);

    if (ticket.mantis_issue_id) {
      throw new BadRequestException(
        `El ticket ${ticket.number} ya fue enviado a Mantis (#${ticket.mantis_issue_id}).`,
      );
    }
    if (!ticket.id_client) {
      throw new BadRequestException(
        'El ticket no tiene cliente asociado: no se puede resolver el proyecto de Mantis.',
      );
    }

    const filas = await this.dataSource.query<{ id_mantis_proyect: number | null }[]>(
      `SELECT id_mantis_proyect FROM public.sgh_client WHERE id_client = $1`,
      [ticket.id_client],
    );
    const proyectoId = dto.projectId ?? Number(filas[0]?.id_mantis_proyect ?? 0);
    if (!proyectoId) {
      throw new BadRequestException(
        'El cliente no tiene configurado el «ID Mantis Proyecto». Asígnelo en SGH → Catálogos → Clientes.',
      );
    }

    const proyecto = await this.mantisClient.getProject(proyectoId).catch((e: any) => {
      throw new BadRequestException(
        `No se pudo consultar Mantis (${e?.message ?? e}). Revise MANTIS_BASE_URL / MANTIS_API_TOKEN.`,
      );
    });
    if (!proyecto) {
      throw new BadRequestException(
        `El proyecto de Mantis ${proyectoId} no existe. Revise el «ID Mantis Proyecto» del cliente.`,
      );
    }

    // Mantis exige una categoría. Se usa la indicada o la primera habilitada.
    const categorias = proyecto.categories ?? [];
    const categoriaId = dto.categoryId ?? (categorias.find((c) => c.enabled) ?? categorias[0])?.id;
    if (!categoriaId) {
      throw new BadRequestException(
        `El proyecto de Mantis ${proyecto.id} no tiene categorías. Cree al menos una en Mantis.`,
      );
    }

    // Campos personalizados obligatorios del proyecto (p. ej. «MODULOS ERP»).
    // El valor viene del DTO; si el campo tiene una sola opción, se usa esa.
    const requeridos = (proyecto.customFields ?? []).filter((c) => c.requireReport);
    const customFields = requeridos
      .map((c) => {
        const valor =
          (dto.customFields?.[String(c.id)] ?? '').trim() ||
          (c.possibleValues.length === 1 ? c.possibleValues[0] : '');
        return valor ? { id: c.id, value: valor } : null;
      })
      .filter((c): c is { id: number; value: string } => c !== null);

    if (customFields.length < requeridos.length) {
      const faltan = requeridos
        .filter((c) => !customFields.some((x) => x.id === c.id))
        .map((c) => c.name)
        .join(', ');
      throw new BadRequestException(
        `El proyecto de Mantis «${proyecto.name}» exige el/los campo(s): ${faltan}. ` +
          'Seleccione un valor antes de enviar.',
      );
    }

    const prioridadId =
      MANTIS_PRIORIDAD[dto.priority ?? ticket.priority] ?? MANTIS_PRIORIDAD.P3;
    const severidadId = dto.severity
      ? (MANTIS_SEVERIDAD_POR_NOMBRE[dto.severity] ?? MANTIS_SEVERIDAD.moderado)
      : (MANTIS_SEVERIDAD[ticket.impact] ?? MANTIS_SEVERIDAD.moderado);

    const issue = await this.mantisClient
      .crearIssue({
        projectId: proyecto.id,
        summary: `[${ticket.number}] ${ticket.title}`,
        description: this.descripcionMantis(ticket),
        categoryId: categoriaId,
        priorityId: prioridadId,
        severityId: severidadId,
        handlerId: dto.handlerId,
        customFields,
      })
      .catch((e: any) => {
        throw new BadRequestException(`Mantis rechazó la incidencia: ${e?.message ?? e}`);
      });

    const agente = await this.agenteId(gestor);
    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sigespweb.tickets SET mantis_issue_id = $1, updated_at = NOW() WHERE id = $2`,
        [issue.id, id],
      );
      await this.registrarHistorial(tx, id, agente, 'mantis_issue_id', null, String(issue.id));
    });

    this.logger.log(
      `Ticket ${ticket.number} enviado a Mantis #${issue.id} (proyecto ${proyecto.id})`,
    );

    return {
      ok: true,
      id: issue.id,
      url: issue.url,
      proyecto,
      ticket: this.aRespuesta(await this.buscarPorId(id)),
    };
  }

  /**
   * Usuarios de Mantis con acceso a un proyecto (para elegir el responsable).
   * Se consulta por proyecto: es lo que garantiza que el handler sea válido.
   */
  async usuariosMantisProyecto(proyectoId: number) {
    const proyecto = await this.mantisClient.getProject(proyectoId).catch((e: any) => {
      throw new BadRequestException(
        `No se pudo consultar Mantis (${e?.message ?? e}). Revise MANTIS_BASE_URL / MANTIS_API_TOKEN.`,
      );
    });
    if (!proyecto) {
      throw new BadRequestException(`El proyecto de Mantis ${proyectoId} no existe.`);
    }

    const usuarios = await this.mantisClient.getUsers(proyecto.id).catch((e: any) => {
      throw new BadRequestException(
        `No se pudieron obtener los usuarios de Mantis (${e?.message ?? e}).`,
      );
    });

    return {
      proyecto: {
        id: proyecto.id,
        name: proyecto.name,
        // Solo los obligatorios: la UI debe pedir su valor antes de enviar.
        customFields: (proyecto.customFields ?? []).filter((c) => c.requireReport),
      },
      usuarios,
    };
  }

  /**
   * Estado actual (y comentarios) del caso en Mantis. Solo lectura: alimenta el
   * botón «Sincronizar» del detalle del ticket.
   */
  async estadoMantis(id: number) {
    const ticket = await this.buscarPorId(id);
    if (!ticket.mantis_issue_id) {
      throw new BadRequestException('El ticket todavía no fue enviado a Mantis.');
    }

    const issue = await this.mantisClient.getIssue(ticket.mantis_issue_id).catch((e: any) => {
      throw new BadRequestException(
        `No se pudo consultar Mantis (#${ticket.mantis_issue_id}): ${e?.message ?? e}`,
      );
    });
    if (!issue) {
      throw new NotFoundException(`La incidencia #${ticket.mantis_issue_id} no existe en Mantis.`);
    }

    const nombre = (u: any): string | null => (u ? u.real_name || u.name || String(u.id) : null);
    const status = issue.status
      ? {
          id: Number(issue.status.id),
          name: issue.status.name,
          label: issue.status.label ?? issue.status.name,
        }
      : null;
    const resolucion = issue.resolution
      ? {
          id: Number(issue.resolution.id),
          name: issue.resolution.name,
          label: issue.resolution.label ?? issue.resolution.name,
        }
      : null;

    const notas = (issue.notes ?? []).map((n: any) => ({
      id: Number(n.id),
      autor: nombre(n.reporter) ?? '—',
      fecha: n.created_at ?? null,
      texto: n.text ?? '',
      publico: (n.view_state?.name ?? 'public') === 'public',
    }));

    return {
      issueId: ticket.mantis_issue_id,
      url: this.urlMantis(ticket.mantis_issue_id),
      resumen: issue.summary ?? '',
      status,
      resolucion,
      responsable: nombre(issue.handler),
      informador: nombre(issue.reporter),
      creadoAt: issue.created_at ?? null,
      actualizadoAt: issue.updated_at ?? null,
      cerrado: status?.name === 'closed',
      resuelto: status?.name === 'resolved',
      totalNotas: notas.length,
      notas,
    };
  }

  /**
   * Recorrido paso a paso de una incidencia de Mantis: extrae del historial
   * los cambios de estado y arma las etapas con su duración. Devuelve también
   * las notas. Se consulta en vivo a Mantis (historial completo).
   */
  async seguimientoCaso(mantisIssueId: number) {
    const issue = await this.mantisClient.getIssue(mantisIssueId).catch((e: any) => {
      throw new BadRequestException(
        `No se pudo consultar Mantis (#${mantisIssueId}): ${e?.message ?? e}`,
      );
    });
    if (!issue) {
      throw new NotFoundException(`La incidencia #${mantisIssueId} no existe en Mantis.`);
    }

    const nombre = (u: any): string | null => (u ? u.real_name || u.name || String(u.id) : null);

    const cambios = (Array.isArray(issue.history) ? issue.history : [])
      .filter((h: any) => h?.field?.name === 'status' && h?.new_value?.name)
      .map((h: any) => ({
        estado: String(h.new_value.name),
        fecha: h.created_at ?? null,
        usuario: nombre(h.user),
        desdeEstado: h.old_value?.name || null,
      }))
      .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const inicio = issue.created_at ?? cambios[0]?.fecha ?? null;
    const hitos = [
      {
        estado: cambios[0]?.desdeEstado || issue.status?.name || 'new',
        fecha: inicio,
        usuario: nombre(issue.reporter),
      },
      ...cambios.map((c: any) => ({ estado: c.estado, fecha: c.fecha, usuario: c.usuario })),
    ];

    // Historial de asignaciones (handler) para conocer el responsable vigente en cada etapa
    const nombreOpc = (u: any): string | null => {
      if (!u) return null;
      const n = u.real_name || u.name;
      if (n) return n;
      return u.id != null ? String(u.id) : null;
    };
    const cambiosHandler = (Array.isArray(issue.history) ? issue.history : [])
      .filter((h: any) => h?.field?.name === 'handler')
      .map((h: any) => ({
        fecha: h.created_at ?? null,
        nuevo: nombreOpc(h.new_value),
        anterior: nombreOpc(h.old_value),
      }))
      .filter((h: any) => h.fecha)
      .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    /** Responsable (handler) vigente en una fecha dada, segun el historial de asignaciones. */
    const responsableEn = (fecha: any): string | null => {
      if (!fecha) return nombre(issue.handler);
      const t = new Date(fecha).getTime();
      let actual = cambiosHandler.length ? cambiosHandler[0].anterior : nombre(issue.handler);
      for (const c of cambiosHandler) {
        if (new Date(c.fecha).getTime() <= t) actual = c.nuevo;
        else break;
      }
      return actual;
    };

    const timeline = hitos.map((h, i) => {
      const ini = h.fecha ? new Date(h.fecha).getTime() : null;
      const finFecha = i + 1 < hitos.length ? hitos[i + 1].fecha : issue.updated_at ?? h.fecha;
      const fin = finFecha ? new Date(finFecha).getTime() : null;
      const duracionDias = ini && fin ? Math.max(0, (fin - ini) / 86400000) : 0;
      return {
        etapa: i + 1,
        estado: h.estado,
        inicio: h.fecha,
        fin: finFecha,
        duracionDias: Math.round(duracionDias * 100) / 100,
        informador: h.usuario,
        responsable: responsableEn(h.fecha) || responsableEn(finFecha),
      };
    });

    const notas = (Array.isArray(issue.notes) ? issue.notes : []).map((n: any) => ({
      id: Number(n.id),
      autor: nombre(n.reporter) ?? nombre(n.user) ?? '—',
      fecha: n.created_at ?? n.date_submitted ?? null,
      texto: n.text ?? '',
    }));

    const totalDias = inicio
      ? Math.round(
          ((new Date(issue.updated_at ?? new Date().toISOString()).getTime() -
            new Date(inicio).getTime()) /
            86400000) *
            100,
        ) / 100
      : null;

    return {
      id: issue.id,
      summary: issue.summary ?? '',
      project: issue.project ?? null,
      status: issue.status ?? null,
      priority: issue.priority ?? null,
      severity: issue.severity ?? null,
      handler: issue.handler ?? null,
      reporter: issue.reporter ?? null,
      created_at: issue.created_at ?? null,
      updated_at: issue.updated_at ?? null,
      timeline,
      notas,
      totalDias,
    };
  }

  /* ==================================================================
   *  Carta formal de cierre al cliente (correo)
   * ================================================================== */

  private esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private fecha(iso: unknown): string {
    if (!iso) return '—';
    const f = new Date(String(iso));
    if (isNaN(f.getTime())) return '—';
    const d = String(f.getDate()).padStart(2, '0');
    const m = String(f.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${f.getFullYear()}`;
  }

  private fechaHora(iso: unknown): string {
    if (!iso) return '—';
    const f = new Date(String(iso));
    if (isNaN(f.getTime())) return '—';
    const d = String(f.getDate()).padStart(2, '0');
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const hh = String(f.getHours()).padStart(2, '0');
    const mi = String(f.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${f.getFullYear()} ${hh}:${mi}`;
  }

  /**
   * Normaliza texto para columnas LATIN9 reutilizando el saneador comun
   * (mismo que usa la sincronizacion de Mantis).
   */
  private latin9(valor: unknown): string {
    return sanearLATIN9(String(valor ?? ''));
  }

  /** Devuelve el cuerpo HTML de la carta de cierre. */
  private plantillaCarta(t: TicketRow, mensajes: Array<{ autor: string; body: string; created_at: string }>, mensajeExtra?: string): string {
    const azul = '#0f2f5f';
    const chip = t.state === 'cerrado' ? '#475569' : '#047857';
    const chipTxt = t.state === 'cerrado' ? 'CERRADO' : 'RESUELTO';

    const fila = (k: string, v: string) =>
      `<tr>` +
      `<td style="padding:7px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;width:38%;">${k}</td>` +
      `<td style="padding:7px 12px;border:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${v}</td>` +
      `</tr>`;

    const datos =
      fila('N.º de ticket', this.esc(t.number)) +
      fila('Asunto', this.esc(t.title)) +
      fila('Tipo', this.esc(TIPO_TICKET[t.type] ?? t.type)) +
      fila('Prioridad', this.esc(PRIORIDAD_TICKET[t.priority] ?? t.priority)) +
      fila('Reportado el', this.fecha(t.created_at)) +
      fila('Atendido el', this.fecha(t.resolved_at ?? t.closed_at)) +
      fila('Estado final', `<span style="color:${chip};">${chipTxt}</span>`) +
      (t.mantis_issue_id ? fila('Referencia interna', `Caso #${t.mantis_issue_id}`) : '');

    const conversacion = mensajes.length
      ? mensajes
          .map(
            (m) =>
              `<div style="border-left:3px solid #cbd5e1;padding:2px 0 2px 12px;margin:0 0 12px;">` +
              `<div style="font-size:11px;color:#94a3b8;">${this.esc(m.autor)} · ${this.fechaHora(m.created_at)}</div>` +
              `<div style="font-size:13px;color:#334155;white-space:pre-line;">${this.esc(m.body)}</div>` +
              `</div>`,
          )
          .join('')
      : '<p style="font-size:13px;color:#94a3b8;margin:0;">Sin respuestas registradas.</p>';

    const resolucion = [
      t.resolution_code
        ? `Código: ${this.esc(RESOLUCION_TICKET[t.resolution_code] ?? t.resolution_code)}`
        : '',
      t.resolution_notes ? `Notas: ${this.esc(t.resolution_notes)}` : '',
    ]
      .filter(Boolean)
      .join('<br/>');

    const extra = mensajeExtra?.trim()
      ? `<p style="font-size:14px;color:#334155;line-height:1.6;">${this.esc(mensajeExtra)}</p>`
      : '';

    return (
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"/></head>` +
      `<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;"><tr><td align="center">` +
      `<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(15,47,95,.12);">` +
      `<tr><td style="background:${azul};padding:24px 28px;">` +
      `<div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">SIGESP</div>` +
      `<div style="color:#9fc0e8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Mesa de Ayuda y Soporte</div>` +
      `</td></tr>` +
      `<tr><td style="padding:24px 28px 0;">` +
      `<span style="display:inline-block;background:${chip}1a;color:${chip};border:1px solid ${chip}55;border-radius:999px;padding:4px 12px;font-size:11px;font-weight:700;letter-spacing:1px;">${chipTxt}</span>` +
      `<h1 style="margin:14px 0 4px;font-size:19px;color:#0f172a;">Carta de cierre de caso</h1>` +
      `<p style="margin:0;font-size:13px;color:#64748b;">Notificación formal de atención</p>` +
      `</td></tr>` +
      `<tr><td style="padding:18px 28px 8px;">` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 6px;">Estimado(a) <b>${this.esc(t.requester_name)}</b>:</p>` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 14px;">Le informamos que el caso reportado por ` +
      `<b>${this.esc(t.client_name ?? 'su institución')}</b>` +
      (t.client_rif ? ` <span style="color:#64748b;">(RIF ${this.esc(t.client_rif)})</span>` : '') +
      ` a nuestra mesa de ayuda ha sido <b>atendido y ${t.state === 'cerrado' ? 'cerrado' : 'resuelto'}</b>. ` +
      `A continuación el resumen del caso.</p>` +
      extra +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 18px;">${datos}</table>` +
      `<h2 style="margin:0 0 8px;font-size:14px;color:#0f2f5f;">Seguimiento del caso</h2>` +
      `<div style="margin:0 0 18px;">${conversacion}</div>` +
      (resolucion
        ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin:0 0 18px;">` +
          `<div style="font-size:11px;color:#166534;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;">Solución</div>` +
          `<div style="font-size:13px;color:#14532d;line-height:1.6;">${resolucion}</div></div>`
        : '') +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 8px;">Si el caso se reabre o requiere asistencia adicional, ` +
      `puede responder este correo o escribirnos a <a href="mailto:soporte@sigesp.com.ve" style="color:#1d4ed8;text-decoration:none;">soporte@sigesp.com.ve</a> ` +
      `indicando el número de ticket <b>${this.esc(t.number)}</b>.</p>` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 4px;">Agradecemos su confianza en nuestro equipo.</p>` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0;">Atentamente,</p>` +
      `<p style="font-size:14px;color:#0f172a;font-weight:600;margin:2px 0 0;">Mesa de Ayuda SIGESP</p>` +
      `</td></tr>` +
      `<tr><td style="padding:0 28px 24px;">` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;"/>` +
      `<p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">` +
      `<b style="color:#64748b;">SIGESP, C.A.</b> · Soporte técnico y de aplicaciones<br/>` +
      `soporte@sigesp.com.ve · Este mensaje fue generado automáticamente desde la mesa de ayuda.</p>` +
      `</td></tr></table></td></tr></table></body></html>`
    );
  }

  /** Versión en texto plano (respaldo del correo). */
  private textoCarta(t: TicketRow, mensajes: Array<{ autor: string; body: string; created_at: string }>, mensajeExtra?: string): string {
    const lineas = [
      'SIGESP · Mesa de Ayuda y Soporte',
      '',
      `CARTA DE CIERRE DE CASO (${t.state === 'cerrado' ? 'CERRADO' : 'RESUELTO'})`,
      '',
      `Estimado(a) ${t.requester_name}:`,
      '',
      `Le informamos que el caso reportado por ${t.client_name ?? ''}${t.client_rif ? ` (RIF ${t.client_rif})` : ''} ha sido atendido.`,
      '',
      `Ticket    : ${t.number}`,
      `Asunto    : ${t.title}`,
      `Tipo      : ${TIPO_TICKET[t.type] ?? t.type}`,
      `Prioridad : ${PRIORIDAD_TICKET[t.priority] ?? t.priority}`,
      `Reportado : ${this.fecha(t.created_at)}`,
      `Atendido  : ${this.fecha(t.resolved_at ?? t.closed_at)}`,
    ];
    if (t.mantis_issue_id) lineas.push(`Referencia interna: Caso #${t.mantis_issue_id}`);
    if (mensajeExtra?.trim()) lineas.push('', mensajeExtra.trim());
    if (mensajes.length) {
      lineas.push('', 'SEGUIMIENTO DEL CASO:');
      for (const m of mensajes) {
        lineas.push(`  - [${this.fechaHora(m.created_at)}] ${m.autor}: ${m.body}`);
      }
    }
    if (t.resolution_code || t.resolution_notes) {
      lineas.push('', 'SOLUCIÓN:');
      if (t.resolution_code) {
        lineas.push(`  Código: ${RESOLUCION_TICKET[t.resolution_code] ?? t.resolution_code}`);
      }
      if (t.resolution_notes) lineas.push(`  Notas: ${t.resolution_notes}`);
    }
    lineas.push(
      '',
      'Si necesita asistencia adicional, responda este correo o escriba a soporte@sigesp.com.ve',
      `indicando el número de ticket ${t.number}.`,
      '',
      'Atentamente,',
      'Mesa de Ayuda SIGESP',
      '',
      'SIGESP, C.A. · soporte@sigesp.com.ve',
    );
    return lineas.join('\n');
  }

  /**
   * Envía la carta formal de cierre al cliente. Solo para tickets en estado
   * «resuelto» o «cerrado». Queda registrado en el historial del ticket.
   */
  async enviarCartaCierre(
    id: number,
    dto: NotificarCierreDto,
    gestor: UsuarioGestor,
    opciones: { cc?: string; permitirSinCorreo?: boolean } = {},
  ) {
    const ticket = await this.buscarPorId(id);

    if (ticket.state !== 'resuelto' && ticket.state !== 'cerrado') {
      throw new BadRequestException(
        `La carta de cierre solo se envía cuando el ticket está «resuelto» o «cerrado» (estado actual: «${ticket.state}»).`,
      );
    }

    let destinatario = (dto.destinatario ?? '').trim() || (ticket.requester_email ?? '').trim();
    if (!destinatario && ticket.id_client) {
      const filas = await this.dataSource.query<{ email: string | null }[]>(
        `SELECT email FROM public.sgh_client WHERE id_client = $1`,
        [ticket.id_client],
      );
      destinatario = (filas[0]?.email ?? '').trim();
    }
    if (!destinatario) {
      if (opciones.permitirSinCorreo) {
        return {
          enviado: false,
          simulado: false,
          sinDestinatario: true,
          destinatario: '',
          asunto: `Carta de cierre · ${ticket.number} · ${ticket.title}`,
          mensajesIncluidos: 0,
        };
      }
      throw new BadRequestException(
        'El ticket no tiene correo de contacto. Indique un destinatario o cargue el correo del cliente.',
      );
    }

    let mensajes: Array<{ autor: string; body: string; created_at: string }> = [];
    if (dto.incluirConversacion !== false) {
      mensajes = await this.dataSource.query(
        `SELECT COALESCE(u.username, m.author_name) AS autor, m.body, m.created_at
           FROM sigespweb.ticket_messages m
           LEFT JOIN sigespweb.usuarios u ON u.id = m.author_id
          WHERE m.ticket_id = $1 AND m.is_internal = FALSE AND m.deleted_at IS NULL
          ORDER BY m.created_at ASC`,
        [id],
      );
    }

    const asunto = `Carta de cierre · ${ticket.number} · ${ticket.title}`;
    const html = this.plantillaCarta(ticket, mensajes, dto.mensaje);
    const texto = this.textoCarta(ticket, mensajes, dto.mensaje);

    // Vista previa: se devuelve la carta armada sin enviarla.
    if (dto.previsualizar) {
      return {
        enviado: false,
        simulado: false,
        previsualizacion: true,
        destinatario,
        asunto,
        mensajesIncluidos: mensajes.length,
        html,
        texto,
      };
    }

    const envio = await this.mail.enviar({
      para: destinatario,
      cc: opciones.cc,
      asunto,
      html,
      texto,
      responderA: (process.env.MAIL_FROM || '').trim() || undefined,
    });

    const agente = await this.agenteId(gestor);
    await this.dataSource.transaction(async (tx) => {
      await this.registrarHistorial(
        tx,
        id,
        agente,
        'notificacion_cliente',
        null,
        `${asunto} -> ${destinatario}`,
      );
    });

    this.logger.log(`Carta de cierre del ticket ${ticket.number} enviada a ${destinatario}`);

    return {
      enviado: envio.enviado,
      simulado: envio.simulado,
      destinatario,
      cc: opciones.cc ?? null,
      asunto,
      mensajesIncluidos: mensajes.length,
      ticket: this.aRespuesta(await this.buscarPorId(id)),
    };
  }

  /**
   * Cierra el ticket automáticamente porque el caso está cerrado en Mantis:
   * crea la conversación de cierre, cierra el ticket y envía la carta al cliente
   * (con copia a calidad). Idempotente: si ya está cerrado, no hace nada.
   */
  async cerrarDesdeMantis(id: number, dto: CerrarDesdeMantisDto, gestor: UsuarioGestor) {
    const ticket = await this.buscarPorId(id);

    if (ticket.state === 'cerrado') {
      return {
        yaCerrado: true,
        enviado: false,
        sinCorreo: false,
        destinatario: null,
        mensajesIncluidos: 0,
        ticket: this.aRespuesta(ticket),
      };
    }
    if (!ticket.mantis_issue_id) {
      throw new BadRequestException('El ticket no tiene un caso asociado en Mantis.');
    }

    // Verificación en vivo: el caso debe estar cerrado o resuelto en Mantis.
    const estado = await this.estadoMantis(id);
    if (!estado.cerrado && !estado.resuelto) {
      throw new BadRequestException(
        `El caso #${ticket.mantis_issue_id} no está cerrado en Mantis (estado: «${estado.status?.name ?? '—'}»).`,
      );
    }

    const agente = await this.agenteId(gestor);
    const textoConversacion = this.latin9(
      (dto.mensaje ?? '').trim() || this.textoCierreAutomatico(ticket),
    );

    // Conversación de cierre + cierre del ticket + trazabilidad (atómico).
    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO sigespweb.ticket_messages (ticket_id, author_id, author_name, body, is_internal)
         VALUES ($1, $2, $3, $4, FALSE)`,
        [id, agente.id, agente.username, textoConversacion],
      );
      await tx.query(
        `INSERT INTO sigespweb.ticket_messages (ticket_id, author_id, author_name, body, is_internal)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [
          id,
          agente.id,
          agente.username,
          this.latin9(
            `[CIERRE AUTOMÁTICO] El caso #${ticket.mantis_issue_id} está cerrado en Mantis ` +
              `(estado: ${estado.status?.name ?? '-'}). Cierre ejecutado por ${agente.username}.`,
          ),
        ],
      );
      await tx.query(
        `UPDATE sigespweb.tickets SET
           state = 'cerrado',
           closed_at = NOW(),
           resolved_at = COALESCE(resolved_at, NOW()),
           resolution_code = COALESCE($2::sigespweb.ticket_resolution, resolution_code),
           resolution_notes = COALESCE($3, resolution_notes),
           updated_at = NOW()
         WHERE id = $1`,
        [id, dto.resolutionCode ?? null, dto.resolutionNotes ? this.latin9(dto.resolutionNotes.trim()) : null],
      );
      await this.registrarHistorial(tx, id, agente, 'state', ticket.state, 'cerrado');
      await this.registrarHistorial(
        tx,
        id,
        agente,
        'cierre_automatico_mantis',
        null,
        `#${ticket.mantis_issue_id}`,
      );
    });

    // Carta de cierre al cliente (incluye la conversación) con copia a calidad.
    if (dto.notificar === false) {
      this.logger.log(
        `Ticket ${ticket.number} cerrado automáticamente sin notificar (caso Mantis #${ticket.mantis_issue_id}).`,
      );
      return {
        yaCerrado: false,
        notificado: false,
        sinCorreo: false,
        enviado: false,
        mensajesIncluidos: 0,
        ticket: this.aRespuesta(await this.buscarPorId(id)),
      };
    }

    const calidad =
      (process.env.SOPORTE_CALIDAD_EMAIL || '').trim() || 'calidad@sigesp.com.ve';
    const carta = await this.enviarCartaCierre(
      id,
      { incluirConversacion: dto.incluirConversacion !== false, destinatario: dto.destinatario },
      gestor,
      { cc: calidad, permitirSinCorreo: true },
    );

    this.logger.log(
      `Ticket ${ticket.number} cerrado automáticamente (caso Mantis #${ticket.mantis_issue_id}).`,
    );

    return {
      yaCerrado: false,
      notificado: true,
      sinCorreo: (carta as any).sinDestinatario === true,
      ...carta,
      ticket: this.aRespuesta(await this.buscarPorId(id)),
    };
  }

  /** Texto de la conversación automática de cierre (plantilla con marcadores). */
  private textoCierreAutomatico(t: TicketRow): string {
    const fecha = this.fecha(new Date().toISOString());
    const resolucion = t.resolution_code
      ? RESOLUCION_TICKET[t.resolution_code] ?? t.resolution_code
      : '';
    const notas = (t.resolution_notes ?? '').trim();

    const lineas = [
      `Estimado(a) ${t.requester_name}:`,
      '',
      `Le informamos que su caso ${t.number} - «${t.title}» ha sido atendido y cerrado por nuestro equipo de soporte el ${fecha}.`,
      '',
    ];
    if (resolucion || notas) {
      lineas.push(`Resolución: ${resolucion}${notas ? ' ' + notas : ''}`, '');
    }
    lineas.push(
      `Si requiere asistencia adicional o el caso se reabre, puede responder este correo o escribir a soporte@sigesp.com.ve indicando el número de ticket ${t.number}.`,
      '',
      'Agradecemos su confianza en nuestro equipo.',
      '',
      'Atentamente,',
      'Mesa de Ayuda SIGESP',
      'SIGESP, C.A.',
    );
    return lineas.join('\n');
  }

  /**
   * Envía la incidencia (datos del ticket + sus documentos adjuntos) por correo.
   * Destinatario por defecto: calidad@sigesp.com.ve (configurable con la variable
   * SOPORTE_CALIDAD_EMAIL y sobreescribible con dto.destinatario).
   */
  async enviarIncidenciaCorreo(
    id: number,
    dto: EnviarCorreoIncidenciaDto,
    gestor: UsuarioGestor,
  ) {
    const ticket = await this.buscarPorId(id);

    const destinatario =
      (dto.destinatario ?? '').trim() ||
      (process.env.SOPORTE_CALIDAD_EMAIL || '').trim() ||
      'calidad@sigesp.com.ve';

    // Documentos adjuntos del ticket (se envían como adjuntos reales del correo).
    const filas = await this.dataSource.query<
      { filename: string; stored_name: string; mimetype: string }[]
    >(
      `SELECT filename, stored_name, mimetype
         FROM sigespweb.ticket_attachments
        WHERE ticket_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC`,
      [id],
    );
    const adjuntos: Array<{ filename: string; path: string; contentType: string }> = [];
    const faltantes: string[] = [];
    for (const f of filas) {
      const ruta = path.join(this.raizTickets, f.stored_name);
      try {
        await fs.access(ruta);
        adjuntos.push({ filename: f.filename, path: ruta, contentType: f.mimetype });
      } catch {
        // El archivo está registrado pero no existe en disco (ruta mal configurada).
        faltantes.push(f.filename);
        this.logger.warn(
          `Adjunto NO encontrado (ticket ${ticket.number}): ${f.filename} -> ${ruta}. ` +
            `Revise TICKETS_STORAGE_ROOT / STORAGE_ROOT.`,
        );
      }
    }

    let mensajes: Array<{ autor: string; body: string; created_at: string }> = [];
    if (dto.incluirConversacion) {
      mensajes = await this.dataSource.query(
        `SELECT COALESCE(u.username, m.author_name) AS autor, m.body, m.created_at
           FROM sigespweb.ticket_messages m
           LEFT JOIN sigespweb.usuarios u ON u.id = m.author_id
          WHERE m.ticket_id = $1 AND m.is_internal = FALSE AND m.deleted_at IS NULL
          ORDER BY m.created_at ASC`,
        [id],
      );
    }

    const nombres = adjuntos.map((a) => a.filename);
    const asunto = `Incidencia ${ticket.number} · ${ticket.title}`;
    const html = this.plantillaIncidencia(ticket, mensajes, dto.mensaje, nombres, faltantes);
    const texto = this.textoIncidencia(ticket, nombres, dto.mensaje, faltantes);

    const envio = await this.mail.enviar({
      para: destinatario,
      asunto,
      html,
      texto,
      responderA: (process.env.MAIL_FROM || '').trim() || undefined,
      adjuntos,
    });

    const agente = await this.agenteId(gestor);
    await this.dataSource.transaction(async (tx) => {
      await this.registrarHistorial(
        tx,
        id,
        agente,
        'envio_correo',
        null,
        `${asunto} -> ${destinatario} (${adjuntos.length} adjunto(s)` +
          (faltantes.length ? `, ${faltantes.length} no disponible(s)` : '') +
          `)`,
      );
    });

    this.logger.log(
      `Incidencia ${ticket.number} enviada a ${destinatario} con ${adjuntos.length} adjunto(s)` +
        (faltantes.length ? ` (${faltantes.length} no disponible(s))` : ''),
    );

    return {
      enviado: envio.enviado,
      simulado: envio.simulado,
      destinatario,
      asunto,
      adjuntos: adjuntos.length,
      adjuntosFaltantes: faltantes.length,
      faltantes,
      ticket: this.aRespuesta(await this.buscarPorId(id)),
    };
  }

  /**
   * Envía manualmente el SEGUIMIENTO del ticket (comentarios) al cliente.
   * El agente decide qué comentarios incluir; los internos NUNCA se envían:
   * la consulta siempre filtra `is_internal = FALSE`, aunque el cliente de la
   * API intente incluir ids de notas internas.
   */
  async enviarSeguimientoCliente(id: number, dto: EnviarSeguimientoDto, gestor: UsuarioGestor) {
    const ticket = await this.buscarPorId(id);

    let destinatario = (dto.destinatario ?? '').trim() || (ticket.requester_email ?? '').trim();
    if (!destinatario && ticket.id_client) {
      const filas = await this.dataSource.query<{ email: string | null }[]>(
        `SELECT email FROM public.sgh_client WHERE id_client = $1`,
        [ticket.id_client],
      );
      destinatario = (filas[0]?.email ?? '').trim();
    }
    if (!destinatario) {
      throw new BadRequestException(
        'El ticket no tiene correo de contacto. Indique un destinatario o cargue el correo del cliente.',
      );
    }

    // Comentarios incluidos: SIEMPRE públicos (is_internal = FALSE).
    const params: unknown[] = [id];
    let filtroIds = '';
    const ids = (dto.mensajeIds ?? []).map(Number).filter((n) => Number.isFinite(n));
    if (ids.length) {
      params.push(ids);
      filtroIds = ` AND m.id = ANY($${params.length}::int[])`;
    }
    const mensajes: Array<{ autor: string; body: string; created_at: string }> =
      await this.dataSource.query(
        `SELECT COALESCE(u.username, m.author_name) AS autor, m.body, m.created_at
           FROM sigespweb.ticket_messages m
           LEFT JOIN sigespweb.usuarios u ON u.id = m.author_id
          WHERE m.ticket_id = $1 AND m.is_internal = FALSE AND m.deleted_at IS NULL${filtroIds}
          ORDER BY m.created_at ASC`,
        params,
      );

    // Adjuntos del ticket (opcional, se envían como adjuntos reales del correo).
    const adjuntos: Array<{ filename: string; path: string; contentType: string }> = [];
    const faltantes: string[] = [];
    if (dto.incluirAdjuntos) {
      const filas = await this.dataSource.query<
        { filename: string; stored_name: string; mimetype: string }[]
      >(
        `SELECT filename, stored_name, mimetype
           FROM sigespweb.ticket_attachments
          WHERE ticket_id = $1 AND deleted_at IS NULL
          ORDER BY created_at ASC`,
        [id],
      );
      for (const f of filas) {
        const ruta = path.join(this.raizTickets, f.stored_name);
        try {
          await fs.access(ruta);
          adjuntos.push({ filename: f.filename, path: ruta, contentType: f.mimetype });
        } catch {
          faltantes.push(f.filename);
          this.logger.warn(
            `Adjunto NO encontrado (ticket ${ticket.number}): ${f.filename} -> ${ruta}. ` +
              `Revise TICKETS_STORAGE_ROOT / STORAGE_ROOT.`,
          );
        }
      }
    }

    const asunto = `Seguimiento del caso · ${ticket.number} · ${ticket.title}`;
    const html = this.plantillaSeguimiento(ticket, mensajes, dto.mensaje, adjuntos.map((a) => a.filename));
    const texto = this.textoSeguimiento(ticket, mensajes, dto.mensaje);

    if (dto.previsualizar) {
      return {
        enviado: false,
        simulado: false,
        previsualizacion: true,
        destinatario,
        asunto,
        mensajesIncluidos: mensajes.length,
        adjuntos: adjuntos.length,
        adjuntosFaltantes: faltantes.length,
        html,
        texto,
      };
    }

    const envio = await this.mail.enviar({
      para: destinatario,
      asunto,
      html,
      texto,
      responderA: (process.env.MAIL_FROM || '').trim() || undefined,
      adjuntos,
    });

    const agente = await this.agenteId(gestor);
    await this.dataSource.transaction(async (tx) => {
      await this.registrarHistorial(
        tx,
        id,
        agente,
        'seguimiento_cliente',
        null,
        `${asunto} -> ${destinatario} (${mensajes.length} comentario(s)` +
          (dto.incluirAdjuntos ? `, ${adjuntos.length} adjunto(s)` : '') +
          (faltantes.length ? `, ${faltantes.length} no disponible(s)` : '') +
          `)`,
      );
    });

    this.logger.log(
      `Seguimiento del ticket ${ticket.number} enviado a ${destinatario} (${mensajes.length} comentario(s)` +
        (dto.incluirAdjuntos ? `, ${adjuntos.length} adjunto(s)` : '') +
        (faltantes.length ? `, ${faltantes.length} no disponible(s)` : '') +
        `)`,
    );

    return {
      enviado: envio.enviado,
      simulado: envio.simulado,
      destinatario,
      asunto,
      mensajesIncluidos: mensajes.length,
      adjuntos: adjuntos.length,
      adjuntosFaltantes: faltantes.length,
      ticket: this.aRespuesta(await this.buscarPorId(id)),
    };
  }

  /** Plantilla HTML del correo de seguimiento (solo comentarios públicos). */
  private plantillaSeguimiento(
    t: TicketRow,
    mensajes: Array<{ autor: string; body: string; created_at: string }>,
    mensajeExtra: string | undefined,
    nombresAdjuntos: string[],
  ): string {
    const azul = '#0f2f5f';
    const fila = (k: string, v: string) =>
      `<tr>` +
      `<td style="padding:7px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;width:38%;">${k}</td>` +
      `<td style="padding:7px 12px;border:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${v}</td>` +
      `</tr>`;

    const datos =
      fila('N.º de ticket', this.esc(t.number)) +
      fila('Asunto', this.esc(t.title)) +
      fila('Estado', this.esc(ETIQUETA_ESTADO[t.state] ?? t.state)) +
      fila('Prioridad', this.esc(PRIORIDAD_TICKET[t.priority] ?? t.priority)) +
      (t.assignee_nombre ? fila('Responsable', this.esc(t.assignee_nombre)) : '') +
      fila('Reportado el', this.fecha(t.created_at));

    const conversacion = mensajes.length
      ? mensajes
          .map(
            (m) =>
              `<div style="border-left:3px solid #cbd5e1;padding:2px 0 2px 12px;margin:0 0 12px;">` +
              `<div style="font-size:11px;color:#94a3b8;">${this.esc(m.autor)} · ${this.fechaHora(m.created_at)}</div>` +
              `<div style="font-size:13px;color:#334155;white-space:pre-line;">${this.esc(m.body)}</div>` +
              `</div>`,
          )
          .join('')
      : '<p style="font-size:13px;color:#94a3b8;margin:0;">Sin comentarios para mostrar.</p>';

    const extra = mensajeExtra?.trim()
      ? `<p style="font-size:14px;color:#334155;line-height:1.6;">${this.esc(mensajeExtra)}</p>`
      : '';

    const adjuntosHtml = nombresAdjuntos.length
      ? `<h2 style="margin:18px 0 8px;font-size:14px;color:${azul};">Documentos adjuntos (${nombresAdjuntos.length})</h2>` +
        `<ul style="margin:0 0 18px;padding-left:18px;font-size:13px;color:#334155;">` +
        nombresAdjuntos.map((n) => `<li>${this.esc(n)}</li>`).join('') +
        `</ul>`
      : '';

    return (
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/></head>` +
      `<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;"><tr><td align="center">` +
      `<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(15,47,95,.12);">` +
      `<tr><td style="background:${azul};padding:24px 28px;">` +
      `<div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">SIGESP</div>` +
      `<div style="color:#9fc0e8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Mesa de Ayuda y Soporte</div>` +
      `</td></tr>` +
      `<tr><td style="padding:24px 28px 0;">` +
      `<h1 style="margin:0 0 4px;font-size:19px;color:#0f172a;">Seguimiento del caso</h1>` +
      `<p style="margin:0;font-size:13px;color:#64748b;">Actualización de su incidencia</p>` +
      `</td></tr>` +
      `<tr><td style="padding:18px 28px 8px;">` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 6px;">Estimado(a) <b>${this.esc(t.requester_name)}</b>:</p>` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 14px;">A continuación le compartimos el seguimiento del caso reportado a nuestra mesa de ayuda.</p>` +
      extra +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 18px;">${datos}</table>` +
      `<h2 style="margin:0 0 8px;font-size:14px;color:${azul};">Comentarios</h2>` +
      `<div style="margin:0 0 18px;">${conversacion}</div>` +
      adjuntosHtml +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 4px;">Si requiere asistencia adicional, responda este correo indicando el número de ticket <b>${this.esc(t.number)}</b>.</p>` +
      `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0;">Atentamente,</p>` +
      `<p style="font-size:14px;color:#0f172a;font-weight:600;margin:2px 0 0;">Mesa de Ayuda SIGESP</p>` +
      `</td></tr>` +
      `<tr><td style="padding:0 28px 24px;">` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;"/>` +
      `<p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">` +
      `<b style="color:#64748b;">SIGESP, C.A.</b> · Soporte técnico y de aplicaciones<br/>` +
      `soporte@sigesp.com.ve · Este mensaje fue generado automáticamente desde la mesa de ayuda.</p>` +
      `</td></tr></table></td></tr></table></body></html>`
    );
  }

  /** Versión en texto plano del correo de seguimiento. */
  private textoSeguimiento(
    t: TicketRow,
    mensajes: Array<{ autor: string; body: string; created_at: string }>,
    mensajeExtra?: string,
  ): string {
    const lineas = [
      'SIGESP · Mesa de Ayuda y Soporte',
      '',
      'SEGUIMIENTO DEL CASO',
      '',
      `Estimado(a) ${t.requester_name}:`,
      '',
      `Ticket    : ${t.number}`,
      `Asunto    : ${t.title}`,
      `Estado    : ${ETIQUETA_ESTADO[t.state] ?? t.state}`,
      `Prioridad : ${PRIORIDAD_TICKET[t.priority] ?? t.priority}`,
    ];
    if (mensajeExtra?.trim()) lineas.push('', mensajeExtra.trim());
    if (mensajes.length) {
      lineas.push('', 'COMENTARIOS:');
      for (const m of mensajes) {
        lineas.push(`  - [${this.fechaHora(m.created_at)}] ${m.autor}: ${m.body}`);
      }
    }
    lineas.push(
      '',
      'Si necesita asistencia adicional, responda este correo indicando el número de ticket.',
      '',
      'Atentamente,',
      'Mesa de Ayuda SIGESP',
      '',
      'SIGESP, C.A. · soporte@sigesp.com.ve',
    );
    return lineas.join('\n');
  }

  /** Plantilla HTML del correo de la incidencia (con o sin conversación). */
  private plantillaIncidencia(
    t: TicketRow,
    mensajes: Array<{ autor: string; body: string; created_at: string }>,
    mensajeExtra: string | undefined,
    nombresAdjuntos: string[],
    faltantes: string[] = [],
  ): string {
    const azul = '#0f2f5f';
    const fila = (k: string, v: string) =>
      `<tr>` +
      `<td style="padding:7px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:12px;width:38%;">${k}</td>` +
      `<td style="padding:7px 12px;border:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${v}</td>` +
      `</tr>`;

    const datos =
      fila('N.º de ticket', this.esc(t.number)) +
      fila('Asunto', this.esc(t.title)) +
      fila('Tipo', this.esc(TIPO_TICKET[t.type] ?? t.type)) +
      fila('Estado', this.esc(ETIQUETA_ESTADO[t.state] ?? t.state)) +
      fila('Prioridad', this.esc(PRIORIDAD_TICKET[t.priority] ?? t.priority)) +
      fila('Canal', this.esc(t.channel)) +
      fila('Cliente', this.esc(t.client_name ?? t.requester_name)) +
      (t.client_rif ? fila('RIF', this.esc(t.client_rif)) : '') +
      fila('Solicitante', this.esc(t.requester_name)) +
      (t.requester_email ? fila('Correo del solicitante', this.esc(t.requester_email)) : '') +
      (t.assignee_nombre ? fila('Responsable', this.esc(t.assignee_nombre)) : '') +
      (t.affected_user ? fila('Usuario afectado', this.esc(t.affected_user)) : '') +
      (t.service ? fila('Servicio', this.esc(t.service)) : '') +
      fila('Reportado el', this.fecha(t.created_at));

    const descripcion = t.description
      ? `<h2 style="margin:0 0 8px;font-size:14px;color:${azul};">Descripción</h2>` +
        `<p style="font-size:13px;color:#334155;white-space:pre-line;line-height:1.6;margin:0 0 18px;">${this.esc(t.description)}</p>`
      : '';

    const adjuntosHtml =
      (nombresAdjuntos.length
        ? `<h2 style="margin:0 0 8px;font-size:14px;color:${azul};">Documentos adjuntos (${nombresAdjuntos.length})</h2>` +
          `<ul style="margin:0 0 18px;padding-left:18px;font-size:13px;color:#334155;">` +
          nombresAdjuntos.map((n) => `<li>${this.esc(n)}</li>`).join('') +
          `</ul>`
        : `<p style="font-size:13px;color:#94a3b8;margin:0 0 18px;">Sin documentos adjuntos.</p>`) +
      (faltantes.length
        ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin:0 0 18px;font-size:12px;color:#92400e;">` +
          `<b>${faltantes.length} adjunto(s) no se pudieron incluir</b> (no se encontraron en el servidor):<br/>` +
          faltantes.map((n) => `• ${this.esc(n)}`).join('<br/>') +
          `</div>`
        : '');

    const conversacion = mensajes.length
      ? `<h2 style="margin:0 0 8px;font-size:14px;color:${azul};">Conversación (${mensajes.length})</h2>` +
        mensajes
          .map(
            (m) =>
              `<div style="border-left:3px solid #cbd5e1;padding:2px 0 2px 12px;margin:0 0 12px;">` +
              `<div style="font-size:11px;color:#94a3b8;">${this.esc(m.autor)} · ${this.fechaHora(m.created_at)}</div>` +
              `<div style="font-size:13px;color:#334155;white-space:pre-line;">${this.esc(m.body)}</div>` +
              `</div>`,
          )
          .join('')
      : '';

    const extra = mensajeExtra?.trim()
      ? `<p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 14px;">${this.esc(mensajeExtra)}</p>`
      : '';

    return (
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"/></head>` +
      `<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;"><tr><td align="center">` +
      `<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(15,47,95,.12);">` +
      `<tr><td style="background:${azul};padding:24px 28px;">` +
      `<div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">SIGESP</div>` +
      `<div style="color:#9fc0e8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Mesa de Ayuda y Soporte</div>` +
      `</td></tr>` +
      `<tr><td style="padding:24px 28px 4px;">` +
      `<h1 style="margin:0 0 4px;font-size:19px;color:#0f172a;">Detalle de la incidencia</h1>` +
      `<p style="margin:0;font-size:13px;color:#64748b;">Envío del ticket con sus documentos adjuntos</p>` +
      `</td></tr>` +
      `<tr><td style="padding:16px 28px 8px;">` +
      extra +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 18px;">${datos}</table>` +
      descripcion +
      conversacion +
      adjuntosHtml +
      `<p style="font-size:13px;color:#334155;line-height:1.6;margin:0;">Atentamente,</p>` +
      `<p style="font-size:14px;color:#0f172a;font-weight:600;margin:2px 0 0;">Mesa de Ayuda SIGESP</p>` +
      `</td></tr>` +
      `<tr><td style="padding:0 28px 24px;">` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;"/>` +
      `<p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">` +
      `<b style="color:#64748b;">SIGESP, C.A.</b> · Soporte técnico y de aplicaciones<br/>` +
      `soporte@sigesp.com.ve · Este mensaje fue generado automáticamente desde la mesa de ayuda.</p>` +
      `</td></tr></table></td></tr></table></body></html>`
    );
  }

  /** Versión en texto plano del correo de la incidencia. */
  private textoIncidencia(
    t: TicketRow,
    nombresAdjuntos: string[],
    mensajeExtra?: string,
    faltantes: string[] = [],
  ): string {
    const lineas = [
      'SIGESP · Mesa de Ayuda y Soporte',
      '',
      `Incidencia ${t.number} · ${t.title}`,
      `Tipo      : ${TIPO_TICKET[t.type] ?? t.type}`,
      `Estado    : ${ETIQUETA_ESTADO[t.state] ?? t.state}`,
      `Prioridad : ${PRIORIDAD_TICKET[t.priority] ?? t.priority}`,
      `Canal     : ${t.channel}`,
      `Cliente   : ${t.client_name ?? '—'}${t.client_rif ? ` (${t.client_rif})` : ''}`,
      `Solicitante: ${t.requester_name}${t.requester_email ? ` <${t.requester_email}>` : ''}`,
      `Reportado : ${this.fecha(t.created_at)}`,
      '',
      'Descripción:',
      t.description ?? '',
      '',
    ];
    if (mensajeExtra?.trim()) lineas.push(`Nota: ${mensajeExtra.trim()}`, '');
    if (nombresAdjuntos.length) {
      lineas.push(`Documentos adjuntos (${nombresAdjuntos.length}):`);
      nombresAdjuntos.forEach((n) => lineas.push(`  - ${n}`));
    } else {
      lineas.push('Sin documentos adjuntos.');
    }
    if (faltantes.length) {
      lineas.push(
        `AVISO: ${faltantes.length} adjunto(s) NO se pudieron incluir (no encontrados en el servidor):`,
      );
      faltantes.forEach((n) => lineas.push(`  - ${n}`));
    }
    return lineas.join('\n');
  }

  /** Cuerpo de la incidencia en Mantis con los datos del ticket. */
  private descripcionMantis(t: TicketRow): string {
    const cabecera = [
      `Ticket: ${t.number}`,
      `Cliente: ${t.client_name ?? '—'}${t.client_rif ? ` (${t.client_rif})` : ''}`,
      `Solicitante: ${t.requester_name}${t.requester_email ? ` <${t.requester_email}>` : ''}`,
      `Tipo: ${t.type} · Prioridad: ${t.priority} · Canal: ${t.channel}`,
    ];
    if (t.affected_user) cabecera.push(`Usuario afectado: ${t.affected_user}`);
    return [
      ...cabecera,
      '',
      'Descripción:',
      t.description,
      '',
      'Enviado desde SIGESP · Gestión de Soporte.',
    ].join('\n');
  }

  /** URL web de la incidencia en Mantis (si hay MANTIS_BASE_URL configurado). */
  private urlMantis(issueId: number): string | null {
    const base = (env.mantis.baseUrl || '').replace(/\/+$/, '');
    return base ? `${base}/view.php?id=${issueId}` : null;
  }

  async agregarMensaje(id: number, dto: CreateMessageDto, gestor: UsuarioGestor) {
    const ticket = await this.buscarPorId(id);
    const agente = await this.agenteId(gestor);

    if (dto.isInternal && gestor.adminUser !== 1 && ticket.assignee_id !== agente.id) {
      throw new ForbiddenException(
        'Solo el agente asignado o un administrador pueden agregar notas internas',
      );
    }

    return this.dataSource.transaction(async (tx) => {
      const mensajes = await tx.query(
        `INSERT INTO sigespweb.ticket_messages
           (ticket_id, author_id, author_name, body, is_internal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, body, is_internal, created_at`,
        [id, agente.id, agente.username, this.latin9(dto.body.trim()), dto.isInternal ?? false],
      );

      if (!ticket.first_response_at && !dto.isInternal) {
        await tx.query(
          `UPDATE sigespweb.tickets SET
             first_response_at = NOW(),
             sla_response_breached =
               (response_due_at IS NOT NULL AND NOW() > response_due_at),
             state = CASE WHEN state = 'nuevo' AND assignee_id IS NULL
                          THEN 'en_progreso'::sigespweb.ticket_state ELSE state END,
             assignee_id = COALESCE(assignee_id, $2),
             updated_at = NOW()
           WHERE id = $1`,
          [id, agente.id],
        );
      } else {
        await tx.query(`UPDATE sigespweb.tickets SET updated_at = NOW() WHERE id = $1`, [id]);
      }

      return {
        ...mensajes[0],
        author_id: agente.id,
        author_name: agente.username,
        author_rol: agente.rol,
      };
    });
  }

  /**
   * Elimina (baja logica) un comentario del ticket.
   * Cualquier usuario con acceso al modulo puede eliminarlo; queda registrado
   * en el historial para trazabilidad.
   */
  async eliminarMensaje(ticketId: number, mensajeId: number, gestor: UsuarioGestor) {
    const ticket = await this.buscarPorId(ticketId);

    const filas = await this.dataSource.query<{ id: number; body: string }[]>(
      `SELECT id, body FROM sigespweb.ticket_messages
        WHERE id = $1 AND ticket_id = $2 AND deleted_at IS NULL`,
      [mensajeId, ticketId],
    );
    if (!filas.length) {
      throw new NotFoundException('Comentario no encontrado o ya eliminado');
    }

    const agente = await this.agenteId(gestor);
    const extracto = String(filas[0].body ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE sigespweb.ticket_messages
            SET deleted_at = NOW(), deleted_by = $3
          WHERE id = $1 AND ticket_id = $2`,
        [mensajeId, ticketId, agente.id],
      );
      await this.registrarHistorial(
        tx,
        ticketId,
        agente,
        'mensaje_eliminado',
        null,
        `#${mensajeId}${extracto ? `: ${extracto}` : ''}`,
      );
      await tx.query(`UPDATE sigespweb.tickets SET updated_at = NOW() WHERE id = $1`, [ticketId]);
    });

    this.logger.log(`Comentario #${mensajeId} eliminado del ticket ${ticket.number}`);
    return {
      eliminado: true,
      id: mensajeId,
      ticket: this.aRespuesta(await this.buscarPorId(ticketId)),
    };
  }

  /* ==================================================================
   *  Adjuntos
   * ================================================================== */

  /**
   * Raíz donde el portal web (sigespweb) guarda los archivos de tickets.
   * Se COMPARTE con ese sistema, por eso:
   *   1) TICKETS_STORAGE_ROOT (propia de este backend)
   *   2) STORAGE_ROOT (la misma variable que usa sigespweb)
   *   3) ruta por defecto de desarrollo (Windows)
   */
  private get raizTickets(): string {
    const configurada =
      (process.env.TICKETS_STORAGE_ROOT || '').trim() ||
      (process.env.STORAGE_ROOT || '').trim();
    return configurada || 'C:\\mynestapis\\sigespweb\\storage';
  }

  /** MIME permitidos en adjuntos de tickets (mismo set que el portal web) */
  private readonly mimesPermitidos = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/zip', 'application/x-zip-compressed',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  async agregarAdjuntos(
    id: number,
    archivos: Express.Multer.File[],
    gestor: UsuarioGestor,
  ) {
    if (!archivos || !archivos.length) {
      throw new BadRequestException('Sube al menos un archivo');
    }

    const ticket = await this.buscarPorId(id);
    const agente = await this.agenteId(gestor);
    const carpeta = `tickets/${ticket.number}`;
    const dirAbsoluto = path.join(this.raizTickets, carpeta);
    await fs.mkdir(dirAbsoluto, { recursive: true });

    const registrados = [];
    for (const file of archivos) {
      if (!this.mimesPermitidos.has(file.mimetype)) {
        throw new BadRequestException(
          `Tipo no permitido: ${file.filename}. Usa imagen, PDF, ofimática, ZIP o texto`,
        );
      }
      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException(`El archivo ${file.filename} está vacío`);
      }

      const extension = path.extname(file.originalname).toLowerCase().slice(0, 10);
      const nombreFisico = `${Date.now().toString(36)}${randomBytes(6).toString('hex')}${extension || this.extensionPara(file.mimetype)}`;
      const storedName = `${carpeta}/${nombreFisico}`;
      const hash = createHash('sha256').update(file.buffer).digest('hex');

      await fs.writeFile(path.join(dirAbsoluto, nombreFisico), file.buffer);

      const filas = await this.dataSource.query<any[]>(
        `INSERT INTO sigespweb.ticket_attachments
           (ticket_id, filename, stored_name, carpeta, mimetype, size_bytes,
            hash_sha256, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, uuid, filename, mimetype, size_bytes, created_at`,
        [
          id,
          this.latin9(file.originalname.slice(0, 255)),
          storedName,
          carpeta,
          file.mimetype,
          file.buffer.length,
          hash,
          agente.id,
        ],
      );

      registrados.push(filas[0]);
    }

    await this.dataSource.query(
      `UPDATE sigespweb.tickets SET updated_at = NOW() WHERE id = $1`,
      [id],
    );
    this.logger.log(`Adjuntos: ${registrados.length} archivo(s) al ticket ${ticket.number}`);
    return registrados;
  }

  /** Datos para descargar un adjunto (ruta absoluta + nombre original) */
  async rutaAdjunto(ticketId: number, adjuntoId: number) {
    const filas = await this.dataSource.query<{
      filename: string;
      stored_name: string;
      mimetype: string;
    }[]>(
      `SELECT filename, stored_name, mimetype
       FROM sigespweb.ticket_attachments
       WHERE id = $1 AND ticket_id = $2 AND deleted_at IS NULL`,
      [adjuntoId, ticketId],
    );

    if (!filas.length) {
      throw new NotFoundException('Adjunto no encontrado');
    }
    const adjunto = filas[0];
    const ruta = path.join(this.raizTickets, adjunto.stored_name);

    try {
      await fs.access(ruta);
    } catch {
      throw new NotFoundException('El archivo no existe en el servidor');
    }

    return { ruta, nombre: adjunto.filename, mimetype: adjunto.mimetype };
  }

  /** Baja lógica + eliminación física del archivo */
  async eliminarAdjunto(ticketId: number, adjuntoId: number) {
    const filas = await this.dataSource.query<{ id: number; stored_name: string }[]>(
      `SELECT id, stored_name FROM sigespweb.ticket_attachments
       WHERE id = $1 AND ticket_id = $2 AND deleted_at IS NULL`,
      [adjuntoId, ticketId],
    );

    if (!filas.length) {
      throw new NotFoundException('Adjunto no encontrado');
    }

    try {
      await fs.unlink(path.join(this.raizTickets, filas[0].stored_name));
    } catch {
      // El archivo físico pudo no existir: igual se marca como eliminado
    }

    await this.dataSource.query(
      `UPDATE sigespweb.ticket_attachments SET deleted_at = NOW() WHERE id = $1`,
      [filas[0].id],
    );
    return { eliminado: true, id: filas[0].id };
  }

  private extensionPara(mimetype: string): string {
    return (
      {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
        'text/plain': '.txt',
        'application/zip': '.zip',
        'application/x-zip-compressed': '.zip',
        'application/msword': '.doc',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      } as Record<string, string>
    )[mimetype] || '.bin';
  }

  /* ==================================================================
   *  Auxiliares
   * ================================================================== */

  private async buscarPorId(id: number): Promise<TicketRow> {
    return this.cargarConJoins(id, this.dataSource);
  }

  private async cargarConJoins(id: number, run: { query<T = any>(sql: string, params?: any[]): Promise<T> }): Promise<TicketRow> {
    const filas = await run.query<TicketRow[]>(
      `SELECT ${this.camposListado()}
       FROM sigespweb.tickets t
       ${this.joins()}
       WHERE t.id = $1`,
      [id],
    );
    if (!filas.length) {
      throw new NotFoundException(`Ticket ${id} no encontrado`);
    }
    return filas[0];
  }

  private validarEditable(ticket: TicketRow) {
    if (ESTADOS_FINALES.includes(ticket.state as any) && ticket.state === 'cancelado') {
      throw new BadRequestException('Un ticket cancelado no se puede editar');
    }
  }

  private async siguienteNumero(
    tipo: keyof typeof PREFIJO_TIPO,
    run: { query<T = any>(sql: string, params?: any[]): Promise<T> },
  ): Promise<string> {
    const anio = new Date().getFullYear();
    const filas = await run.query<{ ultimo: number }[]>(
      `INSERT INTO sigespweb.ticket_counters (anio, ultimo) VALUES ($1, 1)
       ON CONFLICT (anio) DO UPDATE SET ultimo = sigespweb.ticket_counters.ultimo + 1
       RETURNING ultimo`,
      [anio],
    );
    const secuencia = String(filas[0].ultimo).padStart(6, '0');
    return `${PREFIJO_TIPO[tipo]}-${anio}-${secuencia}`;
  }

  private async politicaSla(
    prioridad: string,
    run?: { query<T = any>(sql: string, params?: any[]): Promise<T> },
  ): Promise<{ id: number; minutos_respuesta: number; minutos_resolucion: number } | null> {
    const sql = `SELECT id, minutos_respuesta, minutos_resolucion
                 FROM sigespweb.ticket_sla_policies
                 WHERE prioridad = $1 AND activo = TRUE
                 LIMIT 1`;
    const filas = run
      ? await run.query<any>(sql, [prioridad])
      : await this.dataSource.query<any>(sql, [prioridad]);
    return filas[0] ?? null;
  }

  /** Recalcula los vencimientos cuando cambia la prioridad */
  private async reajustarSla(id: number, prioridad: string) {
    const sla = await this.politicaSla(prioridad);
    if (!sla) return;
    await this.dataSource.query(
      `UPDATE sigespweb.tickets SET
         sla_policy_id     = $1,
         response_due_at   = created_at + ($2 || ' minutes')::interval,
         resolution_due_at = created_at + ($3 || ' minutes')::interval
       WHERE id = $4`,
      [sla.id, sla.minutos_respuesta, sla.minutos_resolucion, id],
    );
  }

  private async registrarHistorial(
    run: { query<T = any>(sql: string, params?: any[]): Promise<T> },
    ticketId: number,
    agente: AgenteSoporte,
    field: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    await run.query(
      `INSERT INTO sigespweb.ticket_history
         (ticket_id, user_id, user_name, field, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ticketId,
        agente.id,
        agente.username,
        field,
        oldValue === null || oldValue === undefined ? null : this.latin9(oldValue),
        newValue === null || newValue === undefined ? null : this.latin9(newValue),
      ],
    );
  }

  private camposListado(): string {
    return `t.id, t.number, t.type, t.state, t.title, t.description,
            t.category_id, c.nombre AS category_nombre, c.codigo AS category_codigo,
            t.group_id, g.nombre AS group_nombre,
            t.service, t.requester_id, t.requester_name, t.requester_email, t.requester_phone,
            t.id_client, t.client_name, t.client_rif, t.mantis_issue_id,
            (SELECT sc.id_mantis_proyect FROM public.sgh_client sc
              WHERE sc.id_client = t.id_client) AS client_mantis_proyect,
            (SELECT (mi.status_name = 'closed') FROM sigespweb.mantis_issue mi
              WHERE mi.id = t.mantis_issue_id) AS mantis_cerrado,
            t.affected_user, t.assignee_id, u.username AS assignee_nombre,
            t.impact, t.urgency, t.priority, t.priority_overridden, t.channel,
            t.sla_policy_id,
            t.response_due_at, t.resolution_due_at, t.first_response_at,
            t.resolved_at, t.closed_at, t.sla_response_breached, t.sla_resolution_breached,
            t.reopen_count, t.hold_reason, t.resolution_code, t.resolution_notes,
            t.root_cause, t.parent_id,
            t.created_at, t.updated_at`;
  }

  private joins(): string {
    return `LEFT JOIN sigespweb.ticket_categories c ON c.id = t.category_id
            LEFT JOIN sigespweb.ticket_groups g     ON g.id = t.group_id
            LEFT JOIN sigespweb.usuarios u          ON u.id = t.assignee_id`;
  }

  /** Normaliza la fila de BD al contrato de la API */
  private aRespuesta(t: TicketRow) {
    if (!t) return t;

    const abierto = !ESTADOS_FINALES.includes(t.state as any);
    const vencido =
      abierto && t.resolution_due_at ? new Date(t.resolution_due_at) < new Date() : false;
    const porVencer =
      abierto && !vencido && t.resolution_due_at
        ? new Date(t.resolution_due_at).getTime() - Date.now() < 4 * 3600 * 1000
        : false;

    return {
      id: t.id,
      number: t.number,
      type: t.type,
      state: t.state,
      title: t.title,
      description: t.description,
      categoryId: t.category_id,
      categoryNombre: t.category_nombre,
      categoryCodigo: t.category_codigo,
      groupId: t.group_id,
      groupNombre: t.group_nombre,
      service: t.service,
      requesterId: t.requester_id,
      requesterName: t.requester_name,
      requesterEmail: t.requester_email,
      requesterPhone: t.requester_phone,
      idClient: t.id_client,
      clientName: t.client_name,
      clientRif: t.client_rif,
      mantisIssueId: t.mantis_issue_id,
      mantisUrl: t.mantis_issue_id ? this.urlMantis(t.mantis_issue_id) : null,
      clientMantisProyect: t.client_mantis_proyect,
      mantisCerrado: t.mantis_cerrado === true,
      affectedUser: t.affected_user,
      assigneeId: t.assignee_id,
      assigneeNombre: t.assignee_nombre,
      impact: t.impact,
      urgency: t.urgency,
      priority: t.priority,
      priorityOverridden: t.priority_overridden,
      channel: t.channel,
      slaPolicyId: t.sla_policy_id,
      responseDueAt: t.response_due_at,
      resolutionDueAt: t.resolution_due_at,
      firstResponseAt: t.first_response_at,
      resolvedAt: t.resolved_at,
      closedAt: t.closed_at,
      slaResponseBreached: t.sla_response_breached,
      slaResolutionBreached: t.sla_resolution_breached,
      reopenCount: t.reopen_count,
      holdReason: t.hold_reason,
      resolutionCode: t.resolution_code,
      resolutionNotes: t.resolution_notes,
      rootCause: t.root_cause,
      parentId: t.parent_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      slaVencido: vencido,
      slaPorVencer: porVencer,
    };
  }
}