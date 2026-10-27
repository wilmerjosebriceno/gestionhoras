import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'ticket_history', schema: 'sigespweb' })
export class TicketHistorial {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'ticket_id', type: 'integer' })
  ticketId: number;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId?: number | null;

  @Column({ name: 'user_name', type: 'varchar', nullable: true })
  userName?: string | null;

  @Column({ name: 'field', type: 'varchar' })
  field: string;

  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue?: string | null;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}