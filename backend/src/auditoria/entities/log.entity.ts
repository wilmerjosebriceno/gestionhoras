import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Evento } from './evento.entity';

@Entity({ name: 'sec_log', schema: 'public' })
export class Log {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'id_evento', type: 'uuid', nullable: true })
  idEvento?: string;

  @Column({ name: 'id_acceso', type: 'uuid', nullable: true })
  idAcceso?: string;

  @Column({ name: 'fecha', type: 'date' })
  fecha: Date;

  @Column({ name: 'nota', type: 'varchar', length: 500 })
  nota: string;

  @Column({ name: 'tcpip', type: 'varchar', length: 50 })
  tcpip: string;

  @Column({ name: 'hora', type: 'time', nullable: true, default: '00:00:00' })
  hora?: string;

  @Column({ name: 'estblk', type: 'int', default: 0 })
  estblk: number;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'syslog', type: 'timestamp', nullable: true, default: () => 'NOW()' })
  syslog?: Date;

  @ManyToOne(() => Evento)
  @JoinColumn({ name: 'id_evento' })
  eventoRel?: Evento;
}
