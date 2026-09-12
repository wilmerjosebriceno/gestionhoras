import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CotClient } from './cot-client.entity';
import { CotDtBudget } from './cot-dt-budget.entity';
import { CotBudgetHistory } from './cot-budget-history.entity';

@Entity({ name: 'cot_budget' })
export class Budget {
  @PrimaryGeneratedColumn({ name: 'id_budget' })
  idBudget: number;

  @Column({ name: 'code_budget', type: 'varchar', length: 30, nullable: true, unique: true })
  codeBudget?: string | null;

  @Column({ name: 'date_budget', type: 'date', nullable: true })
  dateBudget?: string | null;

  @Column({ name: 'vencimiento', type: 'date', nullable: true })
  vencimiento?: string | null;

  @Column({ name: 'hour_budget', type: 'time', nullable: true })
  hourBudget?: string | null;

  @Column({ name: 'usuario', type: 'varchar', length: 50, nullable: true })
  usuario?: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'soporte', type: 'text', nullable: true })
  soporte?: string | null;

  @Column({ name: 'modalidad', type: 'text', nullable: true })
  modalidad?: string | null;

  @Column({ name: 'id_client', type: 'int', nullable: true })
  idClient?: number | null;

  @Column({ name: 'id_empresa', type: 'int', nullable: true })
  idEmpresa?: number | null;

  @Column({ name: 'status', type: 'smallint', nullable: true, default: 0 })
  status?: number | null;

  @Column({ name: 'email_sent', type: 'smallint', nullable: true, default: 0 })
  emailSent?: number | null;

  @Column({ name: 'total_usd', type: 'numeric', precision: 18, scale: 4, default: 0 })
  totalUsd: number;

  @Column({ name: 'iva_usd', type: 'numeric', precision: 18, scale: 4, default: 0 })
  ivaUsd: number;

  @Column({ name: 'montosubtotal', type: 'numeric', precision: 18, scale: 4, nullable: true })
  montoSubtotal?: number | null;

  @Column({ name: 'montoexento', type: 'numeric', precision: 18, scale: 4, nullable: true })
  montoExento?: number | null;

  @Column({ name: 'montobaseimponible', type: 'numeric', precision: 18, scale: 4, nullable: true })
  montoBaseImponible?: number | null;

  @Column({ name: 'montoiva', type: 'numeric', precision: 18, scale: 4, nullable: true })
  montoIva?: number | null;

  @Column({ name: 'montototal', type: 'numeric', precision: 18, scale: 4, nullable: true })
  montoTotal?: number | null;

  @Column({ name: 'tasa_bcv', type: 'numeric', precision: 18, scale: 6, default: 0 })
  tasaBcv: number;

  @ManyToOne(() => CotClient, (c) => c.presupuestos)
  @JoinColumn({ name: 'id_client' })
  client?: CotClient;

  @OneToMany(() => CotDtBudget, (dt) => dt.budget)
  detalles?: CotDtBudget[];

  @OneToMany(() => CotBudgetHistory, (h) => h.budget)
  historial?: CotBudgetHistory[];
}