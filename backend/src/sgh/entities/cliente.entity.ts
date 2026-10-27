import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_client' })
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'id_client' })
  idClient: number;

  @Column({ name: 'rif', type: 'varchar', length: 50 })
  rif: string;

  @Column({ name: 'name', type: 'varchar', length: 300 })
  name: string;

  @Column({ name: 'adress', type: 'varchar', length: 500 })
  adress: string;

  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ name: 'contac_tel', type: 'varchar', length: 100, nullable: true })
  contacTel?: string;

  @Column({ name: 'contac_name', type: 'varchar', length: 100, nullable: true })
  contacName?: string;

  @Column({ name: 'creation', type: 'date' })
  creation: Date;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;

  @Column({ name: 'mantenimiento', type: 'integer', default: 0, nullable: true })
  mantenimiento?: number;

  @Column({ name: 'id_mantis_proyect', type: 'integer', default: 0, nullable: true })
  idMantisProyect?: number;
}
