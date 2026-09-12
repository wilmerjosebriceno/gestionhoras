import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';
import { AccesoUsuario } from './entities/acceso-usuario.entity';
import { AccesoGrupo } from './entities/acceso-grupo.entity';
import { Sistema } from './entities/sistema.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Grupo } from '../grupos/entities/grupo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccesoUsuario, AccesoGrupo, Sistema, Usuario, Grupo])],
  controllers: [PermisosController],
  providers: [PermisosService],
  exports: [PermisosService],
})
export class PermisosModule {}
