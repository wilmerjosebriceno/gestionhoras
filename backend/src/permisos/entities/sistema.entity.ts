import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity({ name: 'sec_sistema', schema: 'public' })
export class Sistema {
  @PrimaryColumn({ name: 'id_sistema', type: 'uuid' })
  idSistema: string;

  @Column({ name: 'sistema', type: 'varchar', length: 4 })
  @Index('idx_sistema')
  sistema: string;

  @Column({ name: 'denominacion', type: 'varchar', length: 80 })
  denominacion: string;

  @Column({ name: 'descripcion', type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ name: 'ruta', type: 'varchar', length: 40, nullable: true })
  ruta: string | null;

  @Column({ name: 'estatus', type: 'int', default: 1 })
  estatus: number;
}
