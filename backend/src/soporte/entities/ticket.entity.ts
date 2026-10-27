import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'tickets', schema: 'sigespweb' })
export class Ticket {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'number', type: 'varchar' })
  number: string;

  @Column({ name: 'type', type: 'varchar' })
  type: string;

  @Column({ name: 'state', type: 'varchar' })
  state: string;

  @Column({ name: 'title', type: 'varchar' })
  title: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'category_id', type: 'integer', nullable: true })
  categoryId?: number | null;

  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId?: number | null;

  @Column({ name: 'service', type: 'varchar', nullable: true })
  service?: string | null;

  @Column({ name: 'requester_id', type: 'integer', nullable: true })
  requesterId?: number | null;

  @Column({ name: 'requester_name', type: 'varchar' })
  requesterName: string;

  @Column({ name: 'requester_email', type: 'varchar', nullable: true })
  requesterEmail?: string | null;

  @Column({ name: 'requester_phone', type: 'varchar', nullable: true })
  requesterPhone?: string | null;

  @Column({ name: 'id_client', type: 'integer', nullable: true })
  idClient?: number | null;

  @Column({ name: 'client_name', type: 'varchar', nullable: true })
  clientName?: string | null;

  @Column({ name: 'client_rif', type: 'varchar', nullable: true })
  clientRif?: string | null;

  /** Id de la incidencia creada en MantisBT (NULL si no se ha enviado). */
  @Column({ name: 'mantis_issue_id', type: 'integer', nullable: true })
  mantisIssueId?: number | null;

  @Column({ name: 'affected_user', type: 'varchar', nullable: true })
  affectedUser?: string | null;

  @Column({ name: 'assignee_id', type: 'integer', nullable: true })
  assigneeId?: number | null;

  @Column({ name: 'impact', type: 'varchar' })
  impact: string;

  @Column({ name: 'urgency', type: 'varchar' })
  urgency: string;

  @Column({ name: 'priority', type: 'varchar' })
  priority: string;

  @Column({ name: 'priority_overridden', type: 'boolean', default: false })
  priorityOverridden: boolean;

  @Column({ name: 'channel', type: 'varchar' })
  channel: string;

  @Column({ name: 'sla_policy_id', type: 'integer', nullable: true })
  slaPolicyId?: number | null;

  @Column({ name: 'response_due_at', type: 'timestamptz', nullable: true })
  responseDueAt?: Date | null;

  @Column({ name: 'resolution_due_at', type: 'timestamptz', nullable: true })
  resolutionDueAt?: Date | null;

  @Column({ name: 'first_response_at', type: 'timestamptz', nullable: true })
  firstResponseAt?: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date | null;

  @Column({ name: 'sla_response_breached', type: 'boolean', default: false })
  slaResponseBreached: boolean;

  @Column({ name: 'sla_resolution_breached', type: 'boolean', default: false })
  slaResolutionBreached: boolean;

  @Column({ name: 'reopen_count', type: 'smallint', default: 0 })
  reopenCount: number;

  @Column({ name: 'hold_reason', type: 'varchar', nullable: true })
  holdReason?: string | null;

  @Column({ name: 'resolution_code', type: 'varchar', nullable: true })
  resolutionCode?: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string | null;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause?: string | null;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId?: number | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}