import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actividad } from './entities/actividad.entity';
import { DetalleActividad } from './entities/detalle-actividad.entity';
import { MetadataActividad } from './entities/metadata-actividad.entity';
import { SghId } from './entities/sgh-id.entity';
import { UsuarioSgh } from './entities/usuario-sgh.entity';
import {
  CreateActividadDto,
  UpdateActividadDto,
  AnularActividadDto,
} from './dto/actividad.dto';

@Injectable()
export class ActividadesService {
  constructor(
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(DetalleActividad)
    private readonly detalleRepo: Repository<DetalleActividad>,
    @InjectRepository(MetadataActividad)
    private readonly metadataRepo: Repository<MetadataActividad>,
    @InjectRepository(SghId)
    private readonly sghIdRepo: Repository<SghId>,
    @InjectRepository(UsuarioSgh)
    private readonly usuarioSghRepo: Repository<UsuarioSgh>,
  ) {}

  async getCatalogo(
    numdoc?: string,
    fecini?: string,
    fecfin?: string,
    login?: string,
    page = 1,
    pageSize = 50,
  ) {
    let idUser: number | undefined;
    let esAdmin = true;
    if (login) {
      const usuario = await this.usuarioSghRepo.findOne({ where: { login } });
      if (!usuario) esAdmin = false;
      else {
        esAdmin = usuario.rol === 'A' || usuario.rol === 'S';
        idUser = usuario.idUser;
      }
    }

    const params: unknown[] = [numdoc || '', fecini || '1900-01-01', fecfin || '2999-12-31'];
    let whereUser = '';
    if (!esAdmin && idUser !== undefined) {
      whereUser = 'AND doc.id_user = $4';
      params.push(idUser);
    }

    // LEFT JOIN a sgh_users para que actividades sin id_user asignado (o cuyo
    // usuario no exista aún en sgh_users) sigan siendo visibles en el listado.
    const joins = `
        FROM sgh_activity doc
        INNER JOIN sgh_dt_activity dt ON dt.id_activity = doc.id_activity
        INNER JOIN sgh_process p ON p.id_process = dt.id_process
        INNER JOIN sgh_type typ ON typ.id_type = doc.id_type
        INNER JOIN sgh_client client ON client.id_client = doc.id_client
        LEFT JOIN sgh_users users ON users.id_user = doc.id_user`;
    const where = `
        WHERE doc.numdoc ILIKE '%' || $1 || '%'
          AND doc.date_document BETWEEN $2::date AND $3::date
          ${whereUser}`;

    const filaTotal = await this.actividadRepo.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT DISTINCT doc.id_activity
         ${joins}
         ${where}
       ) sub`,
      params,
    );
    const total = Number(filaTotal[0]?.total ?? 0);

    const limit = Math.max(1, Number(pageSize) || 50);
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

    const data = await this.actividadRepo.query(
      `
      SELECT DISTINCT TMP.*, COALESCE(mt.file, '') AS file
      FROM (
        SELECT DISTINCT client.rif, client.name, doc.id_proyect AS "idProyect", doc.id_type AS "idType",
               doc.id_activity AS "idActivity", doc.id_client AS "idClient", doc.numdoc,
               doc.date_document AS "dateDocument", doc.hour_document AS "hourDocument",
               doc.note, doc.responsible, doc.visit, doc.status, users.name_user AS "nameUser"
        ${joins}
        ${where}
      ) TMP
      LEFT OUTER JOIN sgh_metadata mt ON mt.id_activity = TMP."idActivity"
      ORDER BY TMP."dateDocument" DESC, TMP."numdoc" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDetailActivity(idActivity: number) {
    const actividad = await this.actividadRepo.findOne({
      where: { idActivity },
      relations: ['cliente', 'tipo', 'usuario'],
    });
    if (!actividad) throw new NotFoundException(`Actividad ${idActivity} no encontrada`);

    const detalles = await this.detalleRepo
      .createQueryBuilder('dt')
      .innerJoinAndSelect('dt.proceso', 'p')
      .innerJoinAndSelect('dt.itemActividad', 'ia')
      .where('dt.idActivity = :id', { id: idActivity })
      .orderBy('dt.idDetail', 'ASC')
      .getMany();

    const metadata = await this.metadataRepo.find({ where: { idActivity } });

    return { ...actividad, detalles, metadata };
  }

  private async getNumeroID(): Promise<string> {
    const anio = new Date().getFullYear().toString();
    const fila = await this.sghIdRepo.query(
      'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM sgh_id WHERE prefijo = $1',
      [anio],
    );
    const next = Number(fila[0]?.id ?? 1);
    await this.sghIdRepo.save(this.sghIdRepo.create({ prefijo: anio, id: next }));
    const numero = String(next).padStart(8, '0');
    return `${anio}-${numero}`;
  }

  /**
   * Verifica que el usuario autenticado pueda modificar/anular/eliminar la
   * actividad:
   *  - Administrador del sistema (sec_user.adminUser=1) o rol 'A'/'S' en
   *    sgh_users: puede sobre cualquier registro.
   *  - Cualquier otro perfil: SOLO sobre sus propias actividades (propietario)
   *    y SOLO dentro de los primeros 30 dias de la fecha del documento.
   * No requiere cambios de esquema (usa sgh_activity.id_user y date_document).
   */
  private async verificarPuedeModificar(
    actividad: Actividad,
    login?: string,
    isSystemAdmin = false,
  ): Promise<void> {
    const usuario = await this.usuarioSghRepo.findOne({ where: { login } });
    const esAdmin = isSystemAdmin || usuario?.rol === 'A' || usuario?.rol === 'S';
    if (esAdmin) return;

    if (!usuario || actividad.idUser !== usuario.idUser) {
      throw new ForbiddenException('No tiene permisos para modificar esta actividad');
    }

    const fechaDoc = this.fechaLocalMs(actividad.dateDocument);
    const dias = (Date.now() - fechaDoc) / 86400000;
    if (dias > 30) {
      throw new ForbiddenException('Solo puede modificar dentro de los primeros 30 días de la actividad');
    }
  }

  /**
   * Interpreta una fecha de calendario (columna `date`, "YYYY-MM-DD") como
   * medianoche LOCAL y devuelve los milisegundos. Evita el desfase de 1 día
   * que produce `new Date("YYYY-MM-DD")` al parsear como UTC. Tambien acepta
   * objetos Date (datos legacy) usando sus componentes locales.
   */
  private fechaLocalMs(fecha: Date | string): number {
    if (fecha instanceof Date) {
      return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
    }
    const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
  }

  async create(dto: CreateActividadDto) {
    const numdoc = dto.numdoc || (await this.getNumeroID());
    const ahora = new Date();

    const actividad = this.actividadRepo.create({
      numdoc,
      idType: dto.idType,
      idClient: dto.idClient,
      idUser: dto.idUser,
      responsible: dto.responsible.toUpperCase(),
      dateDocument: String(dto.dateDocument).slice(0, 10),
      hourDocument: `${ahora.getHours().toString().padStart(2, '0')}:${ahora
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${ahora.getSeconds().toString().padStart(2, '0')}`,
      note: dto.note,
      status: 0,
      visit: dto.visit ?? 0,
      idProyect: dto.idProyect ?? 0,
    });
    const saved = await this.actividadRepo.save(actividad);

    if (dto.detalles && dto.detalles.length > 0) {
      const filas = dto.detalles
        .filter((d) => d.hours !== undefined)
        .map((d) =>
          this.detalleRepo.create({
            idActivity: saved.idActivity,
            idItemActivity: d.idItemActivity ?? 1,
            idProcess: d.idProcess ?? 0,
            situation: d.situation,
            hours: d.hours ?? 0,
            note: d.note,
            mantis: d.mantis,
          }),
        );
      if (filas.length > 0) await this.detalleRepo.save(filas);
    }

    if (dto.file) {
      await this.setFileInDatabase(saved.idActivity, dto.file);
    }

    if (saved.idProyect && saved.idProyect !== 0) {
      await this.recalcularProyecto(saved.idProyect);
    }

    return this.getDetailActivity(saved.idActivity);
  }

  async update(id: number, dto: UpdateActividadDto, login?: string, isSystemAdmin = false) {
    const actividad = await this.actividadRepo.findOne({ where: { idActivity: id } });
    if (!actividad) throw new NotFoundException(`Actividad ${id} no encontrada`);

    await this.verificarPuedeModificar(actividad, login, isSystemAdmin);

    if (dto.idProyect !== undefined) actividad.idProyect = dto.idProyect;
    if (dto.idType !== undefined) actividad.idType = dto.idType;
    if (dto.idClient !== undefined) actividad.idClient = dto.idClient;
    if (dto.responsible !== undefined) actividad.responsible = dto.responsible.toUpperCase();
    if (dto.dateDocument !== undefined) actividad.dateDocument = String(dto.dateDocument).slice(0, 10);
    if (dto.note !== undefined) actividad.note = dto.note;
    if (dto.visit !== undefined) actividad.visit = dto.visit;
    actividad.alterDate = new Date();
    await this.actividadRepo.save(actividad);

    if (dto.detalles && dto.detalles.length > 0) {
      for (const det of dto.detalles) {
        if (det.idDetail) {
          await this.detalleRepo.update(det.idDetail, {
            idItemActivity: det.idItemActivity,
            idProcess: det.idProcess,
            situation: det.situation,
            hours: det.hours ?? 0,
            note: det.note,
            mantis: det.mantis,
          });
        } else if (det.hours !== undefined) {
          await this.detalleRepo.save(
            this.detalleRepo.create({
              idActivity: id,
              idItemActivity: det.idItemActivity ?? 1,
              idProcess: det.idProcess ?? 0,
              situation: det.situation,
              hours: det.hours,
              note: det.note,
              mantis: det.mantis,
            }),
          );
        }
      }
    }

    if (dto.file) {
      await this.setFileInDatabase(id, dto.file);
    }

    if (dto.idProyect && dto.idProyect !== 0) {
      await this.recalcularProyecto(dto.idProyect);
    } else if (actividad.idProyect && actividad.idProyect !== 0) {
      await this.recalcularProyecto(actividad.idProyect);
    }

    return this.getDetailActivity(id);
  }

  async remove(id: number, login?: string, isSystemAdmin = false) {
    const actividad = await this.actividadRepo.findOne({ where: { idActivity: id } });
    if (!actividad) throw new NotFoundException(`Actividad ${id} no encontrada`);
    await this.verificarPuedeModificar(actividad, login, isSystemAdmin);
    await this.detalleRepo.delete({ idActivity: id });
    await this.metadataRepo.delete({ idActivity: id });
    await this.actividadRepo.remove(actividad);
    if (actividad.idProyect && actividad.idProyect !== 0) {
      await this.recalcularProyecto(actividad.idProyect);
    }
    return { message: 'Actividad eliminada' };
  }

  async anular(id: number, dto: AnularActividadDto, login?: string, isSystemAdmin = false) {
    const actividad = await this.actividadRepo.findOne({ where: { idActivity: id } });
    if (!actividad) throw new NotFoundException(`Actividad ${id} no encontrada`);
    await this.verificarPuedeModificar(actividad, login, isSystemAdmin);
    const ahora = new Date();
    actividad.status = 2;
    actividad.mAnulado = dto.motivo;
    actividad.fAnulado = ahora;
    actividad.tAnulado = `${ahora.getHours().toString().padStart(2, '0')}:${ahora
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${ahora.getSeconds().toString().padStart(2, '0')}`;
    await this.actividadRepo.save(actividad);
    return { message: 'Actividad anulada' };
  }

  async setFileInDatabase(idActivity: number, file: string) {
    const existente = await this.metadataRepo.findOne({
      where: { idActivity },
      order: { id: 'DESC' },
    });
    if (existente) {
      existente.file = file;
      return this.metadataRepo.save(existente);
    }
    return this.metadataRepo.save(
      this.metadataRepo.create({ idActivity, file }),
    );
  }

  async recalcularProyecto(idProyect: number) {
    await this.actividadRepo.query(
      `
      UPDATE sgh_proyect_activity
      SET hour_e = TMP._hours
      FROM (
        SELECT a.id_proyect, ep.id_ep, SUM(dta.hours) AS _hours
        FROM sgh_dt_activity dta
        INNER JOIN sgh_activity a ON a.id_activity = dta.id_activity
        INNER JOIN sgh_estructure_proyect ep ON ep.id_item_activity = dta.id_item_activity
            AND ep.id_process = dta.id_process
        WHERE a.id_proyect = $1
        GROUP BY a.id_proyect, ep.id_ep
      ) TMP
      WHERE TMP.id_proyect = sgh_proyect_activity.id_proyect
        AND TMP.id_ep = sgh_proyect_activity.id_ep
      `,
      [idProyect],
    );
    return { message: 'Horas del proyecto recalculadas' };
  }

  async recalcularAvanceCronograma(idProyect: number) {
    await this.actividadRepo.query(
      `
      UPDATE s_cron_proyecto c
      SET avance = CASE WHEN COALESCE(h.hours_plan, 0) = 0 THEN 0
                        ELSE ROUND((COALESCE(h.hours_ejec, 0) / h.hours_plan) * 100, 2) END
      FROM (
        SELECT ep.id_process, SUM(pa.hour) AS hours_plan, SUM(pa.hour_e) AS hours_ejec
        FROM sgh_proyect_activity pa
        INNER JOIN sgh_estructure_proyect ep ON ep.id_ep = pa.id_ep
        WHERE pa.id_proyect = $1 AND pa.active = 1
        GROUP BY ep.id_process
      ) h
      WHERE c.id_proyect = $1 AND c.id_process = h.id_process AND c.avance_modelo = -1
      `,
      [idProyect],
    );
    return { message: 'Avance del cronograma recalculado' };
  }

  async reporteActividades(
    params: {
      fecini?: string;
      fecfin?: string;
      idType?: number;
      idProcess?: number;
      idUser?: number;
      idClient?: number;
    },
    login?: string,
  ) {
    const condiciones: string[] = [];
    const valores: unknown[] = [params.fecini || '1900-01-01', params.fecfin || '2999-12-31'];

    // Control por rol de sgh_users: solo rol='A' (administrador) puede ver los
    // reportes de TODOS los usuarios. Cualquier otro rol fuerza el filtro a
    // su propio id_user, sin importar el idUser recibido del frontend.
    let esAdmin = true;
    let idUserForzado: number | undefined;
    let requiereFiltro = false;
    if (login) {
      const usuario = await this.usuarioSghRepo.findOne({ where: { login } });
      esAdmin = usuario?.rol === 'A';
      idUserForzado = usuario?.idUser;
      // Si el login existe en sgh_users se aplica la regla de rol.
      // Si no existe (usuario sin perfil sgh), no puede ver datos de otros.
      requiereFiltro = true;
    }

    if (params.idType) {
      condiciones.push(`typ.id_type = $${valores.length + 1}`);
      valores.push(params.idType);
    }
    if (params.idProcess) {
      condiciones.push(`p.id_process = $${valores.length + 1}`);
      valores.push(params.idProcess);
    }
    if (requiereFiltro && !esAdmin) {
      if (idUserForzado !== undefined) {
        // No administrador: solo sus propios datos
        condiciones.push(`users.id_user = $${valores.length + 1}`);
        valores.push(idUserForzado);
      } else {
        // Usuario sin perfil sgh: no ve datos (condición imposible)
        condiciones.push('1 = 0');
      }
    } else if (esAdmin && params.idUser) {
      // Administrador: usa el filtro opcional (o "Todos")
      condiciones.push(`users.id_user = $${valores.length + 1}`);
      valores.push(params.idUser);
    }
    if (params.idClient) {
      condiciones.push(`client.id_client = $${valores.length + 1}`);
      valores.push(params.idClient);
    }
    const whereAdicional = condiciones.length ? `AND ${condiciones.join(' AND ')}` : '';

    return this.actividadRepo.query(
      `
      SELECT DISTINCT TMP.*, COALESCE(mt.file, '') AS file
      FROM (
        SELECT client.rif, client.name, doc.id_activity AS "idActivity", doc.numdoc,
               doc.date_document AS "dateDocument", doc.hour_document AS "hourDocument",
               doc.note, doc.responsible, doc.status, doc.visit,
               users.name_user AS "nameUser", typ.name_type AS "nameType",
               dt.id_detail AS "idDetail", p.name_process AS "nameProcess",
               dt.situation, dt.mantis, dt.note AS "detalleNota", dt.hours
        FROM sgh_activity doc
        INNER JOIN sgh_dt_activity dt ON dt.id_activity = doc.id_activity
        INNER JOIN sgh_process p ON p.id_process = dt.id_process
        INNER JOIN sgh_type typ ON typ.id_type = doc.id_type
        INNER JOIN sgh_client client ON client.id_client = doc.id_client
        INNER JOIN sgh_users users ON users.id_user = doc.id_user
        WHERE doc.date_document BETWEEN $1::date AND $2::date ${whereAdicional}
      ) TMP
      LEFT OUTER JOIN sgh_metadata mt ON mt.id_activity = TMP."idActivity"
      ORDER BY TMP."idActivity", TMP."idDetail"
      `,
      valores,
    );
  }
}
