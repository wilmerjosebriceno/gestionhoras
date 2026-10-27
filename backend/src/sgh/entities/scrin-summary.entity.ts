import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_scrin_summary' })
export class ScrinSummary {
  @PrimaryGeneratedColumn({ name: 'id_scrin_summary' })
  idScrinSummary: number;

  @Column({ name: 'id_user', type: 'int', nullable: true })
  idUser?: number;

  @Column({ name: 'scrin_project_id', type: 'varchar', length: 64, nullable: true })
  scrinProjectId?: string;

  @Column({ name: 'scrin_project_name', type: 'varchar', length: 250, nullable: true })
  scrinProjectName?: string;

  @Column({ name: 'date_from', type: 'date', nullable: true })
  dateFrom?: string;

  @Column({ name: 'date_to', type: 'date', nullable: true })
  dateTo?: string;

  @Column({ name: 'activities_count', type: 'int', default: 0 })
  activitiesCount: number;

  @Column({ name: 'total_minutes', type: 'int', default: 0 })
  totalMinutes: number;

  @Column({ name: 'id_proyect', type: 'int', nullable: true })
  idProyect?: number;

  @Column({ name: 'id_client', type: 'int', nullable: true })
  idClient?: number;

  @Column({ name: 'id_type', type: 'int', nullable: true })
  idType?: number;

  @Column({ name: 'id_process', type: 'int', nullable: true })
  idProcess?: number;

  @Column({ name: 'id_item_activity', type: 'int', nullable: true })
  idItemActivity?: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'status', type: 'smallint', default: 0 })
  status: number;

  @Column({ name: 'id_activity', type: 'int', nullable: true })
  idActivity?: number;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt?: Date;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt?: Date;
}
