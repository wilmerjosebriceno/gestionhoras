import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/** Rango de usuarios (desde/hasta) usado por las tarifas y por la cotización. */
@Entity({ name: 'cot_rango_usuario' })
export class CotRangoUsuario {
  @PrimaryGeneratedColumn({ name: 'id_rango' })
  idRango: number;

  @Column({ name: 'desde', type: 'int' })
  desde: number;

  @Column({ name: 'hasta', type: 'int' })
  hasta: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 60, nullable: true })
  descripcion?: string | null;

  @Column({ name: 'activo', type: 'smallint', nullable: true, default: 1 })
  activo?: number | null;
}
