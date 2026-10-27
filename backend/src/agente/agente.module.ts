import { Module } from '@nestjs/common';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { SghModule } from '../sgh/sgh.module';
import { PermisosModule } from '../permisos/permisos.module';
import { LlmModule } from './llm.module';
import { MantisModule } from '../mantis/mantis.module';
import { AgenteController } from './agente.controller';
import { AgenteService } from './agente.service';
import { AgenteTools } from './agente.tools';

@Module({
  imports: [CotizacionesModule, SghModule, PermisosModule, LlmModule, MantisModule],
  controllers: [AgenteController],
  providers: [AgenteService, AgenteTools],
  exports: [AgenteService, AgenteTools, LlmModule],
})
export class AgenteModule {}
