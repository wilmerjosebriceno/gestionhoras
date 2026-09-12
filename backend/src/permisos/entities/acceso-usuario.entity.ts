import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Sistema } from './sistema.entity';

@Entity({ name: 'sec_acceso_user', schema: 'public' })
export class AccesoUsuario {
  @PrimaryColumn({ name: 'id_acceso', type: 'uuid' })
  idAcceso: string;

  @Column({ name: 'id_user', type: 'uuid', nullable: true })
  idUser?: string;

  @Column({ name: 'id_sistema', type: 'uuid', nullable: true })
  idSistema?: string;

  @Column({ name: 'sistema_code', type: 'varchar', length: 4, nullable: true })
  sistemaCode?: string;

  @Column({ name: 'pagina', type: 'varchar', length: 100 })
  pagina: string;

  @Column({ name: 'denpagina', type: 'varchar', length: 100, nullable: true })
  denPagina?: string;

  @Column({ name: 'eaccess', type: 'int', nullable: true })
  acceso?: number;

  @Column({ name: 'eselect', type: 'int', default: 0 })
  seleccionar: number;

  @Column({ name: 'einsert', type: 'int', default: 0 })
  insertar: number;

  @Column({ name: 'eupdate', type: 'int', nullable: true })
  actualizar?: number;

  @Column({ name: 'edelete', type: 'int', default: 0 })
  eliminar: number;

  @Column({ name: 'erun', type: 'int', default: 0 })
  ejecutar: number;

  @Column({ name: 'eprint', type: 'int', nullable: true })
  imprimir?: number;

  @Column({ name: 'eannul', type: 'int', default: 0 })
  anular: number;

  @ManyToOne(() => Usuario, (usuario) => usuario.accesos)
  @JoinColumn({ name: 'id_user' })
  usuario?: Usuario;

  @ManyToOne(() => Sistema)
  @JoinColumn({ name: 'id_sistema' })
  sistema?: Sistema;
}
