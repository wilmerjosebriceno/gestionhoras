import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { Log } from './entities/log.entity';
import { Evento } from './entities/evento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Log, Evento])],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
