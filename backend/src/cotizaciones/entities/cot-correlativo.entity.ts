import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { CotEmpresa } from './cot-empresa.entity';

@Entity({ name: 'cot_correlativo' })
export class Correlativo {
  @Column({ name: 'anio', type: 'int', primary: true })
  anio: number;

  @Column({ name: 'id_empresa', type: 'int', primary: true })
  idEmpresa: number;

  @Column({ name: 'current', type: 'int', default: 0 })
  current: number;

  @ManyToOne(() => CotEmpresa, (e) => e.correlativos)
  @JoinColumn({ name: 'id_empresa' })
  empresa?: CotEmpresa;
}