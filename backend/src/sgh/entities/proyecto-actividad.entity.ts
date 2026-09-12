import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { EstructuraProyecto } from './estructura-proyecto.entity';

@Entity({ name: 'sgh_proyect_activity' })
export class ProyectoActividad {
  @PrimaryGeneratedColumn({ name: 'id_proyect_activity' })
  idProyectActivity: number;

  @Column({ name: 'id_proyect', type: 'int' })
  idProyect: number;

  @Column({ name: 'id_ep', type: 'int' })
  idEp: number;

  @Column({ name: 'hour', type: 'numeric', default: 0 })
  hour: number;

  @Column({ name: 'hour_e', type: 'numeric', default: 0 })
  hourE: number;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;

  @ManyToOne(() => Proyecto, (p) => p.actividades)
  @JoinColumn({ name: 'id_proyect' })
  proyecto?: Proyecto;

  @ManyToOne(() => EstructuraProyecto)
  @JoinColumn({ name: 'id_ep' })
  estructura?: EstructuraProyecto;
}
