import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Usuario del panel de soporte (espejo en `sigespweb.usuarios`).
 *
 * Los tickets referencian a esta tabla mediante `assignee_id`, `author_id`
 * y `user_id`. Al gestionar desde gestionsigesp, el usuario autenticado de
 * `sec_user` se traduce a un registro aquí (mismo login).
 */
@Entity({ name: 'usuarios', schema: 'sigespweb' })
export class AgenteSoporte {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'username', type: 'varchar' })
  username: string;

  @Column({ name: 'password', type: 'varchar' })
  password: string;

  @Column({ name: 'email', type: 'varchar' })
  email: string;

  @Column({ name: 'rol', type: 'varchar', nullable: true })
  rol?: string | null;

  @Column({ name: 'creado_en', type: 'timestamp', nullable: true })
  creadoEn?: Date | null;
}