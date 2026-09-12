import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proceso } from './entities/proceso.entity';
import { ItemActividad } from './entities/item-actividad.entity';
import { Categoria } from './entities/categoria.entity';
import { TipoActividad } from './entities/tipo-actividad.entity';
import { Cliente } from './entities/cliente.entity';
import { UsuarioSgh } from './entities/usuario-sgh.entity';
import { CreateProcesoDto, UpdateProcesoDto } from './dto/proceso.dto';
import { CreateItemActividadDto, UpdateItemActividadDto } from './dto/item-actividad.dto';
import { CreateCategoriaDto, UpdateCategoriaDto } from './dto/categoria.dto';
import { CreateTipoActividadDto, UpdateTipoActividadDto } from './dto/tipo-actividad.dto';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { CreateUsuarioSghDto, UpdateUsuarioSghDto } from './dto/usuario-sgh.dto';
import { DetalleActividad } from './entities/detalle-actividad.entity';
import { Actividad } from './entities/actividad.entity';
import { ProyectoActividad } from './entities/proyecto-actividad.entity';
import { Proyecto } from './entities/proyecto.entity';
import { EstructuraProyecto } from './entities/estructura-proyecto.entity';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(Proceso)
    private readonly procesoRepo: Repository<Proceso>,
    @InjectRepository(ItemActividad)
    private readonly itemRepo: Repository<ItemActividad>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(TipoActividad)
    private readonly tipoRepo: Repository<TipoActividad>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(UsuarioSgh)
    private readonly usuarioSghRepo: Repository<UsuarioSgh>,
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(DetalleActividad)
    private readonly detalleRepo: Repository<DetalleActividad>,
    @InjectRepository(EstructuraProyecto)
    private readonly estructuraRepo: Repository<EstructuraProyecto>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepo: Repository<Proyecto>,
    @InjectRepository(ProyectoActividad)
    private readonly proyectoActividadRepo: Repository<ProyectoActividad>,
  ) {}

  /* ==================== PROCESOS ==================== */
  async findAllProcesos(active?: number) {
    const where: Record<string, unknown> = {};
    if (active !== undefined) where.active = active;
    return this.procesoRepo.find({ where, order: { orden: 'ASC', nameProcess: 'ASC' } });
  }

  async findOneProceso(id: number) {
    const proceso = await this.procesoRepo.findOne({ where: { idProcess: id } });
    if (!proceso) throw new NotFoundException(`Proceso ${id} no encontrado`);
    return proceso;
  }

  async createProceso(dto: CreateProcesoDto) {
    const proceso = this.procesoRepo.create({
      nameProcess: dto.nameProcess.toUpperCase(),
      active: dto.active ?? 1,
      code: dto.code?.toUpperCase(),
      orden: dto.orden ?? 0,
    });
    return this.procesoRepo.save(proceso);
  }

  async updateProceso(id: number, dto: UpdateProcesoDto) {
    const proceso = await this.findOneProceso(id);
    if (dto.nameProcess !== undefined) proceso.nameProcess = dto.nameProcess.toUpperCase();
    if (dto.active !== undefined) proceso.active = dto.active;
    if (dto.code !== undefined) proceso.code = dto.code?.toUpperCase();
    if (dto.orden !== undefined) proceso.orden = dto.orden;
    return this.procesoRepo.save(proceso);
  }

  async removeProceso(id: number) {
    const proceso = await this.findOneProceso(id);
    const enUso = await this.detalleRepo.findOne({ where: { idProcess: id } });
    if (enUso) {
      throw new ConflictException('No se puede eliminar: el proceso tiene actividades relacionadas');
    }
    await this.procesoRepo.remove(proceso);
    return { message: 'Proceso eliminado' };
  }

  /* ==================== ITEMS DE ACTIVIDAD ==================== */
  async findAllItems(active?: number) {
    const where: Record<string, unknown> = {};
    if (active !== undefined) where.active = active;
    return this.itemRepo.find({ where, order: { orden: 'ASC' } });
  }

  async findOneItem(id: number) {
    const item = await this.itemRepo.findOne({ where: { idItemActivity: id } });
    if (!item) throw new NotFoundException(`Item de actividad ${id} no encontrado`);
    return item;
  }

  async createItem(dto: CreateItemActividadDto) {
    const item = this.itemRepo.create({
      code: dto.code?.toUpperCase(),
      name: dto.name.toUpperCase(),
      orden: dto.orden ?? 0,
      active: dto.active ?? 1,
    });
    return this.itemRepo.save(item);
  }

  async updateItem(id: number, dto: UpdateItemActividadDto) {
    const item = await this.findOneItem(id);
    if (dto.code !== undefined) item.code = dto.code?.toUpperCase();
    if (dto.name !== undefined) item.name = dto.name.toUpperCase();
    if (dto.orden !== undefined) item.orden = dto.orden;
    if (dto.active !== undefined) item.active = dto.active;
    return this.itemRepo.save(item);
  }

  async removeItem(id: number) {
    const item = await this.findOneItem(id);
    const enUso = await this.estructuraRepo.findOne({ where: { idItemActivity: id } });
    if (enUso) {
      throw new ConflictException('No se puede eliminar: el item está asignado a la estructura de proyecto');
    }
    await this.itemRepo.remove(item);
    return { message: 'Item eliminado' };
  }

  /* ==================== CATEGORÍAS ==================== */
  async findAllCategorias(active?: number) {
    const where: Record<string, unknown> = {};
    if (active !== undefined) where.active = active;
    return this.categoriaRepo.find({ where, order: { nameCategory: 'ASC' } });
  }

  async findOneCategoria(id: number) {
    const categoria = await this.categoriaRepo.findOne({ where: { idCategory: id } });
    if (!categoria) throw new NotFoundException(`Categoría ${id} no encontrada`);
    return categoria;
  }

  async createCategoria(dto: CreateCategoriaDto) {
    const categoria = this.categoriaRepo.create({
      nameCategory: dto.nameCategory.toUpperCase(),
      active: dto.active ?? 1,
    });
    return this.categoriaRepo.save(categoria);
  }

  async updateCategoria(id: number, dto: UpdateCategoriaDto) {
    const categoria = await this.findOneCategoria(id);
    if (dto.nameCategory !== undefined) categoria.nameCategory = dto.nameCategory.toUpperCase();
    if (dto.active !== undefined) categoria.active = dto.active;
    return this.categoriaRepo.save(categoria);
  }

  async removeCategoria(id: number) {
    const categoria = await this.findOneCategoria(id);
    await this.categoriaRepo.remove(categoria);
    return { message: 'Categoría eliminada' };
  }

  /* ==================== TIPOS DE ACTIVIDAD ==================== */
  async findAllTipos(active?: number) {
    const where: Record<string, unknown> = {};
    if (active !== undefined) where.active = active;
    return this.tipoRepo.find({ where, order: { nameType: 'ASC' } });
  }

  async findOneTipo(id: number) {
    const tipo = await this.tipoRepo.findOne({ where: { idType: id } });
    if (!tipo) throw new NotFoundException(`Tipo de actividad ${id} no encontrado`);
    return tipo;
  }

  async createTipo(dto: CreateTipoActividadDto) {
    const tipo = this.tipoRepo.create({
      nameType: dto.nameType.toUpperCase(),
      active: dto.active ?? 1,
    });
    return this.tipoRepo.save(tipo);
  }

  async updateTipo(id: number, dto: UpdateTipoActividadDto) {
    const tipo = await this.findOneTipo(id);
    if (dto.nameType !== undefined) tipo.nameType = dto.nameType.toUpperCase();
    if (dto.active !== undefined) tipo.active = dto.active;
    return this.tipoRepo.save(tipo);
  }

  async removeTipo(id: number) {
    const tipo = await this.findOneTipo(id);
    const enUso = await this.actividadRepo.findOne({ where: { idType: id } });
    if (enUso) {
      throw new ConflictException('No se puede eliminar: el tipo tiene actividades relacionadas');
    }
    await this.tipoRepo.remove(tipo);
    return { message: 'Tipo de actividad eliminado' };
  }

  /* ==================== CLIENTES ==================== */
  async findAllClientes(active?: number, filtro?: string) {
    const qb = this.clienteRepo.createQueryBuilder('c');
    if (active !== undefined) qb.where('c.active = :active', { active });
    if (filtro) {
      qb.andWhere('(c.name ILIKE :f OR c.rif ILIKE :f)', { f: `%${filtro}%` });
    }
    qb.orderBy('c.name', 'ASC');
    return qb.getMany();
  }

  async findOneCliente(id: number) {
    const cliente = await this.clienteRepo.findOne({ where: { idClient: id } });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async createCliente(dto: CreateClienteDto) {
    const cliente = this.clienteRepo.create({
      rif: dto.rif.toUpperCase(),
      name: dto.name.toUpperCase(),
      adress: dto.adress,
      email: dto.email,
      contacTel: dto.contacTel,
      contacName: dto.contacName?.toUpperCase(),
      creation: dto.creation ? new Date(dto.creation) : new Date(),
      active: dto.active ?? 1,
    });
    return this.clienteRepo.save(cliente);
  }

  async updateCliente(id: number, dto: UpdateClienteDto) {
    const cliente = await this.findOneCliente(id);
    if (dto.rif !== undefined) cliente.rif = dto.rif.toUpperCase();
    if (dto.name !== undefined) cliente.name = dto.name.toUpperCase();
    if (dto.adress !== undefined) cliente.adress = dto.adress;
    if (dto.email !== undefined) cliente.email = dto.email;
    if (dto.contacTel !== undefined) cliente.contacTel = dto.contacTel;
    if (dto.contacName !== undefined) cliente.contacName = dto.contacName?.toUpperCase();
    if (dto.active !== undefined) cliente.active = dto.active;
    return this.clienteRepo.save(cliente);
  }

  async removeCliente(id: number) {
    const cliente = await this.findOneCliente(id);
    const enUso = await this.actividadRepo.findOne({ where: { idClient: id } });
    if (enUso) {
      throw new ConflictException('No se puede eliminar: el cliente tiene actividades relacionadas');
    }
    await this.clienteRepo.remove(cliente);
    return { message: 'Cliente eliminado' };
  }

  /* ==================== USUARIOS SGH ==================== */
  async findAllUsuariosSgh(active?: number) {
    const where: Record<string, unknown> = {};
    if (active !== undefined) where.active = active;
    return this.usuarioSghRepo.find({ where, order: { nameUser: 'ASC' } });
  }

  async findOneUsuarioSgh(id: number) {
    const usuario = await this.usuarioSghRepo.findOne({ where: { idUser: id } });
    if (!usuario) throw new NotFoundException(`Usuario SGH ${id} no encontrado`);
    return usuario;
  }

  async createUsuarioSgh(dto: CreateUsuarioSghDto) {
    const existe = await this.usuarioSghRepo.findOne({ where: { login: dto.login } });
    if (existe) throw new ConflictException(`El login ${dto.login} ya existe`);
    const usuario = this.usuarioSghRepo.create({
      login: dto.login,
      nameUser: dto.nameUser.toUpperCase(),
      email: dto.email,
      idCategory: dto.idCategory,
      creation: dto.creation ? new Date(dto.creation) : new Date(),
      active: dto.active ?? 1,
      rol: dto.rol,
    });
    return this.usuarioSghRepo.save(usuario);
  }

  async updateUsuarioSgh(id: number, dto: UpdateUsuarioSghDto) {
    const usuario = await this.findOneUsuarioSgh(id);
    if (dto.login !== undefined) usuario.login = dto.login;
    if (dto.nameUser !== undefined) usuario.nameUser = dto.nameUser.toUpperCase();
    if (dto.email !== undefined) usuario.email = dto.email;
    if (dto.idCategory !== undefined) usuario.idCategory = dto.idCategory;
    if (dto.active !== undefined) usuario.active = dto.active;
    if (dto.rol !== undefined) usuario.rol = dto.rol;
    return this.usuarioSghRepo.save(usuario);
  }

  async removeUsuarioSgh(id: number) {
    const usuario = await this.findOneUsuarioSgh(id);
    const enUso = await this.actividadRepo.findOne({ where: { idUser: id } });
    if (enUso) {
      throw new ConflictException('No se puede eliminar: el usuario tiene actividades relacionadas');
    }
    await this.usuarioSghRepo.remove(usuario);
    return { message: 'Usuario SGH eliminado' };
  }

  /* ==================== PROYECTOS (catálogo de clientes para selects) ==================== */
  async proyectosActivosDelCliente(idClient: number) {
    return this.proyectoRepo
      .createQueryBuilder('p')
      .innerJoin('p.cliente', 'c')
      .select(['p.idProyect', 'p.numdoc', 'p.dateProyect', 'p.idClient'])
      .addSelect(['c.rif', 'c.name'])
      .where('p.status = 1 AND p.idClient = :idClient', { idClient })
      .orderBy('p.idProyect', 'DESC')
      .getMany();
  }
}
