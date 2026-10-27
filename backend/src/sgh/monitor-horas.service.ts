import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { UsuarioSgh } from './entities/usuario-sgh.entity';
import { Proyecto } from './entities/proyecto.entity';
import { Cliente } from './entities/cliente.entity';
import { ScrinActivity } from './entities/scrin-activity.entity';
import { ScrinSummary } from './entities/scrin-summary.entity';
import { ScrinProjectMap } from './entities/scrin-project-map.entity';
import { ScrinClientService } from './scrin-client.service';
import { ActividadesService } from './actividades.service';
import { ScrinConfigDto, VerificarScrinDto } from './dto/monitor-horas.dto';

const SIN_PROYECTO = 'SIN-PROYECTO';

@Injectable()
export class MonitorHorasService {
  constructor(
    @InjectRepository(UsuarioSgh)
    private readonly usuarioRepo: Repository<UsuarioSgh>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepo: Repository<Proyecto>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(ScrinActivity)
    private readonly activityRepo: Repository<ScrinActivity>,
    @InjectRepository(ScrinSummary)
    private readonly summaryRepo: Repository<ScrinSummary>,
    @InjectRepository(ScrinProjectMap)
    private readonly projectMapRepo: Repository<ScrinProjectMap>,
    private readonly scrin: ScrinClientService,
    private readonly actividades: ActividadesService,
  ) {}

  private async getUser(login: string): Promise<UsuarioSgh> {
    if (!login) throw new BadRequestException('No se pudo identificar el usuario');
    const user = await this.usuarioRepo.findOne({ where: { login } });
    if (!user) throw new NotFoundException(`Usuario SGH con login ${login} no encontrado`);
    return user;
  }

  private maskToken(token?: string): string | null {
    if (!token) return null;
    return token.length <= 6 ? '******' : `******${token.slice(-4)}`;
  }

  async getConfig(login: string) {
    const user = await this.getUser(login);
    return {
      idUser: user.idUser,
      login: user.login,
      nameUser: user.nameUser,
      scrinCompanyId: user.scrinCompanyId ?? null,
      scrinEmploymentId: user.scrinEmploymentId ?? null,
      hasToken: !!user.scrinToken,
      tokenPreview: this.maskToken(user.scrinToken),
      configurado: !!user.scrinToken && !!user.scrinEmploymentId,
    };
  }

  async saveConfig(login: string, dto: ScrinConfigDto) {
    const user = await this.getUser(login);
    if (dto.scrinCompanyId !== undefined) user.scrinCompanyId = dto.scrinCompanyId;
    if (dto.scrinEmploymentId !== undefined) user.scrinEmploymentId = dto.scrinEmploymentId;
    if (dto.scrinToken !== undefined && dto.scrinToken !== '') user.scrinToken = dto.scrinToken;
    await this.usuarioRepo.save(user);
    return this.getConfig(login);
  }

  async fetchRange(login: string, from: string, to: string) {
    const user = await this.getUser(login);
    return this.fetchForUser(user, from, to);
  }

  /** Normaliza un nombre para comparar (sin acentos, en minusculas). */
  private normalizarNombre(s: string): string {
    return (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Busca en el catalogo de Scrin el empleado que corresponde al usuario SIGESP. */
  private buscarEmpleadoPorNombre<T extends { id: number; name: string }>(
    nameUser: string,
    empleados: T[],
  ): T | null {
    const palabras = this.normalizarNombre(nameUser)
      .split(' ')
      .filter((w) => w.length > 2);
    if (!palabras.length) return null;
    return (
      empleados.find((e) =>
        palabras.every((w) => this.normalizarNombre(e.name).includes(w)),
      ) ?? null
    );
  }

  /**
   * Verifica EN VIVO contra Scrin que el token funcione y que el ID configurado
   * sea realmente un empleado de esa cuenta (boton "Probar conexion").
   *
   * Es importante porque Scrin responde 200 con lista vacia cuando el
   * employmentId no existe: sin esta validacion, un ID equivocado se ve
   * igual que "no hubo horas".
   */
  async verificarConexion(login: string, dto: VerificarScrinDto) {
    return this.verificarConexionDe(await this.getUser(login), dto);
  }

  /**
   * Verifica la conexion Scrin de OTRO usuario SGH (pantalla Usuarios SGH).
   * Solo administradores SGH (rol 'A' o 'S').
   */
  async verificarConexionDeUsuario(login: string, idUser: number, dto: VerificarScrinDto) {
    const solicitante = await this.getUser(login);
    if (!this.esAdminScrin(solicitante)) {
      throw new ForbiddenException(
        'Solo un administrador SGH (rol A/S) puede verificar la configuración de otros usuarios',
      );
    }
    const objetivo = await this.usuarioRepo.findOne({ where: { idUser } });
    if (!objetivo) throw new NotFoundException(`Usuario SGH ${idUser} no encontrado`);
    return this.verificarConexionDe(objetivo, dto);
  }

  /** Extrae empresas y empleados (IDs) del catalogo que devuelve GetCommonData. */
  private extraerCatalogo(common: any): {
    empresas: Array<{ id: number; name: string }>;
    empleados: Array<{ id: number; name: string; companyId: number; company: string }>;
  } {
    const empresas = (common?.companies ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
    const empleados = (common?.companies ?? []).flatMap((c: any) =>
      (c.employments ?? []).map((e: any) => ({
        id: e.id,
        name: e.name,
        companyId: c.id,
        company: c.name,
      })),
    );
    return { empresas, empleados };
  }

  /**
   * Consulta un token de Scrin y devuelve TODOS los IDs de empleado que expone
   * (para saber que ID corresponde a cada usuario). Solo administradores (rol A/S).
   * No necesita que el token este guardado: sirve para tokens nuevos.
   */
  async explorarToken(login: string, token: string) {
    const solicitante = await this.getUser(login);
    if (!this.esAdminScrin(solicitante)) {
      throw new ForbiddenException(
        'Solo un administrador SGH (rol A/S) puede consultar tokens de Scrin',
      );
    }
    const t = (token ?? '').trim();
    if (!t) throw new BadRequestException('Indique el token de Scrin a consultar');

    let common: any;
    try {
      common = await this.scrin.getCommonData(t);
    } catch (e: any) {
      throw new BadRequestException(
        `El token no es valido o expiro (${e?.message ?? 'error'})`,
      );
    }

    const { empresas, empleados } = this.extraerCatalogo(common);
    const dueno = empleados.find((e) => e.id === common?.employmentId) ?? null;

    return {
      tokenOk: true,
      duenoToken: dueno ? { id: dueno.id, name: dueno.name } : null,
      empresas,
      empleados,
      total: empleados.length,
    };
  }

  /** Cuántas palabras (de mas de 2 letras) comparten los dos nombres. */
  private puntajeNombre(nameUser: string, nombreEmpleado: string): number {
    const palabras = this.normalizarNombre(nameUser)
      .split(' ')
      .filter((w) => w.length > 2);
    if (!palabras.length) return 0;
    const objetivo = this.normalizarNombre(nombreEmpleado);
    return palabras.filter((w) => objetivo.includes(w)).length;
  }

  /** ¿El nombre del empleado comparte alguna palabra con el usuario SIGESP? */
  private comparteNombre(nameUser: string, nombreEmpleado: string): boolean {
    return this.puntajeNombre(nameUser, nombreEmpleado) > 0;
  }

  /**
   * Detecta si OTRO usuario SGH encaja mejor con ese empleado de Scrin.
   * Evita el falso positivo de nombres iguales (p. ej. "IVAN LLANOS" vs
   * "IVAN VALECILLOS": comparten "IVAN", pero el empleado es del segundo).
   */
  private otroUsuarioMejor(
    user: UsuarioSgh,
    nombreEmpleado: string,
    otros: UsuarioSgh[],
  ): UsuarioSgh | null {
    const mio = this.puntajeNombre(user.nameUser, nombreEmpleado);
    let mejor: UsuarioSgh | null = null;
    for (const u of otros) {
      if (u.idUser === user.idUser) continue;
      const s = this.puntajeNombre(u.nameUser, nombreEmpleado);
      if (s >= 2 && s > mio) mejor = u;
    }
    return mejor;
  }

  private async verificarConexionDe(user: UsuarioSgh, dto: VerificarScrinDto) {
    const token = dto.scrinToken?.trim() || user.scrinToken;
    const idConfigurado = dto.scrinEmploymentId ?? user.scrinEmploymentId ?? null;

    if (!token) {
      return {
        veredicto: 'SIN_TOKEN',
        mensaje: 'No hay token de Scrin configurado.',
        tokenOk: false,
        empleados: [],
      };
    }

    let common: any;
    try {
      common = await this.scrin.getCommonData(token);
    } catch (e: any) {
      return {
        veredicto: 'TOKEN_INVALIDO',
        mensaje: `El token no es valido o expiro (${e?.message ?? 'error'}).`,
        tokenOk: false,
        empleados: [],
      };
    }

    const { empleados } = this.extraerCatalogo(common);
    const dueno = empleados.find((e) => e.id === common?.employmentId) ?? null;
    const configurado = idConfigurado
      ? (empleados.find((e) => e.id === idConfigurado) ?? null)
      : null;
    // No basta con que el ID exista: tiene que ser ESA persona. Se compara el
    // nombre y, si OTRO usuario SGH encaja mejor con ese empleado, se avisa:
    // asi no se cargan las horas de una persona en la cuenta de otra.
    let nombreCoincide = false;
    let mejorCandidato: UsuarioSgh | null = null;
    if (configurado) {
      const otros = await this.usuarioRepo.find();
      mejorCandidato = this.otroUsuarioMejor(user, configurado.name, otros);
      nombreCoincide = this.comparteNombre(user.nameUser, configurado.name) && !mejorCandidato;
    }
    const sugerido =
      configurado && nombreCoincide
        ? null
        : this.buscarEmpleadoPorNombre(user.nameUser, empleados);

    let veredicto: string;
    let mensaje: string;
    if (!idConfigurado) {
      veredicto = 'SIN_ID';
      mensaje = 'El token funciona, pero no hay un ID de ScreenMonitor configurado.';
    } else if (configurado && nombreCoincide) {
      veredicto = 'OK';
      mensaje = `Correcto: el ID ${configurado.id} corresponde a ${configurado.name}.`;
    } else if (configurado) {
      const deQuien =
        mejorCandidato &&
        mejorCandidato.nameUser.trim().toLowerCase() !== configurado.name.trim().toLowerCase()
          ? `${configurado.name} (usuario ${mejorCandidato.nameUser})`
          : configurado.name;
      veredicto = 'NOMBRE_NO_COINCIDE';
      mensaje = `Cuidado: el ID ${configurado.id} es de ${deQuien}, no de ${user.nameUser}. Se cargarian horas de otra persona.`;
    } else {
      veredicto = 'ID_NO_EXISTE';
      mensaje = `El ID ${idConfigurado} no existe en ScreenMonitor para este token: Scrin devolvera 0 horas.`;
    }

    return {
      veredicto,
      mensaje,
      tokenOk: true,
      duenoToken: dueno ? { id: dueno.id, name: dueno.name } : null,
      empresaToken:
        (common?.companies ?? []).find((c: any) => c.id === common?.currentCompanyId)?.name ??
        null,
      idConfigurado,
      empleadoConfigurado: configurado
        ? { id: configurado.id, name: configurado.name }
        : null,
      sugerido: sugerido ? { id: sugerido.id, name: sugerido.name } : null,
      empleados,
    };
  }

  /** Consulta Scrin para un usuario objetivo y guarda el resultado en staging. */
  private async fetchForUser(user: UsuarioSgh, from: string, to: string) {
    if (!user.scrinToken) throw new BadRequestException('No tiene token Scrin configurado');
    if (!user.scrinEmploymentId) throw new BadRequestException('No tiene ID de Scrin configurado');
    if (!from || !to) throw new BadRequestException('Debe indicar el rango de fechas');
    if (from > to) throw new BadRequestException('La fecha "desde" no puede ser mayor que "hasta"');

    const common = await this.scrin.getCommonData(user.scrinToken);
    const catalog = this.scrin.buildProjectCatalog(common);
    const offset = this.scrin.getUtcOffset(common);

    const fromSec = this.scrin.startOfDay(from, offset);
    const toSec = this.scrin.endOfDay(to, offset);
    const actividades = await this.scrin.getActivities(
      user.scrinToken,
      user.scrinEmploymentId,
      fromSec,
      toSec,
    );

    const rows = (actividades ?? []).map((a) => {
      const ini = this.scrin.toLocal(a.from, offset);
      const fin = this.scrin.toLocal(a.to, offset);
      const pid = a.projectId ?? undefined;
      return this.activityRepo.create({
        idUser: user.idUser,
        activityId: a.activityId ?? a.id,
        employeeId: a.employmentId,
        employeeName: user.nameUser,
        scrinProjectId: pid ?? SIN_PROYECTO,
        scrinProjectName: pid ? catalog.get(pid) ?? 'Proyecto Scrin' : 'Sin proyecto',
        fromTs: a.from,
        toTs: a.to,
        dateActivity: ini.date,
        hourIni: ini.time,
        hourFin: fin.time,
        durationMinutes: Math.max(0, Math.round((a.to - a.from) / 60)),
        offline: a.offline ? 1 : 0,
        note: a.note,
        selected: 0,
        syncStatus: 0,
        dateSync: new Date(),
      });
    });

    let inserted = 0;
    if (rows.length > 0) {
      const before = await this.activityRepo.count({ where: { idUser: user.idUser } });
      await this.activityRepo
        .createQueryBuilder()
        .insert()
        .into(ScrinActivity)
        .values(rows)
        .orIgnore()
        .execute();
      const after = await this.activityRepo.count({ where: { idUser: user.idUser } });
      inserted = Math.max(0, after - before);
    }

    return {
      from,
      to,
      fetched: rows.length,
      inserted,
      duplicates: rows.length - inserted,
    };
  }

  async listActivities(
    login: string,
    opts: { from?: string; to?: string; onlySelected?: boolean; status?: number } = {},
  ) {
    const user = await this.getUser(login);
    const where: Record<string, unknown> = { idUser: user.idUser };
    if (opts.from && opts.to) where.dateActivity = Between(opts.from, opts.to);
    if (opts.onlySelected) where.selected = 1;
    if (opts.status !== undefined) where.syncStatus = opts.status;
    return this.activityRepo.find({
      where,
      order: { dateActivity: 'DESC', hourIni: 'ASC' },
    });
  }

  /* ==================== CONSULTA MULTIUSUARIO (SOLO LECTURA) ==================== */

  /** Usuario de la sesion o null (sin lanzar error si no tiene perfil SGH). */
  private async usuarioActual(login: string): Promise<UsuarioSgh | null> {
    return this.getUser(login).catch(() => null);
  }

  /** Administrador SGH = rol 'A' o 'S'. */
  private esAdminScrin(user: UsuarioSgh | null): boolean {
    return user?.rol === 'A' || user?.rol === 'S';
  }

  /**
   * Usuarios SGH disponibles para agregar a la consulta. Valida la existencia en
   * la base de datos (solo usuarios activos). Un usuario no administrador solo
   * ve su propio registro. Incluye la bandera scrinConfigurado para advertir si
   * la consulta a Scrin podra traer datos para ese usuario.
   */
  async usuariosParaConsulta(login: string, term?: string) {
    const actual = await this.usuarioActual(login);
    const qb = this.usuarioRepo.createQueryBuilder('u').where('u.active = :a', { a: 1 });
    const t = (term || '').trim();
    if (t) {
      qb.andWhere('(LOWER(u.nameUser) LIKE :t OR LOWER(u.login) LIKE :t)', {
        t: `%${t.toLowerCase()}%`,
      });
    }
    if (!this.esAdminScrin(actual)) {
      if (!actual) return [];
      qb.andWhere('u.idUser = :id', { id: actual.idUser });
    }
    const rows = await qb.orderBy('u.nameUser', 'ASC').getMany();
    return rows.map((u) => ({
      idUser: u.idUser,
      login: u.login,
      nameUser: u.nameUser,
      scrinConfigurado: !!(
        u.scrinToken &&
        u.scrinToken !== '' &&
        u.scrinEmploymentId != null
      ),
      scrinCompanyId: u.scrinCompanyId ?? null,
      scrinEmploymentId: u.scrinEmploymentId ?? null,
      tokenPreview: this.maskToken(u.scrinToken),
    }));
  }

  /** Ids efectivamente consultables segun el rol del solicitante. */
  private async idsConsultables(login: string, idUsers: number[]): Promise<number[]> {
    const actual = await this.usuarioActual(login);
    if (!this.esAdminScrin(actual)) {
      return actual ? [actual.idUser] : [];
    }
    const ids = (idUsers ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return [];
    // Valida que los ids existan en la base de datos; no exige Scrin aqui para
    // que consultaFetch reporte por usuario cuando falte la configuracion.
    const rows = await this.usuarioRepo
      .createQueryBuilder('u')
      .select('u.idUser', 'idUser')
      .where('u.idUser IN (:...ids)', { ids })
      .getRawMany();
    return rows.map((r) => Number(r.idUser));
  }

  /**
   * Consulta Scrin (en vivo) para varios usuarios. Aisla el error de cada uno:
   * un token invalido no rompe el resto.
   */
  async consultaFetch(login: string, idUsers: number[], from: string, to: string) {
    const ids = await this.idsConsultables(login, idUsers);
    if (!ids.length) {
      throw new BadRequestException('No hay usuarios consultables con los criterios indicados');
    }
    const resultados: Array<Record<string, unknown>> = [];
    for (const id of ids) {
      const user = await this.usuarioRepo.findOne({ where: { idUser: id } });
      if (!user) {
        resultados.push({ idUser: id, nameUser: null, ok: false, error: 'Usuario no encontrado' });
        continue;
      }
      try {
        const r = await this.fetchForUser(user, from, to);
        resultados.push({ idUser: id, nameUser: user.nameUser, ok: true, ...r });
      } catch (e: any) {
        resultados.push({
          idUser: id,
          nameUser: user.nameUser,
          ok: false,
          error: e?.message || 'Error al consultar Scrin',
        });
      }
    }
    return { resultados };
  }

  /**
   * Registros de sgh_scrin_activity de varios usuarios en un rango.
   * syncStatus: 0 = pendientes/actuales (traidas en vivo), 1 = ya procesadas.
   * Enriquece con nombre de usuario, proyecto SGH y cliente SGH.
   */
  async consultaActividades(
    login: string,
    idUsers: number[],
    from?: string,
    to?: string,
    syncStatus?: number,
  ) {
    const ids = await this.idsConsultables(login, idUsers);
    if (!ids.length) return [];
    const where: Record<string, unknown> = { idUser: In(ids) };
    if (from && to) where.dateActivity = Between(from, to);
    if (syncStatus !== undefined) where.syncStatus = syncStatus;
    const rows = await this.activityRepo.find({
      where,
      order: { idUser: 'ASC', dateActivity: 'DESC', hourIni: 'ASC' },
    });
    const usuarios = await this.usuarioRepo.find({ where: { idUser: In(ids) } });
    const nombres = new Map(usuarios.map((u) => [u.idUser, u.nameUser]));
    const proyectos = await this.proyectoRepo.find();
    const proyectoLabel = new Map(
      proyectos.map((p) => [p.idProyect, `#${p.numdoc ?? p.idProyect} — ${p.responsable ?? ''}`]),
    );
    const clientes = await this.clienteRepo.find();
    const clienteLabel = new Map(clientes.map((c) => [c.idClient, c.name]));
    return rows.map((r) => ({
      ...r,
      userName: nombres.get(r.idUser ?? -1) ?? r.employeeName ?? null,
      proyectoLabel: r.idProyect ? proyectoLabel.get(r.idProyect) ?? null : null,
      clienteLabel: r.idClient ? clienteLabel.get(r.idClient) ?? null : null,
    }));
  }

  async setSelected(login: string, id: number, selected: number) {
    const user = await this.getUser(login);
    const row = await this.activityRepo.findOne({
      where: { idScrinActivity: id, idUser: user.idUser },
    });
    if (!row) throw new NotFoundException(`Registro ${id} no encontrado`);
    if (row.syncStatus === 1) throw new ConflictException('El registro ya fue procesado');
    row.selected = selected ? 1 : 0;
    return this.activityRepo.save(row);
  }

  /**
   * Marca/desmarca de una sola vez TODOS los registros pendientes del usuario
   * (opcionalmente dentro de un rango de fechas). Se hace en una sola sentencia
   * para no disparar el limite de peticiones del servidor.
   */
  async setSelectedAll(login: string, selected: number, from?: string, to?: string) {
    const user = await this.getUser(login);
    const qb = this.activityRepo
      .createQueryBuilder()
      .update(ScrinActivity)
      .set({ selected: selected ? 1 : 0 })
      .where('id_user = :idUser', { idUser: user.idUser })
      .andWhere('sync_status = 0');
    if (from && to) {
      qb.andWhere('date_activity BETWEEN :from AND :to', { from, to });
    }
    const res = await qb.execute();
    return { updated: res.affected ?? 0, selected: selected ? 1 : 0 };
  }

  /** Normaliza la nota usada como clave de agrupacion (texto vacio -> null). */
  private normalizarNota(note?: string | null): string | null {
    const t = (note ?? '').trim();
    return t === '' ? null : t;
  }

  async buildSummary(login: string, from: string, to: string) {
    const user = await this.getUser(login);
    if (!from || !to) throw new BadRequestException('Debe indicar el rango de fechas');

    const seleccionadas = await this.activityRepo.find({
      where: { idUser: user.idUser, selected: 1, syncStatus: 0 },
    });
    const enRango = seleccionadas.filter(
      (a) => a.dateActivity && a.dateActivity >= from && a.dateActivity <= to,
    );
    if (enRango.length === 0) {
      throw new BadRequestException('No hay registros marcados como validos en el rango indicado');
    }

    // Agrupacion por PROYECTO + NOTA: cada nota distinta de un mismo proyecto
    // genera su propio resumen (y su propia actividad al procesar).
    const grupos = new Map<string, { projectId: string; note: string | null; items: ScrinActivity[] }>();
    for (const a of enRango) {
      const projectId = a.scrinProjectId || SIN_PROYECTO;
      const note = this.normalizarNota(a.note);
      const key = `${projectId}||${note ?? ''}`;
      const grupo = grupos.get(key) ?? { projectId, note, items: [] };
      grupo.items.push(a);
      grupos.set(key, grupo);
    }

    const resultado: ScrinSummary[] = [];
    for (const { projectId, note, items } of grupos.values()) {
      const totalMinutes = items.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);

      // UPSERT idempotente sobre la clave (usuario + proyecto + rango + nota):
      // si el grupo ya existe se actualiza, si no se inserta. Asi el proceso es
      // repetible y no falla aunque se ejecute dos veces o de forma simultanea.
      const insertadas: Array<{ id_scrin_summary: number }> = await this.summaryRepo.query(
        `INSERT INTO sgh_scrin_summary
           (id_user, scrin_project_id, scrin_project_name, date_from, date_to, note,
            activities_count, total_minutes, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, 0, now(), now())
         ON CONFLICT (id_user, scrin_project_id, date_from, date_to, md5(btrim(coalesce(note, ''))))
         DO UPDATE SET
           scrin_project_name = EXCLUDED.scrin_project_name,
           activities_count   = EXCLUDED.activities_count,
           total_minutes      = EXCLUDED.total_minutes,
           updated_at         = now()
         RETURNING id_scrin_summary`,
        [
          user.idUser,
          projectId,
          items[0].scrinProjectName ?? null,
          from,
          to,
          note,
          items.length,
          totalMinutes,
        ],
      );
      const idSummary = Number(insertadas[0].id_scrin_summary);
      const summary = await this.summaryRepo.findOneOrFail({
        where: { idScrinSummary: idSummary },
      });

      const ids = items.map((i) => i.idScrinActivity);
      if (ids.length > 0) {
        await this.activityRepo
          .createQueryBuilder()
          .update(ScrinActivity)
          .set({ idScrinSummary: summary.idScrinSummary })
          .whereInIds(ids)
          .execute();
      }
      resultado.push(summary);
    }
    return resultado;
  }

  async listSummary(login: string, from?: string, to?: string) {
    const user = await this.getUser(login);
    const where: Record<string, unknown> = { idUser: user.idUser };
    if (from && to) {
      where.dateFrom = from;
      where.dateTo = to;
    }
    const rows = await this.summaryRepo.find({
      where,
      order: { status: 'ASC', scrinProjectName: 'ASC', note: 'ASC' },
    });
    const proyectos = await this.proyectoRepo.find();
    const nombreProyecto = new Map(
      proyectos.map((p) => [p.idProyect, `#${p.numdoc ?? p.idProyect} — ${p.responsable ?? ''}`]),
    );
    return rows.map((r) => ({
      ...r,
      proyectoLabel: r.idProyect ? nombreProyecto.get(r.idProyect) ?? null : null,
    }));
  }

  async assignSummary(
    login: string,
    id: number,
    dto: { idProyect: number; idType?: number; idProcess?: number; idItemActivity?: number; note?: string },
  ) {
    const user = await this.getUser(login);
    const summary = await this.summaryRepo.findOne({
      where: { idScrinSummary: id, idUser: user.idUser },
    });
    if (!summary) throw new NotFoundException(`Resumen ${id} no encontrado`);
    if (summary.status === 1) throw new ConflictException('El resumen ya fue procesado');

    const proyecto = await this.proyectoRepo.findOne({ where: { idProyect: dto.idProyect } });
    if (!proyecto) throw new BadRequestException(`Proyecto SGH ${dto.idProyect} no encontrado`);

    summary.idProyect = dto.idProyect;
    summary.idClient = proyecto.idClient;
    if (dto.idType !== undefined) summary.idType = dto.idType;
    if (dto.idProcess !== undefined) summary.idProcess = dto.idProcess;
    if (dto.idItemActivity !== undefined) summary.idItemActivity = dto.idItemActivity;
    if (dto.note !== undefined) summary.note = dto.note;
    summary.updatedAt = new Date();
    const saved = await this.summaryRepo.save(summary);

    await this.upsertProjectMap(
      user.idUser,
      summary.scrinProjectId || SIN_PROYECTO,
      summary.scrinProjectName,
      proyecto.idProyect,
      proyecto.idClient,
    );
    return saved;
  }

  private async upsertProjectMap(
    idUser: number,
    scrinProjectId: string,
    scrinProjectName?: string,
    idProyect?: number,
    idClient?: number,
  ) {
    let map = await this.projectMapRepo.findOne({
      where: { idUser, scrinProjectId },
    });
    if (map) {
      map.scrinProjectName = scrinProjectName;
      map.idProyect = idProyect;
      map.idClient = idClient;
      map.active = 1;
      map.updatedAt = new Date();
    } else {
      map = this.projectMapRepo.create({
        idUser,
        scrinProjectId,
        scrinProjectName,
        idProyect,
        idClient,
        active: 1,
        createdAt: new Date(),
      });
    }
    return this.projectMapRepo.save(map);
  }

  async processSummary(login: string, id: number) {
    const user = await this.getUser(login);
    const summary = await this.summaryRepo.findOne({
      where: { idScrinSummary: id, idUser: user.idUser },
    });
    if (!summary) throw new NotFoundException(`Resumen ${id} no encontrado`);
    if (summary.status === 1) throw new ConflictException('El resumen ya fue procesado');
    if (!summary.idProyect) {
      throw new BadRequestException('Debe asignar un proyecto SGH antes de procesar');
    }

    // Salvaguarda: no procesar si ya no quedan registros pendientes de este
    // proyecto + nota + rango (p. ej. reagrupados o ya procesados en otro resumen).
    const proyectoKey = summary.scrinProjectId || SIN_PROYECTO;
    const notaKey = (summary.note ?? '').trim();
    const desdeRango = summary.dateFrom ?? '1900-01-01';
    const hastaRango = summary.dateTo ?? '2999-12-31';
    const pendientes = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.id_user = :idUser', { idUser: user.idUser })
      .andWhere('a.selected = 1')
      .andWhere('a.sync_status = 0')
      .andWhere('a.scrin_project_id = :pid', { pid: proyectoKey })
      .andWhere("btrim(coalesce(a.note, '')) = :nota", { nota: notaKey })
      .andWhere('a.date_activity BETWEEN :from AND :to', { from: desdeRango, to: hastaRango })
      .getCount();
    if (pendientes === 0) {
      throw new ConflictException(
        'Este resumen no tiene registros pendientes (ya fueron procesados o reagrupados en otro resumen).',
      );
    }

    const horas = Math.round((summary.totalMinutes / 60) * 100) / 100;
    const fecha =
      summary.dateTo ?? new Date().toISOString().slice(0, 10);
    const nota =
      summary.note ||
      `Scrin: ${summary.scrinProjectName} (${summary.dateFrom} a ${summary.dateTo})`;

    const actividad = await this.actividades.create({
      idType: summary.idType,
      idClient: summary.idClient,
      idUser: user.idUser,
      responsible: user.nameUser,
      dateDocument: fecha,
      note: nota,
      visit: 0,
      idProyect: summary.idProyect,
      detalles:
        horas > 0
          ? [
              {
                idItemActivity: summary.idItemActivity,
                idProcess: summary.idProcess,
                hours: horas,
                note: nota,
              },
            ]
          : [],
    });

    summary.status = 1;
    summary.idActivity = actividad.idActivity;
    summary.processedAt = new Date();
    summary.updatedAt = new Date();
    await this.summaryRepo.save(summary);

    // Marcar por proyecto + nota + rango (no por el vinculo id_scrin_summary)
    // para que el reagrupamiento posterior no deje filas sin marcar ni arrastre
    // registros de otras notas del mismo proyecto.
    await this.activityRepo
      .createQueryBuilder()
      .update(ScrinActivity)
      .set({ syncStatus: 1, processedAt: new Date() })
      .where('id_user = :idUser', { idUser: user.idUser })
      .andWhere('sync_status = 0')
      .andWhere('selected = 1')
      .andWhere('scrin_project_id = :pid', { pid: proyectoKey })
      .andWhere("btrim(coalesce(note, '')) = :nota", { nota: notaKey })
      .andWhere('date_activity BETWEEN :from AND :to', {
        from: desdeRango,
        to: hastaRango,
      })
      .execute();

    return { summary, actividad };
  }
}
