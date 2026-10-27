import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne } from 'typeorm';
import { CotClient } from './cot-client.entity';

@Entity({ name: 'cot_region' })
export class Region {
  @PrimaryGeneratedColumn({ name: 'id_region' })
  idRegion: number;

  @Column({ name: 'id_client', type: 'int', nullable: true })
  idClient?: number | null;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name?: string | null;

  @Column({ name: 'code', type: 'varchar', length: 20, nullable: true })
  code?: string | null;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({ name: 'price', type: 'numeric', precision: 18, scale: 4, default: 0 })
  price: number;

  @Column({ name: 'price_online', type: 'numeric', precision: 18, scale: 4, default: 0, nullable: true })
  priceOnline?: number | null;

  @Column({ name: 'active', type: 'smallint', nullable: true, default: 1 })
  active?: number | null;

  @ManyToOne(() => CotClient, (c) => c.regiones)
  @JoinColumn({ name: 'id_client' })
  client?: CotClient;
}