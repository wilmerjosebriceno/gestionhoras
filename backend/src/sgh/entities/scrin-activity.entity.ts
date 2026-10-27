import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

const bigintToNumber = {
  to: (value?: number) => value,
  from: (value?: string) => (value == null ? value : Number(value)),
};

@Entity({ name: 'sgh_scrin_activity' })
export class ScrinActivity {
  @PrimaryGeneratedColumn({ name: 'id_scrin_activity' })
  idScrinActivity: number;

  @Column({ name: 'id_user', type: 'int', nullable: true })
  idUser?: number;

  @Column({ name: 'activity_id', type: 'varchar', length: 64 })
  activityId: string;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId?: number;

  @Column({ name: 'employee_name', type: 'varchar', length: 250, nullable: true })
  employeeName?: string;

  @Column({ name: 'scrin_project_id', type: 'varchar', length: 64, nullable: true })
  scrinProjectId?: string;

  @Column({ name: 'scrin_project_name', type: 'varchar', length: 250, nullable: true })
  scrinProjectName?: string;

  @Column({ name: 'from_ts', type: 'bigint', nullable: true, transformer: bigintToNumber })
  fromTs?: number;

  @Column({ name: 'to_ts', type: 'bigint', nullable: true, transformer: bigintToNumber })
  toTs?: number;

  @Column({ name: 'date_activity', type: 'date', nullable: true })
  dateActivity?: string;

  @Column({ name: 'hour_ini', type: 'time', nullable: true })
  hourIni?: string;

  @Column({ name: 'hour_fin', type: 'time', nullable: true })
  hourFin?: string;

  @Column({ name: 'duration_minutes', type: 'int', default: 0 })
  durationMinutes: number;

  @Column({ name: 'offline', type: 'smallint', default: 0 })
  offline: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'selected', type: 'smallint', default: 0 })
  selected: number;

  @Column({ name: 'sync_status', type: 'smallint', default: 0 })
  syncStatus: number;

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

  @Column({ name: 'id_scrin_summary', type: 'int', nullable: true })
  idScrinSummary?: number;

  @Column({ name: 'id_activity', type: 'int', nullable: true })
  idActivity?: number;

  @Column({ name: 'date_sync', type: 'timestamp', nullable: true })
  dateSync?: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;
}
