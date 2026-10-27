import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { env } from './config/env.config';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { GruposModule } from './grupos/grupos.module';
import { PermisosModule } from './permisos/permisos.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { SistemasModule } from './sistemas/sistemas.module';
import { SghModule } from './sgh/sgh.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { AgenteModule } from './agente/agente.module';
import { AyudaModule } from './ayuda/ayuda.module';
import { MantisModule } from './mantis/mantis.module';
import { SoporteModule } from './soporte/soporte.module';
import { GpiModule } from './gpi/gpi.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RequiereAdminGuard } from './common/guards/requiere-admin.guard';
import { PermisosGuard } from './common/guards/permisos.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ThrottlerModule.forRoot([
      {
        ttl: env.throttle.ttl,
        limit: env.throttle.limit,
      },
    ]),
    AuthModule,
    UsuariosModule,
    GruposModule,
    PermisosModule,
    AuditoriaModule,
    SistemasModule,
    SghModule,
    CotizacionesModule,
    AgenteModule,
    AyudaModule,
    MantisModule,
    SoporteModule,
    GpiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermisosGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RequiereAdminGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
