import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Region } from './region.entity';
import { Budget } from './budget.entity';

@Entity({ name: 'cot_client' })
export class CotClient {
  @PrimaryGeneratedColumn({ name: 'id_client' })
  idClient: number;

  @Column({ name: 'id_sgh_client', type: 'int', nullable: true })
  idSghClient?: number | null;

  @Column({ name: 'rif', type: 'varchar', length: 50, nullable: true })
  rif?: string | null;

  @Column({ name: 'name_client', type: 'varchar', length: 300, nullable: true })
  nameClient?: string | null;

  @Column({ name: 'adress_client', type: 'varchar', length: 500, nullable: true })
  adressClient?: string | null;

  @Column({ name: 'active', type: 'smallint', default: 1 })
  active: number;

  @Column({ name: 'contact_name', type: 'varchar', length: 250, nullable: true })
  contactName?: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 100, nullable: true })
  contactPhone?: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 100, nullable: true })
  contactEmail?: string | null;

  @OneToMany(() => Region, (r) => r.client)
  regiones?: Region[];

  @OneToMany(() => Budget, (b) => b.client)
  presupuestos?: Budget[];
}