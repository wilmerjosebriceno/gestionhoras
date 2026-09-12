import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actividad } from './entities/actividad.entity';
import { CronProyecto } from './entities/cron-proyecto.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(CronProyecto)
    private readonly cronRepo: Repository<CronProyecto>,
  ) {}

  async getEstadisticasClienteAnual() {
    return this.actividadRepo.query(`
      SELECT T_A.*, T_B._process, T_B.hours
      FROM (
        SELECT cli.id_client AS "idClient", cli.name, COUNT(*) AS _activity
        FROM sgh_activity act INNER JOIN sgh_client cli ON cli.id_client = act.id_client
        WHERE EXTRACT(YEAR FROM date_document) = EXTRACT(YEAR FROM CURRENT_DATE)
        GROUP BY cli.id_client, cli.name
      ) T_A
      INNER JOIN (
        SELECT id_client AS "idClient", COUNT(*) AS _process, SUM(hours) AS hours
        FROM (
          SELECT id_client, id_process, SUM(hours) AS hours
          FROM sgh_activity act INNER JOIN sgh_dt_activity dt ON act.id_activity = dt.id_activity
          WHERE EXTRACT(YEAR FROM date_document) = EXTRACT(YEAR FROM CURRENT_DATE)
          GROUP BY id_client, id_process
        ) TB
        GROUP BY id_client
      ) T_B ON T_A."idClient" = T_B."idClient"
      ORDER BY T_A._activity
    `);
  }

  async getHourClientAnual() {
    return this.actividadRepo.query(`
      SELECT cli.id_client AS "idClient", cli.name, COUNT(*) AS _activity, SUM(dt.hours) AS hours
      FROM sgh_activity act
      INNER JOIN sgh_dt_activity dt ON act.id_activity = dt.id_activity
      INNER JOIN sgh_client cli ON cli.id_client = act.id_client
      WHERE EXTRACT(YEAR FROM date_document) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY cli.id_client, cli.name
      ORDER BY hours DESC
    `);
  }

  async hourUserAnual() {
    return this.actividadRepo.query(`
      SELECT u.name_user AS "nameUser", COUNT(*) AS modulos, SUM(hours) AS hours
      FROM sgh_activity act INNER JOIN sgh_dt_activity dt ON act.id_activity = dt.id_activity
      INNER JOIN sgh_users u ON u.id_user = act.id_user
      WHERE EXTRACT(YEAR FROM date_document) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY u.name_user
      ORDER BY hours
    `);
  }

  async hourUserFiscal() {
    return this.actividadRepo.query(`
      SELECT u.name_user AS "nameUser", SUM(hours) AS hours
      FROM sgh_activity act INNER JOIN sgh_dt_activity dt ON act.id_activity = dt.id_activity
      INNER JOIN sgh_users u ON u.id_user = act.id_user
      WHERE EXTRACT(YEAR FROM date_document) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY u.name_user
      ORDER BY hours
    `);
  }

  async proyectsChart() {
    return this.actividadRepo.query(`
      SELECT p.id_proyect AS "idProyect", cli.name, SUM(pa.hour) AS hour, SUM(pa.hour_e) AS hour_e
      FROM sgh_proyect p
      INNER JOIN sgh_client cli ON cli.id_client = p.id_client
      INNER JOIN sgh_proyect_activity pa ON pa.id_proyect = p.id_proyect
      WHERE p.status = 1 AND pa.active = 1 AND EXTRACT(YEAR FROM date_proyect) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY p.id_proyect, cli.name
      ORDER BY p.id_proyect
    `);
  }

  async avanceFasesProyecto(idProyect: number) {
    return this.actividadRepo.query(
      `
      SELECT COALESCE(c.nombre_orden, p.name_process, '') AS name,
             CASE WHEN c.avance_modelo = -1 THEN
               CASE WHEN COALESCE(h.hours_plan, 0) = 0 THEN 0
                    ELSE ROUND((COALESCE(h.hours_ejec, 0) / h.hours_plan) * 100, 2) END
             ELSE c.avance END AS avance
      FROM s_cron_proyecto c
      INNER JOIN sgh_process p ON p.id_process = c.id_process
      LEFT JOIN (
        SELECT ep.id_process, SUM(pa.hour) AS hours_plan, SUM(pa.hour_e) AS hours_ejec
        FROM sgh_proyect_activity pa
        INNER JOIN sgh_estructure_proyect ep ON ep.id_ep = pa.id_ep
        WHERE pa.id_proyect = $1 AND pa.active = 1
        GROUP BY ep.id_process
      ) h ON h.id_process = c.id_process
      WHERE c.id_proyect = $1
      ORDER BY c.orden, p.name_process
      `,
      [idProyect],
    );
  }

  async resumenGeneral() {
    const totalActividades = await this.actividadRepo.query(
      'SELECT COUNT(*) AS total FROM sgh_activity WHERE EXTRACT(YEAR FROM date_document) = EXTRACT(YEAR FROM CURRENT_DATE)',
    );
    const totalProyectos = await this.actividadRepo.query('SELECT COUNT(*) AS total FROM sgh_proyect');
    const totalHoras = await this.actividadRepo.query(
      `SELECT COALESCE(SUM(dt.hours), 0) AS total
       FROM sgh_dt_activity dt
       INNER JOIN sgh_activity act ON act.id_activity = dt.id_activity
       WHERE EXTRACT(YEAR FROM act.date_document) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    );
    const totalFases = await this.cronRepo.count();
    return {
      totalActividades: Number(totalActividades[0]?.total ?? 0),
      totalProyectos: Number(totalProyectos[0]?.total ?? 0),
      totalHoras: Number(totalHoras[0]?.total ?? 0),
      totalFases,
    };
  }
}
