import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_process' })
export class Proceso {
  @PrimaryGeneratedColumn({ name: 'id_process' })
  idProcess: number;

  @Column({ name: 'name_process', type: 'varchar', length: 100 })
  nameProcess: string;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;

  @Column({ name: 'code', type: 'varchar', length: 3, nullable: true })
  code?: string;

  @Column({ name: 'orden', type: 'numeric', default: 0 })
  orden: number;
}
