import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_type' })
export class TipoActividad {
  @PrimaryGeneratedColumn({ name: 'id_type' })
  idType: number;

  @Column({ name: 'name_type', type: 'varchar', length: 100 })
  nameType: string;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;
}
