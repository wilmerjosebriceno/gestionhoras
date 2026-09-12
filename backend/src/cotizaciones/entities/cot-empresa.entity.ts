import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Correlativo } from './cot-correlativo.entity';

@Entity({ name: 'cot_empresa' })
export class CotEmpresa {
  @PrimaryGeneratedColumn({ name: 'id_empresa' })
  idEmpresa: number;

  @Column({ name: 'company', type: 'varchar', length: 100, nullable: true })
  company?: string | null;

  @Column({ name: 'telephone', type: 'varchar', length: 50, nullable: true })
  telephone?: string | null;

  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true })
  email?: string | null;

  @Column({ name: 'web', type: 'varchar', length: 100, nullable: true })
  web?: string | null;

  @Column({ name: 'logo', type: 'varchar', length: 100, nullable: true })
  logo?: string | null;

  @Column({ name: 'prefix', type: 'varchar', length: 6, nullable: true })
  prefix?: string | null;

  @OneToMany(() => Correlativo, (c) => c.empresa)
  correlativos?: Correlativo[];
}