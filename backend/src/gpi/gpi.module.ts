import { Module } from '@nestjs/common';
import { GpiController } from './gpi.controller';
import { GpiService } from './gpi.service';
import { GpiSchemaService } from './gpi-schema.service';

/**
 * Modulo GPI - Gestion de Proyectos Internos.
 * Independiente de SGH. Su esquema (`gpi`) y su sistema de Seguridad se
 * aseguran al arrancar mediante GpiSchemaService.
 */
@Module({
  controllers: [GpiController],
  providers: [GpiService, GpiSchemaService],
})
export class GpiModule {}
