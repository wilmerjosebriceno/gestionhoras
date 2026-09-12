import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sistema } from './sistema.entity';

@Entity({ name: 'sec_acceso_grupo', schema: 'public' })
export class AccesoGrupo {
  @PrimaryColumn({ name: 'id_acceso_grupo', type: 'uuid' })
  idAccesoGrupo: string;

  @Column({ name: 'id_grupo', type: 'uuid' })
  idGrupo: string;

  @ManyToOne(() => Sistema)
  @JoinColumn({ name: 'id_sistema' })
  sistema: Sistema;

  @Column({ name: 'id_sistema', type: 'uuid', nullable: true })
  idSistema: string;

  @Column({ name: 'sistema_code', type: 'varchar', length: 4, nullable: true })
  sistemaCode?: string;

  @Column({ name: 'id_user', type: 'uuid', nullable: true })
  idUser: string;

  @Column({ name: 'pagina', type: 'varchar', length: 100, nullable: true })
  pagina?: string;

  @Column({ name: 'eaccess', type: 'int', nullable: true })
  acceso: number;

  @Column({ name: 'einsert', type: 'int', default: 0 })
  insertar: number;

  @Column({ name: 'edelete', type: 'int', default: 0 })
  eliminar: number;

  @Column({ name: 'eupdate', type: 'int', nullable: true })
  actualizar: number;

  @Column({ name: 'eselect', type: 'int', default: 0 })
  seleccionar: number;

  @Column({ name: 'erun', type: 'int', default: 0 })
  ejecutar: number;

  @Column({ name: 'eprint', type: 'int', nullable: true })
  imprimir: number;

  @Column({ name: 'eannul', type: 'int', default: 0 })
  anular: number;

  @Column({ name: 'denpagina', type: 'varchar', length: 100, nullable: true })
  denPagina: string;
}
