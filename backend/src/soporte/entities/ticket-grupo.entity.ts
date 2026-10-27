import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'ticket_groups', schema: 'sigespweb' })
export class TicketGrupo {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar' })
  nombre: string;

  @Column({ name: 'nivel', type: 'smallint' })
  nivel: number;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;
}