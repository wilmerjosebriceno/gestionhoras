import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { PdfCotizacionService } from './pdf-cotizacion.service';
import { MailService } from './mail.service';
import { CotClient } from './entities/cot-client.entity';
import { Region } from './entities/region.entity';
import { CotTemplate } from './entities/cot-template.entity';
import { Budget } from './entities/budget.entity';
import { CotDtBudget } from './entities/cot-dt-budget.entity';
import { CotBudgetHistory } from './entities/cot-budget-history.entity';
import { Correlativo } from './entities/cot-correlativo.entity';
import { CotEmpresa } from './entities/cot-empresa.entity';
import { CotTasaIva } from './entities/cot-tasa-iva.entity';
import { CotRangoUsuario } from './entities/cot-rango-usuario.entity';
import { CotTarifa } from './entities/cot-tarifa.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CotClient, Region, CotTemplate, Budget, CotDtBudget, CotBudgetHistory, Correlativo, CotEmpresa, CotTasaIva, CotRangoUsuario, CotTarifa, Usuario]),
  ],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, PdfCotizacionService, MailService],
  exports: [CotizacionesService, PdfCotizacionService, MailService],
})
export class CotizacionesModule {}