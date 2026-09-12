import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectoActividad } from './entities/proyecto-actividad.entity';
import { Cliente } from './entities/cliente.entity';
import { EstructuraProyecto } from './entities/estructura-proyecto.entity';
import { Actividad } from './entities/actividad.entity';
import { CronProyecto } from './entities/cron-proyecto.entity';
import { CreateProyectoDto, UpdateProyectoDto, AnularProyectoDto } from './dto/proyecto.dto';

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepo: Repository<Proyecto>,
    @InjectRepository(ProyectoActividad)
    private readonly paRepo: Repository<ProyectoActividad>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(EstructuraProyecto)
    private readonly estructuraRepo: Repository<EstructuraProyecto>,
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(CronProyecto)
    private readonly cronRepo: Repository<CronProyecto>,
  ) {}

  async getCatalogo(numdoc?: string, fecini?: string, fecfin?: string) {
    const qb = this.proyectoRepo
      .createQueryBuilder('doc')
      .innerJoin('sgh_client', 'client', 'client.id_client = doc.id_client')
      .select([
        'client.rif',
        'client.name AS "nameClient"',
        'doc.id_proyect AS "idProyect"',
        'doc.numdoc',
        'doc.date_proyect AS "dateProyect"',
        'doc.date_ini AS "dateIni"',
        'doc.date_fin AS "dateFin"',
        'doc.hours',
        'doc.responsable',
        'doc.status',
        'doc.enterprise',
        'doc.id_client AS "idClient"',
      ])
      .distinct(true);

    if (numdoc) qb.andWhere('doc.numdoc ILIKE :n', { n: `%${numdoc}%` });
    if (fecini && fecfin) {
      qb.andWhere('doc.date_proyect BETWEEN :ini AND :fin', { ini: fecini, fin: fecfin });
    }
    qb.orderBy('doc.id_proyect', 'DESC');
    return qb.getRawMany();
  }

  async getDetailProyect(idProyect: number) {
    return this.proyectoRepo.query(
      `
      SELECT * FROM (
        SELECT dt.id_proyect AS "idProyect", ia.name, ps.name_process AS "nameProcess", dt.id_ep AS "idEp",
               dt.hour, dt.active, dt.hour_e AS "hourE",
               dt.id_proyect_activity AS "idProyectActivity", ep.id_process AS "idProcess",
               ep.id_item_activity AS "idItemActivity", ps.orden
        FROM sgh_proyect_activity dt
        INNER JOIN sgh_estructure_proyect ep ON dt.id_ep = ep.id_ep
        INNER JOIN sgh_item_activity ia ON ia.id_item_activity = ep.id_item_activity
        INNER JOIN sgh_process ps ON ps.id_process = ep.id_process
        WHERE dt.id_proyect = $1
        UNION ALL
        SELECT 0 AS "idProyect", ia.name, ps.name_process AS "nameProcess", ep.id_ep AS "idEp",
               ep.hours AS hour, 0 AS active, 0 AS "hourE", 0 AS "idProyectActivity",
               ep.id_process AS "idProcess", ep.id_item_activity AS "idItemActivity", ps.orden
        FROM sgh_estructure_proyect ep
        INNER JOIN sgh_item_activity ia ON ia.id_item_activity = ep.id_item_activity
        INNER JOIN sgh_process ps ON ps.id_process = ep.id_process
        WHERE ep.active = 1 AND ep.id_ep NOT IN (
          SELECT dt.id_ep
          FROM sgh_proyect_activity dt
          INNER JOIN sgh_estructure_proyect ep ON dt.id_ep = ep.id_ep
          INNER JOIN sgh_item_activity ia ON ia.id_item_activity = ep.id_item_activity
          INNER JOIN sgh_process ps ON ps.id_process = ep.id_process
          WHERE dt.id_proyect = $1
        )
      ) TMP
      ORDER BY TMP.orden, TMP."nameProcess", TMP.name
      `,
      [idProyect],
    );
  }

  async getActivityByProyect(idProyect: number) {
    return this.proyectoRepo.query(
      `
      SELECT DISTINCT TMP.*, COALESCE(mt.file, '') AS file
      FROM (
        SELECT DISTINCT client.rif, client.name, doc.id_type AS "idType", doc.id_activity AS "idActivity",
               doc.id_client AS "idClient", doc.numdoc, doc.date_document AS "dateDocument",
               doc.hour_document AS "hourDocument", doc.note, doc.responsible, doc.visit, doc.status,
               users.name_user AS "nameUser"
        FROM sgh_activity doc
        INNER JOIN sgh_dt_activity dt ON dt.id_activity = doc.id_activity
        INNER JOIN sgh_process p ON p.id_process = dt.id_process
        INNER JOIN sgh_type typ ON typ.id_type = doc.id_type
        INNER JOIN sgh_client client ON client.id_client = doc.id_client
        INNER JOIN sgh_users users ON users.id_user = doc.id_user
        WHERE doc.id_proyect = $1
      ) TMP
      LEFT OUTER JOIN sgh_metadata mt ON mt.id_activity = TMP."idActivity"
      ORDER BY TMP.numdoc
      `,
      [idProyect],
    );
  }

  private async generarNumdoc(): Promise<string> {
    const fila = await this.proyectoRepo.query(
      'SELECT COALESCE(MAX(CAST(numdoc AS numeric)), 0) + 1 AS next FROM sgh_proyect',
    );
    const next = Number(fila[0]?.next ?? 1);
    return String(next).padStart(10, '0');
  }

  async create(dto: CreateProyectoDto) {
    const numdoc = dto.numdoc || (await this.generarNumdoc());
    const proyecto = this.proyectoRepo.create({
      numdoc,
      dateProyect: dto.dateProyect ? new Date(dto.dateProyect) : new Date(),
      dateIni: dto.dateIni ? new Date(dto.dateIni) : undefined,
      dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
      hours: 0,
      responsable: dto.responsable,
      idClient: dto.idClient,
      status: dto.status ?? 0,
      enterprise: dto.enterprise,
    });
    const saved = await this.proyectoRepo.save(proyecto);

    if (dto.actividades && dto.actividades.length > 0) {
      const filas = dto.actividades
        .filter((a) => a.idEp && a.hour !== undefined && a.active === 1)
        .map((a) =>
          this.paRepo.create({
            idProyect: saved.idProyect,
            idEp: a.idEp!,
            hour: a.hour ?? 0,
            hourE: 0,
            active: a.active ?? 0,
          }),
        );
      if (filas.length > 0) await this.paRepo.save(filas);
    }

    await this.generarCronograma(saved.idProyect, saved.dateIni, saved.dateFin);
    return this.findOne(saved.idProyect);
  }

  async update(id: number, dto: UpdateProyectoDto) {
    const proyecto = await this.findOne(id);
    if (dto.numdoc !== undefined) proyecto.numdoc = dto.numdoc;
    if (dto.dateProyect !== undefined) proyecto.dateProyect = dto.dateProyect ? new Date(dto.dateProyect) : undefined;
    if (dto.dateIni !== undefined) proyecto.dateIni = dto.dateIni ? new Date(dto.dateIni) : undefined;
    if (dto.dateFin !== undefined) proyecto.dateFin = dto.dateFin ? new Date(dto.dateFin) : undefined;
    if (dto.responsable !== undefined) proyecto.responsable = dto.responsable;
    if (dto.idClient !== undefined) proyecto.idClient = dto.idClient;
    if (dto.status !== undefined) proyecto.status = dto.status;
    if (dto.enterprise !== undefined) proyecto.enterprise = dto.enterprise;
    await this.proyectoRepo.save(proyecto);

    if (dto.actividades && dto.actividades.length > 0) {
      for (const fila of dto.actividades) {
        if (fila.idProyectActivity) {
          await this.paRepo.update(fila.idProyectActivity, {
            hour: fila.hour ?? 0,
            active: fila.active ?? 0,
          });
        } else if (fila.idEp && fila.active === 1) {
          const existe = await this.paRepo.findOne({
            where: { idProyect: id, idEp: fila.idEp },
          });
          if (existe) {
            existe.hour = fila.hour ?? 0;
            existe.active = fila.active;
            await this.paRepo.save(existe);
          } else {
            await this.paRepo.save(
              this.paRepo.create({
                idProyect: id,
                idEp: fila.idEp,
                hour: fila.hour ?? 0,
                hourE: 0,
                active: fila.active,
              }),
            );
          }
        }
      }
    }

    await this.generarCronograma(id, proyecto.dateIni, proyecto.dateFin);
    return this.findOne(id);
  }

  async findOne(id: number) {
    const proyecto = await this.proyectoRepo.findOne({
      where: { idProyect: id },
      relations: ['cliente'],
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async remove(id: number) {
    const proyecto = await this.findOne(id);
    await this.paRepo.delete({ idProyect: id });
    await this.proyectoRepo.remove(proyecto);
    return { message: 'Proyecto eliminado' };
  }

  async anular(id: number, dto: AnularProyectoDto) {
    const proyecto = await this.findOne(id);
    const now = new Date();
    await this.actividadRepo
      .createQueryBuilder()
      .update()
      .set({
        status: 2,
        mAnulado: dto.motivo,
        fAnulado: now,
        tAnulado: `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
      })
      .where('id_proyect = :id', { id })
      .execute();
    return { message: `Actividades del proyecto ${proyecto.numdoc} anuladas` };
  }

  async generarCronograma(idProyect: number, dateIni?: Date | null, dateFin?: Date | null) {
    if (!dateIni || !dateFin) return;

    const pendientes = await this.proyectoRepo.query(
      `
      SELECT DISTINCT p.id_process, p.name_process, p.orden
      FROM sgh_process p
      INNER JOIN sgh_estructure_proyect ep ON ep.id_process = p.id_process AND ep.active = 1 AND ep.hours > 0
      WHERE p.active = 1 AND p.id_process NOT IN (
        SELECT c.id_process FROM s_cron_proyecto c WHERE c.id_proyect = $1
      )
      ORDER BY p.orden
      `,
      [idProyect],
    );

    if (pendientes.length === 0) return;

    const inicio = new Date(dateIni);
    const fin = new Date(dateFin);
    const totalDias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86400000));
    const seg = totalDias / pendientes.length;

    for (let i = 0; i < pendientes.length; i++) {
      const f = pendientes[i];
      const inicioFase = new Date(inicio.getTime() + i * seg * 86400000);
      const finFase = new Date(inicioFase.getTime() + Math.max(0, seg - 1) * 86400000);

      const existe = await this.cronRepo.findOne({
        where: { idProyect, idProcess: f.id_process },
      });
      if (existe) continue;

      await this.cronRepo.save(
        this.cronRepo.create({
          idProyect,
          idProcess: f.id_process,
          nombreOrden: f.name_process,
          fechaIniPlan: inicioFase,
          fechaFinPlan: finFase,
          orden: f.orden,
          status: 0,
          avance: 0,
          avanceModelo: -1,
        }),
      );
    }
  }

  async proyectosActivosDelCliente(idClient: number) {
    return this.proyectoRepo
      .createQueryBuilder('p')
      .innerJoin('p.cliente', 'c')
      .select(['p.idProyect', 'p.numdoc', 'p.dateProyect'])
      .addSelect(['c.rif', 'c.name'])
      .where('p.status = 1 AND p.idClient = :idClient', { idClient })
      .orderBy('p.idProyect', 'DESC')
      .getMany();
  }
}
