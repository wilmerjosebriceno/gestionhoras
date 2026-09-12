import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { env } from '../../config/env.config';

export interface JwtPayload {
  sub: string;
  login: string;
  adminUser: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const usuario = await this.usuarioRepository.findOne({
      where: { login: payload.login, estatus: 1 },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      sub: usuario.idUser,
      login: payload.login,
      adminUser: payload.adminUser,
    };
  }
}
