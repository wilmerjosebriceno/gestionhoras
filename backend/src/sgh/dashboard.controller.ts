import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('SGH - Dashboard')
@Controller('sgh/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('resumen')
  resumen() {
    return this.dashboard.resumenGeneral();
  }

  @Get('clientes-anual')
  clientesAnual() {
    return this.dashboard.getEstadisticasClienteAnual();
  }

  @Get('clientes-anio')
  clientesAnio() {
    return this.dashboard.getHourClientAnual();
  }

  @Get('usuarios-anio')
  usuariosAnio() {
    return this.dashboard.hourUserAnual();
  }

  @Get('usuarios-fiscal')
  usuariosFiscal() {
    return this.dashboard.hourUserFiscal();
  }

  @Get('proyectos')
  proyectos() {
    return this.dashboard.proyectsChart();
  }

  @Get('avance-fases/:idProyect')
  avanceFases(@Param('idProyect', ParseIntPipe) idProyect: number) {
    return this.dashboard.avanceFasesProyecto(idProyect);
  }
}
