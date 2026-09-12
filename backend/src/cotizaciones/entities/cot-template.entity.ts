import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'cot_template' })
export class CotTemplate {
  @PrimaryGeneratedColumn({ name: 'id_template' })
  idTemplate: number;

  @Column({ name: 'code', type: 'varchar', length: 8, nullable: true })
  code?: string | null;

  @Column({ name: 'name', type: 'text', nullable: true })
  name?: string | null;

  @Column({ name: 'price', type: 'numeric', precision: 18, scale: 4, default: 0 })
  price: number;

  @Column({ name: 'hours', type: 'numeric', precision: 18, scale: 4, default: 0, nullable: true })
  hours?: number | null;
}