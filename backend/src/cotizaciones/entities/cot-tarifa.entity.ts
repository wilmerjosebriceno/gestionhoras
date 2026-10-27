import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne } from 'typeorm';
import { Region } from './region.entity';
import { CotRangoUsuario } from './cot-rango-usuario.entity';

/** Tarifa por (región, rango de usuarios, modalidad). */
@Entity({ name: 'cot_tarifa' })
export class CotTarifa {
  @PrimaryGeneratedColumn({ name: 'id_tarifa' })
  idTarifa: number;

  @Column({ name: 'id_region', type: 'int' })
  idRegion: number;

  @Column({ name: 'id_rango', type: 'int' })
  idRango: number;

  @Column({ name: 'modalidad', type: 'varchar', length: 10 })
  modalidad: string;

  @Column({ name: 'tarifa', type: 'numeric', precision: 18, scale: 4, default: 0 })
  tarifa: number;

  @Column({ name: 'activo', type: 'smallint', nullable: true, default: 1 })
  activo?: number | null;

  @ManyToOne(() => Region)
  @JoinColumn({ name: 'id_region' })
  region?: Region;

  @ManyToOne(() => CotRangoUsuario)
  @JoinColumn({ name: 'id_rango' })
  rango?: CotRangoUsuario;
}
