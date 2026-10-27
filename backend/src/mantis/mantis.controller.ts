import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequierePermiso } from '../common/decorators/requiere-permiso.decorator';
import { MantisService } from './mantis.service';
import { MantisConsultaDto } from './dto/mantis.dto';

@ApiTags('SGH - Reportes Mantis')
@Controller('sgh/mantis')
@UseGuards(JwtAuthGuard)
export class MantisController {
  constructor(private readonly service: MantisService) {}

  @Get('filtros')
  filtros() {
    return this.service.filtros();
  }

  @Post('consultar')
  @RequierePermiso({ sistema: 'SGH', pagina: 'mantis_reportes', permiso: 'seleccionar' })
  consultar(@Body() dto: MantisConsultaDto) {
    return this.service.consultar(dto);
  }

  @Post('resumen')
  @RequierePermiso({ sistema: 'SGH', pagina: 'mantis_reportes', permiso: 'seleccionar' })
  resumen(@Body() dto: MantisConsultaDto) {
    return this.service.resumen(dto);
  }

  @Post('analizar')
  @RequierePermiso({ sistema: 'SGH', pagina: 'mantis_reportes', permiso: 'seleccionar' })
  analizar(@Body() dto: MantisConsultaDto) {
    return this.service.analizar(dto);
  }
}
