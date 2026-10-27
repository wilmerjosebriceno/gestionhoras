import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Actividad } from './actividad.entity';
import { Proceso } from './proceso.entity';
import { ItemActividad } from './item-actividad.entity';

@Entity({ name: 'sgh_dt_activity' })
export class DetalleActividad {
  @PrimaryGeneratedColumn({ name: 'id_detail' })
  idDetail: number;

  @Column({ name: 'id_item_activity', type: 'int', default: 0 })
  idItemActivity: number;

  @Column({ name: 'id_process', type: 'int' })
  idProcess: number;

  @Column({ name: 'id_activity', type: 'int', nullable: true })
  idActivity?: number;

  @Column({ name: 'situation', type: 'text', nullable: true })
  situation?: string;

  @Column({ name: 'hours', type: 'numeric', default: 0 })
  hours: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'mantis', type: 'varchar', length: 20, nullable: true })
  mantis?: string;

  /** 1 = modalidad online · 0 = presencial (nulo se interpreta como presencial). */
  @Column({ name: 'online', type: 'smallint', nullable: true, default: 0 })
  online?: number;

  @ManyToOne(() => Actividad, (a) => a.detalles)
  @JoinColumn({ name: 'id_activity' })
  actividad?: Actividad;

  @ManyToOne(() => Proceso)
  @JoinColumn({ name: 'id_process' })
  proceso?: Proceso;

  @ManyToOne(() => ItemActividad)
  @JoinColumn({ name: 'id_item_activity' })
  itemActividad?: ItemActividad;
}
