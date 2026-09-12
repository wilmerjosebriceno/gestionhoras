import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Evento } from '../auditoria/entities/evento.entity';
import { Log } from '../auditoria/entities/log.entity';
import { AccesoUsuario } from '../permisos/entities/acceso-usuario.entity';
import { AccesoGrupo } from '../permisos/entities/acceso-grupo.entity';
import { Grupo } from '../grupos/entities/grupo.entity';
import { env } from '../config/env.config';
import { LoginDto } from './dto/login.dto';
import { CambioPasswordDto } from './dto/cambio-password.dto';

@Injectable()
export class AuthService {
  private readonly MAX_INTENTOS = 5;
  private readonly BLOQUEO_MINUTOS = 15;

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    @InjectRepository(AccesoUsuario)
    private readonly accesoUsuarioRepository: Repository<AccesoUsuario>,
    @InjectRepository(AccesoGrupo)
    private readonly accesoGrupoRepository: Repository<AccesoGrupo>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent?: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { login: dto.login },
    });

    if (!usuario) {
      await this.registrarLogAuditoria(null, 'CRITICO',
        `FALLO EN INICIO DE SESION [${dto.login}], USUARIO NO EXISTE`, ip, userAgent);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estatus !== 1) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    if (usuario.bloqueadoHasta && new Date() < usuario.bloqueadoHasta) {
      throw new ForbiddenException(
        `Cuenta bloqueada hasta ${new Date(usuario.bloqueadoHasta).toLocaleString()}`,
      );
    }

    const passwordValido = await bcrypt.compare(
      dto.password,
      usuario.password || '',
    );

    if (!passwordValido) {
      usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;

      if (usuario.intentosFallidos >= this.MAX_INTENTOS) {
        usuario.bloqueadoHasta = new Date(
          Date.now() + this.BLOQUEO_MINUTOS * 60 * 1000,
        ) as any;
      }

      await this.usuarioRepository.save(usuario);

      await this.registrarLogAuditoria(usuario.idUser, 'CRITICO',
        `FALLO EN INICIO DE SESION [${dto.login}], INTENTO ${usuario.intentosFallidos}`,
        ip, userAgent);

      throw new UnauthorizedException('Credenciales inválidas');
    }

    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null as any;
    usuario.ultimoLogin = new Date();

    const mustChangePassword = await bcrypt.compare('123', usuario.password || '');

    const tokens = await this.generarTokens(usuario);
    usuario.refreshToken = tokens.refreshToken;

    await this.usuarioRepository.save(usuario);

    await this.registrarLogAuditoria(usuario.idUser, 'INSERT',
      `INICIO DE SESION [${dto.login}]`, ip, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mustChangePassword,
      usuario: {
        idUser: usuario.idUser,
        login: usuario.login,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        adminUser: usuario.adminUser,
      },
    };
  }

  async refreshTokens(login: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { login, estatus: 1 },
    });

    if (!usuario || !usuario.refreshToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokens = await this.generarTokens(usuario);
    usuario.refreshToken = tokens.refreshToken;
    await this.usuarioRepository.save(usuario);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async misPermisos(login: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { login },
    });
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    // Administrador: acceso total (no aplica filtros)
    if (usuario.adminUser === 1) return { admin: true, permisos: [] };

    const accesosUsuario = await this.accesoUsuarioRepository.find({
      where: { idUser: usuario.idUser },
    });

    let accesosGrupo: AccesoGrupo[] = [];
    if (usuario.idGrupo) {
      accesosGrupo = await this.accesoGrupoRepository.find({
        where: { idGrupo: usuario.idGrupo },
      });
    }

    return {
      admin: false,
      permisos: [...accesosUsuario, ...accesosGrupo].map((a) => ({
        sistema: a.sistemaCode,
        pagina: a.pagina,
        acceso: a.acceso === 1,
      })),
    };
  }

  async logout(login: string) {
    await this.usuarioRepository.update(
      { login },
      { refreshToken: '' as any },
    );
    return { message: 'Sesión cerrada exitosamente' };
  }

  async cambiarPassword(login: string, dto: CambioPasswordDto) {
    if (dto.passwordNuevo !== dto.passwordConfirmacion) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { login },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const passwordValido = await bcrypt.compare(
      dto.passwordActual,
      usuario.password || '',
    );

    if (!passwordValido) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const salt = await bcrypt.genSalt(12);
    usuario.password = await bcrypt.hash(dto.passwordNuevo, salt);
    usuario.passwordChangedAt = new Date();
    usuario.refreshToken = '';

    await this.usuarioRepository.save(usuario);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  private async generarTokens(usuario: Usuario) {
    const payload = {
      sub: usuario.idUser,
      login: usuario.login,
      adminUser: usuario.adminUser,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: env.jwt.secret,
        expiresIn: env.jwt.expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: env.jwt.refreshSecret,
        expiresIn: env.jwt.refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async registrarLogAuditoria(
    _idUser: string | null,
    eventoNombre: string,
    nota: string,
    tcpip: string,
    userAgent?: string,
  ) {
    try {
      const evento = await this.eventoRepository.findOne({
        where: { evento: eventoNombre },
      });

      const log = this.logRepository.create({
        id: uuid(),
        idEvento: evento?.idEvento ?? undefined,
        fecha: new Date(),
        hora: new Date().toLocaleTimeString('es-VE', { hour12: false }),
        nota,
        tcpip,
        userAgent: userAgent ?? undefined,
        estblk: 0,
      });

      await this.logRepository.save(log);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Auth] Error al registrar log:', (error as Error).message);
      }
    }
  }
}
