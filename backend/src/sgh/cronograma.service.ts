import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronProyecto } from './entities/cron-proyecto.entity';
import { CronHito } from './entities/cron-hito.entity';
import { CronSeguimiento } from './entities/cron-seguimiento.entity';
import {
  UpdateFaseDto,
  RegistrarSeguimientoDto,
  CrearHitoDto,
} from './dto/cronograma.dto';

const SUBCONSULTA_HORAS = (idProyect: number) => `
  SELECT ep.id_process, SUM(pa.hour) AS hours_plan, SUM(pa.hour_e) AS hours_ejec
  FROM sgh_proyect_activity pa
  INNER JOIN sgh_estructure_proyect ep ON ep.id_ep = pa.id_ep
  WHERE pa.id_proyect = ${idProyect} AND pa.active = 1
  GROUP BY ep.id_process
`;

@Injectable()
export class CronogramaService {
  constructor(
    @InjectRepository(CronProyecto)
    private readonly cronRepo: Repository<CronProyecto>,
    @InjectRepository(CronHito)
    private readonly hitoRepo: Repository<CronHito>,
    @InjectRepository(CronSeguimiento)
    private readonly seguimientoRepo: Repository<CronSeguimiento>,
  ) {}

  async getProyecto(idProyect: number) {
    const fila = await this.cronRepo.query(
      `
      SELECT doc.numdoc, doc.responsable, doc.date_ini AS "dateIni", doc.date_fin AS "dateFin",
             client.name AS "nameClient"
      FROM sgh_proyect doc
      INNER JOIN sgh_client client ON client.id_client = doc.id_client
      WHERE doc.id_proyect = $1
      `,
      [idProyect],
    );
    if (!fila[0]) throw new NotFoundException(`Proyecto ${idProyect} no encontrado`);
    return fila[0];
  }

  async getFases(idProyect: number) {
    return this.cronRepo.query(
      `
      SELECT c.id_cron AS "idCron", c.id_proyect AS "idProyect", c.id_process AS "idProcess",
             c.nombre_orden AS "nombreOrden", c.fecha_ini_plan AS "fechaIniPlan",
             c.fecha_fin_plan AS "fechaFinPlan", c.fecha_ini_real AS "fechaIniReal",
             c.fecha_fin_real AS "fechaFinReal", c.id_user_responsable AS "idUserResponsable",
             c.status, c.avance, c.avance_modelo AS "avanceModelo", c.orden,
             p.name_process AS "nameProcess",
             COALESCE(u.name_user, '') AS "nameUser",
             COALESCE(h.hours_plan, 0) AS "hoursPlan",
             COALESCE(h.hours_ejec, 0) AS "hoursEjec",
             CASE WHEN c.avance_modelo = -1 THEN
               CASE WHEN COALESCE(h.hours_plan, 0) = 0 THEN 0
                    ELSE ROUND((COALESCE(h.hours_ejec, 0) / h.hours_plan) * 100, 2) END
             ELSE c.avance END AS "avanceFinal"
      FROM s_cron_proyecto c
      INNER JOIN sgh_process p ON p.id_process = c.id_process
      LEFT JOIN sgh_users u ON u.id_user = c.id_user_responsable
      LEFT JOIN (${SUBCONSULTA_HORAS(idProyect)}) h ON h.id_process = c.id_process
      WHERE c.id_proyect = $1
      ORDER BY c.orden, p.name_process
      `,
      [idProyect],
    );
  }

  async updateFase(idCron: number, dto: UpdateFaseDto) {
    const fase = await this.cronRepo.findOne({ where: { idCron } });
    if (!fase) throw new NotFoundException(`Fase ${idCron} no encontrada`);

    if (dto.fechaIniPlan !== undefined) fase.fechaIniPlan = dto.fechaIniPlan ? new Date(dto.fechaIniPlan) : null as any;
    if (dto.fechaFinPlan !== undefined) fase.fechaFinPlan = dto.fechaFinPlan ? new Date(dto.fechaFinPlan) : null as any;
    if (dto.fechaIniReal !== undefined) fase.fechaIniReal = dto.fechaIniReal ? new Date(dto.fechaIniReal) : null as any;
    if (dto.fechaFinReal !== undefined) fase.fechaFinReal = dto.fechaFinReal ? new Date(dto.fechaFinReal) : null as any;
    if (dto.idUserResponsable !== undefined) fase.idUserResponsable = dto.idUserResponsable;
    if (dto.status !== undefined) fase.status = dto.status;
    if (dto.avanceModelo !== undefined) fase.avanceModelo = dto.avanceModelo;
    if (dto.avance !== undefined && dto.avanceModelo === 0) fase.avance = dto.avance;

    await this.cronRepo.save(fase);
    return fase;
  }

  async registrarSeguimiento(dto: RegistrarSeguimientoDto) {
    const fase = await this.cronRepo.findOne({ where: { idCron: dto.idCron } });
    if (!fase) throw new NotFoundException(`Fase ${dto.idCron} no encontrada`);

    const avanceOld = Number(fase.avance ?? 0);

    fase.avance = dto.avanceNew;
    fase.avanceModelo = 0;
    if (dto.statusNew !== undefined) fase.status = dto.statusNew;
    await this.cronRepo.save(fase);

    await this.seguimientoRepo.save(
      this.seguimientoRepo.create({
        idCron: dto.idCron,
        idProyect: dto.idProyect,
        idUser: dto.idUser,
        avanceOld,
        avanceNew: dto.avanceNew,
        statusNew: dto.statusNew,
        comentario: dto.comentario,
      }),
    );

    return { message: 'Seguimiento registrado' };
  }

  async getSeguimiento(idCron: number) {
    return this.seguimientoRepo.query(
      `
      SELECT sg.*, COALESCE(u.name_user, '') AS "nameUser"
      FROM s_cron_seguimiento sg
      LEFT JOIN sgh_users u ON u.id_user = sg.id_user
      WHERE sg.id_cron = $1
      ORDER BY sg.id_seguimiento DESC
      `,
      [idCron],
    );
  }

  async getHitos(idProyect: number) {
    return this.hitoRepo.find({ where: { idProyect }, order: { idHito: 'ASC' } });
  }

  async createHito(dto: CrearHitoDto) {
    const hito = this.hitoRepo.create({
      idCron: dto.idCron,
      idProyect: dto.idProyect,
      nombre: dto.nombre.toUpperCase(),
      fechaPlan: dto.fechaPlan ? new Date(dto.fechaPlan) : undefined,
      fechaReal: dto.fechaReal ? new Date(dto.fechaReal) : undefined,
      status: dto.status ?? 0,
      peso: dto.peso ?? 0,
      comentario: dto.comentario,
    });
    return this.hitoRepo.save(hito);
  }

  async updateHito(idHito: number, dto: Partial<CrearHitoDto>) {
    const hito = await this.hitoRepo.findOne({ where: { idHito } });
    if (!hito) throw new NotFoundException(`Hito ${idHito} no encontrado`);
    if (dto.nombre !== undefined) hito.nombre = dto.nombre.toUpperCase();
    if (dto.fechaPlan !== undefined) hito.fechaPlan = dto.fechaPlan ? new Date(dto.fechaPlan) : null as any;
    if (dto.fechaReal !== undefined) hito.fechaReal = dto.fechaReal ? new Date(dto.fechaReal) : null as any;
    if (dto.status !== undefined) hito.status = dto.status;
    if (dto.peso !== undefined) hito.peso = dto.peso;
    if (dto.comentario !== undefined) hito.comentario = dto.comentario;
    return this.hitoRepo.save(hito);
  }

  async removeHito(idHito: number) {
    const hito = await this.hitoRepo.findOne({ where: { idHito } });
    if (!hito) throw new NotFoundException(`Hito ${idHito} no encontrado`);
    await this.hitoRepo.remove(hito);
    return { message: 'Hito eliminado' };
  }

  async eliminarCronograma(idProyect: number) {
    await this.seguimientoRepo.delete({ idProyect });
    await this.hitoRepo.delete({ idProyect });
    await this.cronRepo.delete({ idProyect });
    return { message: 'Cronograma eliminado' };
  }
}
