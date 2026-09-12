import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { QueryLogDto } from './dto/query-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequierePermiso } from '../common/decorators/requiere-permiso.decorator';

@ApiTags('Auditoría')
@Controller('auditoria')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get('logs')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_rep_auditoria_sistemas.html.php', permiso: 'seleccionar' })
  @ApiOperation({ summary: 'Listar logs', description: 'Obtiene el registro de auditoría paginado con filtros opcionales' })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs de auditoría' })
  findAll(@Query() query: QueryLogDto) {
    return this.auditoriaService.findAll(query);
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Listar eventos', description: 'Obtiene todos los eventos de auditoría disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de eventos' })
  getEventos() {
    return this.auditoriaService.getEventos();
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Resumen de auditoría', description: 'Obtiene un resumen estadístico de los logs de auditoría' })
  @ApiResponse({ status: 200, description: 'Resumen de auditoría' })
  getResumen() {
    return this.auditoriaService.getResumen();
  }
}
