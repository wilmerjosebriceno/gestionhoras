import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'cot_tasa_iva' })
export class CotTasaIva {
  @PrimaryGeneratedColumn({ name: 'id_tasa_iva' })
  idTasaIva: number;

  @Column({ name: 'nombre', type: 'varchar', length: 60 })
  nombre: string;

  @Column({ name: 'porcentaje', type: 'int', default: 0 })
  porcentaje: number;

  @Column({ name: 'activo', type: 'smallint', default: 1 })
  activo?: number | null;

  @Column({ name: 'orden', type: 'int', default: 0 })
  orden?: number | null;
}
