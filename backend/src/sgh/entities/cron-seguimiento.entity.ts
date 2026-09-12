import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 's_cron_seguimiento' })
export class CronSeguimiento {
  @PrimaryGeneratedColumn({ name: 'id_seguimiento' })
  idSeguimiento: number;

  @Column({ name: 'id_cron', type: 'int' })
  idCron: number;

  @Column({ name: 'id_proyect', type: 'int' })
  idProyect: number;

  @Column({ name: 'id_user', type: 'int' })
  idUser: number;

  @Column({ name: 'fecha', type: 'date', default: () => 'CURRENT_DATE' })
  fecha?: Date;

  @Column({ name: 'horas_plan', type: 'numeric', default: 0 })
  horasPlan?: number;

  @Column({ name: 'horas_ejec', type: 'numeric', default: 0 })
  horasEjec?: number;

  @Column({ name: 'avance_old', type: 'numeric', default: 0 })
  avanceOld?: number;

  @Column({ name: 'avance_new', type: 'numeric', default: 0 })
  avanceNew?: number;

  @Column({ name: 'status_old', type: 'smallint', nullable: true })
  statusOld?: number;

  @Column({ name: 'status_new', type: 'smallint', nullable: true })
  statusNew?: number;

  @Column({ name: 'comentario', type: 'text', nullable: true })
  comentario?: string;
}
