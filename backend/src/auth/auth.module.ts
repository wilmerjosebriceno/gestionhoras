import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Evento } from '../auditoria/entities/evento.entity';
import { Log } from '../auditoria/entities/log.entity';
import { AccesoUsuario } from '../permisos/entities/acceso-usuario.entity';
import { AccesoGrupo } from '../permisos/entities/acceso-grupo.entity';
import { env } from '../config/env.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Evento, Log, AccesoUsuario, AccesoGrupo]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: env.jwt.secret,
      signOptions: { expiresIn: env.jwt.expiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
