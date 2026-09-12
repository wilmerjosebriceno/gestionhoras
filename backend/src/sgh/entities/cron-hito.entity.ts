import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 's_cron_hito' })
export class CronHito {
  @PrimaryGeneratedColumn({ name: 'id_hito' })
  idHito: number;

  @Column({ name: 'id_cron', type: 'int' })
  idCron: number;

  @Column({ name: 'id_proyect', type: 'int' })
  idProyect: number;

  @Column({ name: 'nombre', type: 'varchar', length: 255 })
  nombre: string;

  @Column({ name: 'fecha_plan', type: 'date', nullable: true })
  fechaPlan?: Date;

  @Column({ name: 'fecha_real', type: 'date', nullable: true })
  fechaReal?: Date;

  @Column({ name: 'status', type: 'smallint', default: 0 })
  status: number;

  @Column({ name: 'peso', type: 'numeric', default: 0 })
  peso: number;

  @Column({ name: 'comentario', type: 'varchar', length: 255, nullable: true })
  comentario?: string;
}
