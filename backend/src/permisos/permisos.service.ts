import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';
import { AccesoUsuario } from './entities/acceso-usuario.entity';
import { AccesoGrupo } from './entities/acceso-grupo.entity';
import { Sistema } from './entities/sistema.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Grupo } from '../grupos/entities/grupo.entity';

export interface ArbolItem {
  nombre: string;
  pagina: string;
  hijos?: ArbolItem[];
}

@Injectable()
export class PermisosService {
  /**
   * Directorio donde viven los arboles XML de cada sistema.
   * Se resuelve de forma portable dentro del proyecto backend:
   *   backend/permisos/xml/sec_arbol_<sistema>.xml
   * (desde origen "src" y desde el build "dist").
   */
  private readonly xmlDir = this.resolverDirXml();

  private resolverDirXml(): string {
    const candidatos = [
      path.join(process.cwd(), 'permisos', 'xml'),
      path.join(__dirname, '..', '..', 'permisos', 'xml'),
      path.join(__dirname, 'permisos', 'xml'),
      'C:\\xampp7\\htdocs\\IA\\sec\\pages\\xml', // fallback legacy
    ];
    for (const dir of candidatos) {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
      } catch {
        /* continuar */
      }
    }
    return candidatos[0];
  }

  constructor(
    @InjectRepository(AccesoUsuario)
    private readonly accesoUsuarioRepository: Repository<AccesoUsuario>,
    @InjectRepository(AccesoGrupo)
    private readonly accesoGrupoRepository: Repository<AccesoGrupo>,
    @InjectRepository(Sistema)
    private readonly sistemaRepository: Repository<Sistema>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
  ) {}

  async verificarPermiso(
    login: string,
    sistema: string,
    pagina: string,
    permiso: string = 'acceso',
  ): Promise<boolean> {
    const usuario = await this.usuarioRepository.findOne({ where: { login } });
    if (!usuario) return false;
    if (usuario.adminUser === 1) return true;

    const permisoFields: Record<string, string> = {
      acceso: 'acceso', seleccionar: 'seleccionar', insertar: 'insertar',
      actualizar: 'actualizar', eliminar: 'eliminar', ejecutar: 'ejecutar',
      imprimir: 'imprimir', anular: 'anular',
    };
    const columna = permisoFields[permiso] || 'acceso';

    const acceso = await this.accesoUsuarioRepository.findOne({
      where: { idUser: usuario.idUser, sistemaCode: sistema, pagina },
    });
    if (acceso && (acceso as any)[columna] === 1) return true;

    if (usuario.idGrupo) {
      const grupoAcceso = await this.accesoGrupoRepository.findOne({
        where: { idGrupo: usuario.idGrupo, sistemaCode: sistema, pagina },
      });
      if (grupoAcceso && (grupoAcceso as any)[columna] === 1) return true;
    }
    return false;
  }

  async getArbol(sistema: string): Promise<ArbolItem[]> {
    const filePath = path.join(this.xmlDir, `sec_arbol_${sistema.toLowerCase()}.xml`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Archivo de arbol no encontrado para sistema ${sistema}`);
    }
    const xml = fs.readFileSync(filePath, 'utf8');
    const result = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false, mergeAttrs: true });
    const root = result?.sistema;
    if (!root) throw new Error('XML mal formado');
    return this.parseXmlMenus(root);
  }

  private parseXmlMenus(node: any): ArbolItem[] {
    const items: ArbolItem[] = [];
    const children = node.menu || node.item || [];
    const arr = Array.isArray(children) ? children : [children];
    for (const child of arr) {
      if (!child) continue;
      if (child.menu || child.item) {
        items.push({ nombre: child.nombre, pagina: '', hijos: this.parseXmlMenus(child) });
      } else {
        items.push({ nombre: child.nombre, pagina: child.pagina || '' });
      }
    }
    return items;
  }

  async getListarUsuarios() {
    return this.usuarioRepository.find({
      where: { estatus: 1 },
      order: { login: 'ASC' },
    });
  }

  async getListarGrupos() {
    return this.grupoRepository.find({
      order: { denominacion: 'ASC' },
    });
  }

  async getPermisosUsuario(login: string, sistema?: string) {
    const usuario = await this.usuarioRepository.findOne({ where: { login } });
    if (!usuario) throw new NotFoundException(`Usuario ${login} no encontrado`);
    const qb = this.accesoUsuarioRepository.createQueryBuilder('a');
    qb.where('a.id_user = :idUser', { idUser: usuario.idUser });
    if (sistema) qb.andWhere('a.sistema_code = :sistema', { sistema });
    return qb.getMany();
  }

  async getPermisosGrupo(grupo: string, sistema?: string) {
    const grupoEntity = await this.grupoRepository.findOne({ where: { grupo } });
    if (!grupoEntity) throw new NotFoundException(`Grupo ${grupo} no encontrado`);
    const qb = this.accesoGrupoRepository.createQueryBuilder('ag');
    qb.where('ag.id_grupo = :idGrupo', { idGrupo: grupoEntity.idGrupo });
    if (sistema) qb.andWhere('ag.sistema_code = :sistema', { sistema });
    return qb.getMany();
  }

  async guardarPermisos(dto: {
    tipo: 'U' | 'G';
    sistema: string;
    logins?: string[];
    grupos?: string[];
    permisos: Array<{
      pagina: string;
      denpagina?: string;
      acceso?: number;
      seleccionar?: number;
      insertar?: number;
      actualizar?: number;
      eliminar?: number;
      ejecutar?: number;
      imprimir?: number;
      anular?: number;
    }>;
  }) {
    const sist = await this.sistemaRepository.findOne({ where: { sistema: dto.sistema } });
    if (!sist) throw new NotFoundException(`Sistema ${dto.sistema} no encontrado`);

    if (dto.tipo === 'U') {
      for (const login of dto.logins || []) {
        const usuario = await this.usuarioRepository.findOne({ where: { login } });
        if (!usuario) continue;
        for (const item of dto.permisos) {
          const existe = await this.accesoUsuarioRepository.findOne({
            where: { idUser: usuario.idUser, pagina: item.pagina, sistemaCode: dto.sistema },
          });
          const data: any = {
            idUser: usuario.idUser,
            idSistema: sist.idSistema,
            sistemaCode: dto.sistema,
            pagina: item.pagina,
            denPagina: item.denpagina || null,
            acceso: item.acceso ?? 0,
            seleccionar: item.seleccionar ?? 0,
            insertar: item.insertar ?? 0,
            actualizar: item.actualizar ?? 0,
            eliminar: item.eliminar ?? 0,
            ejecutar: item.ejecutar ?? 0,
            imprimir: item.imprimir ?? 0,
            anular: item.anular ?? 0,
          };
          if (existe) {
            await this.accesoUsuarioRepository.update({ idAcceso: existe.idAcceso }, data);
          } else {
            await this.accesoUsuarioRepository.save(
              this.accesoUsuarioRepository.create({ idAcceso: uuid(), ...data }),
            );
          }
        }
      }
    } else {
      for (const grupo of dto.grupos || []) {
        const grupoEntity = await this.grupoRepository.findOne({ where: { grupo } });
        if (!grupoEntity) continue;
        for (const item of dto.permisos) {
          const existe = await this.accesoGrupoRepository.findOne({
            where: { idGrupo: grupoEntity.idGrupo, pagina: item.pagina, sistemaCode: dto.sistema },
          });
          const data: any = {
            idGrupo: grupoEntity.idGrupo,
            idSistema: sist.idSistema,
            sistemaCode: dto.sistema,
            pagina: item.pagina,
            denPagina: item.denpagina || null,
            acceso: item.acceso ?? 0,
            seleccionar: item.seleccionar ?? 0,
            insertar: item.insertar ?? 0,
            actualizar: item.actualizar ?? 0,
            eliminar: item.eliminar ?? 0,
            ejecutar: item.ejecutar ?? 0,
            imprimir: item.imprimir ?? 0,
            anular: item.anular ?? 0,
          };
          if (existe) {
            await this.accesoGrupoRepository.update({ idAccesoGrupo: existe.idAccesoGrupo }, data);
          } else {
            await this.accesoGrupoRepository.save(
              this.accesoGrupoRepository.create({ idAccesoGrupo: uuid(), ...data }),
            );
          }
        }
      }
    }
    return { message: 'Permisos guardados exitosamente' };
  }

  async getSistemas() {
    return this.sistemaRepository.find({ order: { denominacion: 'ASC' } });
  }
}
