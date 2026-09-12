import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Cliente } from './cliente.entity';
import { ProyectoActividad } from './proyecto-actividad.entity';

@Entity({ name: 'sgh_proyect' })
export class Proyecto {
  @PrimaryGeneratedColumn({ name: 'id_proyect' })
  idProyect: number;

  @Column({ name: 'numdoc', type: 'varchar', length: 10, nullable: true })
  numdoc?: string;

  @Column({ name: 'date_proyect', type: 'date', nullable: true })
  dateProyect?: Date;

  @Column({ name: 'date_ini', type: 'date', nullable: true })
  dateIni?: Date;

  @Column({ name: 'date_fin', type: 'date', nullable: true })
  dateFin?: Date;

  @Column({ name: 'hours', type: 'numeric', default: 0 })
  hours: number;

  @Column({ name: 'responsable', type: 'varchar', length: 100, nullable: true })
  responsable?: string;

  @Column({ name: 'id_client', type: 'int', nullable: true })
  idClient?: number;

  @Column({ name: 'status', type: 'int', default: 0 })
  status: number;

  @Column({ name: 'enterprise', type: 'smallint', nullable: true })
  enterprise?: number;

  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'id_client' })
  cliente?: Cliente;

  @OneToMany(() => ProyectoActividad, (pa) => pa.proyecto)
  actividades?: ProyectoActividad[];
}
