import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_scrin_project_map' })
export class ScrinProjectMap {
  @PrimaryGeneratedColumn({ name: 'id_scrin_project_map' })
  idScrinProjectMap: number;

  @Column({ name: 'id_user', type: 'int', nullable: true })
  idUser?: number;

  @Column({ name: 'scrin_project_id', type: 'varchar', length: 64 })
  scrinProjectId: string;

  @Column({ name: 'scrin_project_name', type: 'varchar', length: 250, nullable: true })
  scrinProjectName?: string;

  @Column({ name: 'id_proyect', type: 'int', nullable: true })
  idProyect?: number;

  @Column({ name: 'id_client', type: 'int', nullable: true })
  idClient?: number;

  @Column({ name: 'active', type: 'smallint', default: 1 })
  active: number;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt?: Date;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt?: Date;
}
