import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne } from 'typeorm';
import { Budget } from './budget.entity';

@Entity({ name: 'cot_budget_history' })
export class CotBudgetHistory {
  @PrimaryGeneratedColumn({ name: 'id_history' })
  idHistory: number;

  @Column({ name: 'id_budget', type: 'int' })
  idBudget: number;

  @Column({ name: 'date_change', type: 'timestamp', nullable: true })
  dateChange?: string | null;

  @Column({ name: 'usuario', type: 'varchar', length: 50, nullable: true })
  usuario?: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string | null;

  @ManyToOne(() => Budget, (b) => b.historial)
  @JoinColumn({ name: 'id_budget' })
  budget?: Budget;
}