import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 's_cron_proyecto' })
export class CronProyecto {
  @PrimaryGeneratedColumn({ name: 'id_cron' })
  idCron: number;

  @Column({ name: 'id_proyect', type: 'int' })
  idProyect: number;

  @Column({ name: 'id_process', type: 'int' })
  idProcess: number;

  @Column({ name: 'nombre_orden', type: 'varchar', length: 120, nullable: true })
  nombreOrden?: string;

  @Column({ name: 'fecha_ini_plan', type: 'date', nullable: true })
  fechaIniPlan?: Date;

  @Column({ name: 'fecha_fin_plan', type: 'date', nullable: true })
  fechaFinPlan?: Date;

  @Column({ name: 'fecha_ini_real', type: 'date', nullable: true })
  fechaIniReal?: Date;

  @Column({ name: 'fecha_fin_real', type: 'date', nullable: true })
  fechaFinReal?: Date;

  @Column({ name: 'id_user_responsable', type: 'int', nullable: true })
  idUserResponsable?: number;

  @Column({ name: 'status', type: 'smallint', default: 0 })
  status: number;

  @Column({ name: 'avance', type: 'numeric', default: 0 })
  avance: number;

  @Column({ name: 'avance_modelo', type: 'smallint', default: -1 })
  avanceModelo: number;

  @Column({ name: 'orden', type: 'int', default: 0 })
  orden: number;

  @Column({ name: 'fecha_reg', type: 'date', default: () => 'CURRENT_DATE' })
  fechaReg?: Date;
}
