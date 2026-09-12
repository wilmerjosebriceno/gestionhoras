import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SistemasController } from './sistemas.controller';
import { SistemasService } from './sistemas.service';
import { Sistema } from '../permisos/entities/sistema.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sistema])],
  controllers: [SistemasController],
  providers: [SistemasService],
  exports: [SistemasService],
})
export class SistemasModule {}
