import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { env } from '../../config/env.config';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      passReqToCallback: true,
      secretOrKey: env.jwt.refreshSecret,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    const refreshToken = req.headers.authorization?.replace('Bearer ', '');

    const usuario = await this.usuarioRepository.findOne({
      where: { login: payload.login, estatus: 1 },
    });

    if (!usuario || usuario.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return {
      sub: usuario.idUser,
      login: payload.login,
      adminUser: payload.adminUser,
    };
  }
}
