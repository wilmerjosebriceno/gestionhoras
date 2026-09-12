import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sgh_users' })
export class UsuarioSgh {
  @PrimaryGeneratedColumn({ name: 'id_user' })
  idUser: number;

  @Column({ name: 'id_category', type: 'int', nullable: true })
  idCategory?: number;

  @Column({ name: 'login', type: 'varchar', length: 50 })
  login: string;

  @Column({ name: 'name_user', type: 'varchar', length: 100 })
  nameUser: string;

  @Column({ name: 'email', type: 'varchar', length: 100 })
  email: string;

  @Column({ name: 'creation', type: 'date' })
  creation: Date;

  @Column({ name: 'active', type: 'smallint', default: 0 })
  active: number;

  @Column({ name: 'rol', type: 'varchar', length: 1, nullable: true })
  rol?: string;
}
