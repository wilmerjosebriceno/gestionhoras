import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity({ name: 'sec_evento', schema: 'public' })
export class Evento {
  @PrimaryColumn({ name: 'id_evento', type: 'uuid' })
  idEvento: string;

  @Column({ name: 'evento', type: 'varchar', length: 50 })
  @Index('idx_evento')
  evento: string;

  @Column({ name: 'denominacion', type: 'varchar', length: 100 })
  denominacion: string;
}
