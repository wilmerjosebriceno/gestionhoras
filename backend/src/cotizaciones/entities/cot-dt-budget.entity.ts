import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { Budget } from './budget.entity';
import { CotTemplate } from './cot-template.entity';
import { Region } from './region.entity';
import { CotTasaIva } from './cot-tasa-iva.entity';

@Entity({ name: 'cot_dt_budget' })
export class CotDtBudget {
  @Column({ name: 'id_budget', type: 'int', primary: true })
  idBudget: number;

  @Column({ name: 'id_template', type: 'int', primary: true })
  idTemplate: number;

  @Column({ name: 'secuencia', type: 'int', nullable: true })
  secuencia?: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'quantity', type: 'numeric', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ name: 'price', type: 'numeric', precision: 18, scale: 4, default: 0 })
  price: number;

  @Column({ name: 'subtotal', type: 'numeric', precision: 18, scale: 4, default: 0 })
  subtotal: number;

  @Column({ name: 'tax', type: 'numeric', precision: 18, scale: 4, default: 0 })
  tax: number;

  @Column({ name: 'amount_tax', type: 'numeric', precision: 18, scale: 4, nullable: true })
  amountTax?: number | null;

  @Column({ name: 'total', type: 'numeric', precision: 18, scale: 4, default: 0 })
  total: number;

  @Column({ name: 'id_region', type: 'int', nullable: true })
  idRegion?: number | null;

  @Column({ name: 'id_tasa_iva', type: 'int', nullable: true })
  idTasaIva?: number | null;

  @Column({ name: 'modalidad', type: 'varchar', length: 10, nullable: true })
  modalidad?: string | null;

  @ManyToOne(() => Budget, (b) => b.detalles)
  @JoinColumn({ name: 'id_budget' })
  budget?: Budget;

  @ManyToOne(() => CotTemplate)
  @JoinColumn({ name: 'id_template' })
  template?: CotTemplate;

  @ManyToOne(() => Region)
  @JoinColumn({ name: 'id_region' })
  region?: Region;

  @ManyToOne(() => CotTasaIva)
  @JoinColumn({ name: 'id_tasa_iva' })
  tasaIva?: CotTasaIva;
}