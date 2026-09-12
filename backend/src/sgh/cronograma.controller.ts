import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CronogramaService } from './cronograma.service';
import {
  UpdateFaseDto,
  RegistrarSeguimientoDto,
  CrearHitoDto,
} from './dto/cronograma.dto';

@ApiTags('SGH - Cronograma')
@Controller('sgh/cronograma')
export class CronogramaController {
  constructor(private readonly cronograma: CronogramaService) {}

  @Get('proyecto/:idProyect')
  getProyecto(@Param('idProyect', ParseIntPipe) idProyect: number) {
    return this.cronograma.getProyecto(idProyect);
  }

  @Get('proyecto/:idProyect/fases')
  getFases(@Param('idProyect', ParseIntPipe) idProyect: number) {
    return this.cronograma.getFases(idProyect);
  }

  @Get('proyecto/:idProyect/hitos')
  getHitos(@Param('idProyect', ParseIntPipe) idProyect: number) {
    return this.cronograma.getHitos(idProyect);
  }

  @Post('hitos')
  createHito(@Body() dto: CrearHitoDto) {
    return this.cronograma.createHito(dto);
  }

  @Put('hitos/:idHito')
  updateHito(@Param('idHito', ParseIntPipe) idHito: number, @Body() dto: Partial<CrearHitoDto>) {
    return this.cronograma.updateHito(idHito, dto);
  }

  @Delete('hitos/:idHito')
  removeHito(@Param('idHito', ParseIntPipe) idHito: number) {
    return this.cronograma.removeHito(idHito);
  }

  @Put('fases/:idCron')
  updateFase(@Param('idCron', ParseIntPipe) idCron: number, @Body() dto: UpdateFaseDto) {
    return this.cronograma.updateFase(idCron, dto);
  }

  @Get('fases/:idCron/seguimiento')
  getSeguimiento(@Param('idCron', ParseIntPipe) idCron: number) {
    return this.cronograma.getSeguimiento(idCron);
  }

  @Post('seguimiento')
  registrarSeguimiento(@Body() dto: RegistrarSeguimientoDto) {
    return this.cronograma.registrarSeguimiento(dto);
  }

  @Delete('proyecto/:idProyect')
  eliminar(@Param('idProyect', ParseIntPipe) idProyect: number) {
    return this.cronograma.eliminarCronograma(idProyect);
  }
}
