import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstructuraProyecto } from './entities/estructura-proyecto.entity';
import { Proceso } from './entities/proceso.entity';
import { ItemActividad } from './entities/item-actividad.entity';
import { GuardarAsignacionDto } from './dto/estructura.dto';

@Injectable()
export class EstructuraService {
  constructor(
    @InjectRepository(EstructuraProyecto)
    private readonly estructuraRepo: Repository<EstructuraProyecto>,
    @InjectRepository(Proceso)
    private readonly procesoRepo: Repository<Proceso>,
    @InjectRepository(ItemActividad)
    private readonly itemRepo: Repository<ItemActividad>,
  ) {}

  async getdataEstructure() {
    return this.estructuraRepo
      .createQueryBuilder('ep')
      .innerJoin('sgh_item_activity', 'ia', 'ia.id_item_activity = ep.id_item_activity')
      .innerJoin('sgh_process', 'ps', 'ps.id_process = ep.id_process')
      .select([
        'ep.id_ep AS "idEp"',
        'ep.id_item_activity AS "idItemActivity"',
        'ep.id_process AS "idProcess"',
        'ep.hours',
        'ep.active',
        'ep.note',
        'ia.name AS "nameItem"',
        'ps.name_process AS "nameProcess"',
        'ps.orden',
      ])
      .where('ep.active = 1')
      .orderBy('ps.orden', 'ASC')
      .addOrderBy('ia.name', 'ASC')
      .getRawMany();
  }

  async getAsignacion(idItemActivity: number) {
    const filas: Array<{
      orden: number;
      idProcess: number;
      nameProcess: string;
      code: string | null;
      hours: number;
      active: number;
    }> = await this.estructuraRepo.query(
      `
      SELECT p.orden, p.id_process AS "idProcess", p.name_process AS "nameProcess", p.code,
             COALESCE(ep.hours, 0) AS hours, COALESCE(ep.active, 0) AS active
      FROM sgh_process p
      LEFT OUTER JOIN sgh_estructure_proyect ep
        ON p.id_process = ep.id_process AND ep.id_item_activity = $1
      WHERE p.active = 1
      ORDER BY p.orden, p.name_process
      `,
      [idItemActivity],
    );

    // Ordenamiento legado: inactivas primero, luego activas, luego sin asignación (null)
    const inactivas = filas.filter((f) => f.active === 0);
    const activas = filas.filter((f) => f.active === 1);
    return [...inactivas, ...activas];
  }

  async guardarAsignaciones(dto: GuardarAsignacionDto) {
    const { idItemActivity, asignaciones } = dto;
    for (const fila of asignaciones) {
      const existe = await this.estructuraRepo.findOne({
        where: { idProcess: fila.idProcess, idItemActivity },
      });

      if (existe) {
        existe.active = fila.active ?? 0;
        existe.hours = fila.hours ?? 0;
        await this.estructuraRepo.save(existe);
      } else {
        const nueva = this.estructuraRepo.create({
          idItemActivity,
          idProcess: fila.idProcess,
          active: fila.active ?? 0,
          hours: fila.hours ?? 0,
        });
        await this.estructuraRepo.save(nueva);
      }
    }
    return { message: 'Asignaciones guardadas correctamente' };
  }

  async desactivarOtras(idItemActivity: number, idProcess: number) {
    await this.estructuraRepo
      .createQueryBuilder()
      .update()
      .set({ active: 0, hours: 0 })
      .where('id_process = :idProcess AND id_item_activity <> :idItem', { idProcess, idItem: idItemActivity })
      .execute();
    return { message: 'Asignaciones desactivadas' };
  }

  async itemsActivos() {
    return this.itemRepo.find({ where: { active: 1 }, order: { orden: 'ASC' } });
  }
}
