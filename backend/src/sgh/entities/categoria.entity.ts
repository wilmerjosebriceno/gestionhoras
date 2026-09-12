import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_category' })
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'id_category' })
  idCategory: number;

  @Column({ name: 'name_category', type: 'varchar', length: 100 })
  nameCategory: string;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;
}
