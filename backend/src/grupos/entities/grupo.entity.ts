import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity({ name: 'sec_grupo', schema: 'public' })
export class Grupo {
  @PrimaryColumn({ name: 'id_grupo', type: 'uuid' })
  idGrupo: string;

  @Column({ name: 'grupo', type: 'varchar', length: 50 })
  @Index('idx_grupo')
  grupo: string;

  @Column({ name: 'denominacion', type: 'varchar', length: 80 })
  denominacion: string;
}
