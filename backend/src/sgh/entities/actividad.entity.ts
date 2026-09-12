import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Cliente } from './cliente.entity';
import { TipoActividad } from './tipo-actividad.entity';
import { UsuarioSgh } from './usuario-sgh.entity';
import { DetalleActividad } from './detalle-actividad.entity';

@Entity({ name: 'sgh_activity' })
export class Actividad {
  @PrimaryGeneratedColumn({ name: 'id_activity' })
  idActivity: number;

  @Column({ name: 'id_type', type: 'int', nullable: true })
  idType?: number;

  @Column({ name: 'id_client', type: 'int', nullable: true })
  idClient?: number;

  @Column({ name: 'id_user', type: 'int', nullable: true })
  idUser?: number;

  @Column({ name: 'numdoc', type: 'varchar', length: 20 })
  numdoc: string;

  @Column({ name: 'responsible', type: 'varchar', length: 250 })
  responsible: string;

  @Column({ name: 'date_document', type: 'date' })
  dateDocument: string;

  @Column({ name: 'hour_document', type: 'time' })
  hourDocument: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'status', type: 'smallint', default: 0 })
  status: number;

  @Column({ name: 'm_anulado', type: 'varchar', length: 250, nullable: true })
  mAnulado?: string;

  @Column({ name: 'f_anulado', type: 'date', nullable: true })
  fAnulado?: Date;

  @Column({ name: 't_anulado', type: 'time', nullable: true })
  tAnulado?: string;

  @Column({ name: 'alter_date', type: 'date', nullable: true })
  alterDate?: Date;

  @Column({ name: 'visit', type: 'smallint', default: 0 })
  visit: number;

  @Column({ name: 'id_proyect', type: 'int', default: 0 })
  idProyect: number;

  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'id_client' })
  cliente?: Cliente;

  @ManyToOne(() => TipoActividad)
  @JoinColumn({ name: 'id_type' })
  tipo?: TipoActividad;

  @ManyToOne(() => UsuarioSgh)
  @JoinColumn({ name: 'id_user' })
  usuario?: UsuarioSgh;

  @OneToMany(() => DetalleActividad, (dt) => dt.actividad)
  detalles?: DetalleActividad[];
}
