import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_item_activity' })
export class ItemActividad {
  @PrimaryGeneratedColumn({ name: 'id_item_activity' })
  idItemActivity: number;

  @Column({ name: 'code', type: 'varchar', length: 6, nullable: true })
  code?: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name?: string;

  @Column({ name: 'orden', type: 'numeric', default: 0 })
  orden: number;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;
}
