import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';
import { Grupo } from './entities/grupo.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Grupo, Usuario])],
  controllers: [GruposController],
  providers: [GruposService],
  exports: [GruposService],
})
export class GruposModule {}
