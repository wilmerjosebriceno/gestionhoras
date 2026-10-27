import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'ticket_attachments', schema: 'sigespweb' })
export class TicketAdjunto {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'ticket_id', type: 'integer' })
  ticketId: number;

  @Column({ name: 'message_id', type: 'integer', nullable: true })
  messageId?: number | null;

  @Column({ name: 'filename', type: 'varchar' })
  filename: string;

  @Column({ name: 'stored_name', type: 'varchar' })
  storedName: string;

  @Column({ name: 'mimetype', type: 'varchar' })
  mimetype: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: true })
  uploadedBy?: number | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}