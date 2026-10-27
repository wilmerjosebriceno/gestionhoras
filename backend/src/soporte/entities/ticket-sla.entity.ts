import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'ticket_sla_policies', schema: 'sigespweb' })
export class TicketPoliticaSla {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar' })
  nombre: string;

  @Column({ name: 'prioridad', type: 'varchar' })
  prioridad: string;

  @Column({ name: 'minutos_respuesta', type: 'integer' })
  minutosRespuesta: number;

  @Column({ name: 'minutos_resolucion', type: 'integer' })
  minutosResolucion: number;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;
}