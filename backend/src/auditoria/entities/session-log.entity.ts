import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sec_session_logs', schema: 'public' })
export class SessionLog {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 150 })
  sessionId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 50 })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text' })
  userAgent: string;

  @Column({ name: 'additional_info', type: 'text' })
  additionalInfo: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
