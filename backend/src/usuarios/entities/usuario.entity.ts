import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Grupo } from '../../grupos/entities/grupo.entity';
import { AccesoUsuario } from '../../permisos/entities/acceso-usuario.entity';

@Entity({ name: 'sec_user', schema: 'public' })
export class Usuario {
  @PrimaryColumn({ name: 'id_user', type: 'uuid' })
  idUser: string;

  @Column({ name: 'logins', type: 'varchar', length: 50 })
  login: string;

  @Column({ name: 'ceduser', type: 'varchar', length: 12, nullable: true })
  cedula?: string;

  @Column({ name: 'nomuser', type: 'varchar', length: 100 })
  nombres: string;

  @Column({ name: 'apeuser', type: 'varchar', length: 50, nullable: true })
  apellidos?: string;

  @Column({ name: 'teluser', type: 'varchar', length: 50 })
  telefono: string;

  @Column({ name: 'pwduser', type: 'varchar', length: 100 })
  password: string;

  @Column({ name: 'obsuser', type: 'varchar', length: 250 })
  observacion: string;

  @Column({ name: 'email', type: 'varchar', length: 100 })
  email: string;

  @Column({ name: 'adminuser', type: 'int' })
  adminUser: number;

  @Column({ name: 'estact', type: 'int' })
  estatus: number;

  @Column({ name: 'nodelete', type: 'int', default: 0 })
  nodelete: number;

  @Column({ name: 'nivelgeneral', type: 'int', default: 0 })
  nivelGeneral: number;

  @Column({ name: 'cargo', type: 'varchar', length: 100, nullable: true, default: ' ' })
  cargo?: string;

  @Column({ name: 'firma', type: 'varchar', length: 100, nullable: true })
  firma?: string;

  @Column({ name: 'bloqueado_hasta', type: 'timestamp', nullable: true })
  bloqueadoHasta?: Date | null;

  @Column({ name: 'intentos_fallidos', type: 'int', nullable: true, default: 0 })
  intentosFallidos?: number;

  @Column({ name: 'ultimo_login', type: 'timestamp', nullable: true })
  ultimoLogin?: Date;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true, default: () => 'NOW()' })
  createdAt?: Date;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true, default: () => 'NOW()' })
  updatedAt?: Date;

  @Column({ name: 'id_grupo', type: 'uuid', nullable: true })
  idGrupo?: string;

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'id_grupo' })
  grupo?: Grupo;

  @OneToMany(() => AccesoUsuario, (acceso) => acceso.usuario)
  accesos?: AccesoUsuario[];
}
