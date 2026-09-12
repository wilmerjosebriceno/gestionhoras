import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { QueryUsuarioDto } from './dto/query-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    const existe = await this.usuarioRepository.findOne({
      where: { login: dto.login },
    });

    if (existe) {
      throw new ConflictException(`El usuario ${dto.login} ya existe`);
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const usuario = new Usuario();
    usuario.idUser = uuid();
    usuario.login = dto.login.toUpperCase();
    usuario.password = hashedPassword;
    usuario.cedula = dto.cedula || '';
    usuario.nombres = dto.nombres?.toUpperCase() || dto.login.toUpperCase();
    usuario.apellidos = dto.apellidos?.toUpperCase() || '';
    usuario.telefono = dto.telefono || '';
    usuario.observacion = dto.observacion || '';
    usuario.email = dto.email || '';
    usuario.estatus = dto.estatus ?? 1;
    usuario.adminUser = 0;
    usuario.nodelete = 0;
    usuario.nivelGeneral = dto.nivelGeneral ?? 0;
    usuario.cargo = dto.cargo || ' ';
    usuario.firma = '';
    usuario.idGrupo = dto.idGrupo ?? undefined;
    usuario.intentosFallidos = 0;
    usuario.passwordChangedAt = new Date();

    return this.usuarioRepository.save(usuario);
  }

  async findAll(query: QueryUsuarioDto) {
    const where: Record<string, unknown> = {};

    if (query.login) where.login = Like(`%${query.login}%`);
    if (query.nombres) where.nombres = Like(`%${query.nombres}%`);
    if (query.apellidos) where.apellidos = Like(`%${query.apellidos}%`);
    if (query.email) where.email = Like(`%${query.email}%`);
    if (query.estatus !== undefined) where.estatus = query.estatus;

    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;

    const [usuarios, total] = await this.usuarioRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { login: 'ASC' },
      relations: ['grupo'],
    });

    return {
      data: usuarios.map((u) => ({
        idUser: u.idUser,
        login: u.login,
        cedula: u.cedula,
        nombres: u.nombres,
        apellidos: u.apellidos,
        telefono: u.telefono,
        email: u.email,
        estatus: u.estatus,
        adminUser: u.adminUser,
        nivelGeneral: u.nivelGeneral,
        cargo: u.cargo,
        firma: u.firma,
        idGrupo: u.idGrupo,
        grupo: u.grupo?.denominacion || null,
        ultimoLogin: u.ultimoLogin,
        bloqueadoHasta: u.bloqueadoHasta,
        intentosFallidos: u.intentosFallidos,
        createdAt: u.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(login: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { login },
      relations: ['grupo'],
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${login} no encontrado`);
    }

    return {
      idUser: usuario.idUser,
      login: usuario.login,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      telefono: usuario.telefono,
      email: usuario.email,
      observacion: usuario.observacion,
      estatus: usuario.estatus,
      adminUser: usuario.adminUser,
      nivelGeneral: usuario.nivelGeneral,
      cargo: usuario.cargo,
      firma: usuario.firma,
      idGrupo: usuario.idGrupo,
      grupo: usuario.grupo?.denominacion || null,
      ultimoLogin: usuario.ultimoLogin,
      bloqueadoHasta: usuario.bloqueadoHasta,
      intentosFallidos: usuario.intentosFallidos,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }

  async update(login: string, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { login },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${login} no encontrado`);
    }

    if (dto.cedula !== undefined) usuario.cedula = dto.cedula;
    if (dto.nombres !== undefined) usuario.nombres = dto.nombres?.toUpperCase();
    if (dto.apellidos !== undefined) usuario.apellidos = dto.apellidos?.toUpperCase();
    if (dto.telefono !== undefined) usuario.telefono = dto.telefono;
    if (dto.observacion !== undefined) usuario.observacion = dto.observacion;
    if (dto.email !== undefined) usuario.email = dto.email;
    if (dto.estatus !== undefined) usuario.estatus = dto.estatus;
    if (dto.nivelGeneral !== undefined) usuario.nivelGeneral = dto.nivelGeneral;
    if (dto.cargo !== undefined) usuario.cargo = dto.cargo;
    if (dto.idGrupo !== undefined) usuario.idGrupo = dto.idGrupo;

    return this.usuarioRepository.save(usuario);
  }

  async remove(login: string): Promise<void> {
    const usuario = await this.usuarioRepository.findOne({
      where: { login },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${login} no encontrado`);
    }

    if (usuario.nodelete === 1) {
      throw new ConflictException(`El usuario ${login} no puede ser eliminado`);
    }

    await this.usuarioRepository.remove(usuario);
  }

  async resetPassword(login: string): Promise<{ message: string }> {
    const usuario = await this.usuarioRepository.findOne({
      where: { login },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${login} no encontrado`);
    }

    const salt = await bcrypt.genSalt(12);
    usuario.password = await bcrypt.hash('123', salt);
    usuario.passwordChangedAt = null as any;
    usuario.refreshToken = '';
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;

    await this.usuarioRepository.save(usuario);

    return {
      message: `Contraseña del usuario ${login} reseteada a "123". Se le exigirá cambiarla en el próximo inicio de sesión`,
    };
  }

  async desbloquear(login: string): Promise<void> {
    const usuario = await this.usuarioRepository.findOne({
      where: { login },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${login} no encontrado`);
    }

    usuario.bloqueadoHasta = null as any;
    usuario.intentosFallidos = 0;
    await this.usuarioRepository.save(usuario);
  }

  /* ============ FIRMA DIGITALIZADA ============ */
  private readonly firmaDir = path.resolve(process.cwd(), 'storage', 'firmas');
  private readonly firmaMimes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
  };

  private firmaPath(login: string, ext?: string): string | null {
    const dir = this.firmaDir;
    if (!fs.existsSync(dir)) return null;
    const sufijo = ext?.toLowerCase() || '';
    const archivos = fs.readdirSync(dir).filter(
      (f) => f.toLowerCase().startsWith(`${login.toLowerCase()}.`) &&
        (!sufijo || f.toLowerCase().endsWith(sufijo)),
    );
    if (!archivos.length) return null;
    return path.join(dir, archivos[0]);
  }

  private leerFirmaDataUri(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mime = this.firmaMimes[ext] ?? 'image/png';
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  }

  /** Sube/reemplaza la firma digitalizada del usuario (jpg/jpeg/png/gif). */
  async subirFirma(login: string, file: any): Promise<{ firma: string; dataUri: string }> {
    const usuario = await this.usuarioRepository.findOne({ where: { login } });
    if (!usuario) throw new NotFoundException(`Usuario ${login} no encontrado`);
    if (!file) throw new BadRequestException('Debe seleccionar un archivo de imagen');

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!this.firmaMimes[ext]) {
      throw new BadRequestException('Solo se permiten imágenes .jpg, .jpeg, .png o .gif');
    }

    if (!fs.existsSync(this.firmaDir)) fs.mkdirSync(this.firmaDir, { recursive: true });

    // eliminar firma previa del mismo usuario (cualquier extensión)
    const previo = this.firmaPath(login);
    if (previo) {
      try { fs.unlinkSync(previo); } catch { /* ignore */ }
    }

    const filename = `${login}${ext}`;
    const destino = path.join(this.firmaDir, filename);
    fs.writeFileSync(destino, file.buffer);

    usuario.firma = filename;
    await this.usuarioRepository.save(usuario);

    return { firma: filename, dataUri: this.leerFirmaDataUri(destino) };
  }

  /** Devuelve la firma del usuario como dataUri para previsualización. */
  async getFirma(login: string): Promise<{ firma: string; dataUri: string }> {
    const usuario = await this.usuarioRepository.findOne({ where: { login } });
    if (!usuario) throw new NotFoundException(`Usuario ${login} no encontrado`);
    const p = this.firmaPath(login);
    if (!p) return { firma: '', dataUri: '' };
    return { firma: path.basename(p), dataUri: this.leerFirmaDataUri(p) };
  }

  /** Elimina la firma del usuario y reinicia el campo (opcional). */
  async eliminarFirma(login: string): Promise<{ firma: string }> {
    const usuario = await this.usuarioRepository.findOne({ where: { login } });
    if (!usuario) throw new NotFoundException(`Usuario ${login} no encontrado`);
    const p = this.firmaPath(login);
    if (p) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
    usuario.firma = '';
    await this.usuarioRepository.save(usuario);
    return { firma: '' };
  }

  /**
   * Backfill: sincroniza el campo `sec_user.firma` a partir de las imágenes
   * existentes en `storage/firmas/<login>.<ext>`. Útil cuando las firmas fueron
   * migradas/copiadas al servidor sin dejar actualizada la columna (caso en el
   * que el PDF antiguo no encontraba la firma). Es idempotente.
   */
  async sincronizarFirmas(): Promise<{
    revisados: number;
    actualizados: number;
    sinUsuario: number;
    detalles: Array<{ archivo: string; login: string; estado: string }>;
  }> {
    const dir = this.firmaDir;
    if (!fs.existsSync(dir)) {
      return { revisados: 0, actualizados: 0, sinUsuario: 0, detalles: [] };
    }
    const archivos = fs.readdirSync(dir).filter((f) => !!this.firmaMimes[path.extname(f).toLowerCase()]);
    let actualizados = 0;
    let sinUsuario = 0;
    const detalles: Array<{ archivo: string; login: string; estado: string }> = [];
    for (const archivo of archivos) {
      const login = path.basename(archivo, path.extname(archivo));
      // Coincidencia exacta o insensible a mayúsculas (logins mixtos)
      const usuario =
        (await this.usuarioRepository.findOne({ where: { login } })) ||
        (await this.usuarioRepository.findOne({ where: { login: ILike(login) } }));
      if (!usuario) {
        sinUsuario++;
        detalles.push({ archivo, login, estado: 'sin usuario' });
        continue;
      }
      if (usuario.firma !== archivo) {
        usuario.firma = archivo;
        await this.usuarioRepository.save(usuario);
        actualizados++;
        detalles.push({ archivo, login: usuario.login, estado: 'actualizado' });
      } else {
        detalles.push({ archivo, login: usuario.login, estado: 'sin cambios' });
      }
    }
    return { revisados: archivos.length, actualizados, sinUsuario, detalles };
  }
}
