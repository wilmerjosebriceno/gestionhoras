import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'ticket_messages', schema: 'sigespweb' })
export class TicketMensaje {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'ticket_id', type: 'integer' })
  ticketId: number;

  @Column({ name: 'author_id', type: 'integer', nullable: true })
  authorId?: number | null;

  @Column({ name: 'author_name', type: 'varchar', nullable: true })
  authorName?: string | null;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}