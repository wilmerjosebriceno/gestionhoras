import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_estructure_proyect' })
export class EstructuraProyecto {
  @PrimaryGeneratedColumn({ name: 'id_ep' })
  idEp: number;

  @Column({ name: 'id_item_activity', type: 'int' })
  idItemActivity: number;

  @Column({ name: 'id_process', type: 'int', nullable: true })
  idProcess?: number;

  @Column({ name: 'note', type: 'varchar', length: 100, nullable: true })
  note?: string;

  @Column({ name: 'hours', type: 'numeric', default: 0 })
  hours: number;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;
}
