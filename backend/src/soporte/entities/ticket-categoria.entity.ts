import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'ticket_categories', schema: 'sigespweb' })
export class TicketCategoria {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar' })
  nombre: string;

  /** Código corto del módulo (p. ej. SCG, SPG). Opcional. */
  @Column({ name: 'codigo', type: 'varchar', nullable: true })
  codigo?: string | null;

  @Column({ name: 'padre_id', type: 'integer', nullable: true })
  padreId?: number | null;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;
}