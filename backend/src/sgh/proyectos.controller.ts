import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ProyectosService } from './proyectos.service';
import { PdfReportsService } from './pdf-reports.service';
import {
  CreateProyectoDto,
  UpdateProyectoDto,
  AnularProyectoDto,
} from './dto/proyecto.dto';

@ApiTags('SGH - Proyectos')
@Controller('sgh/proyectos')
export class ProyectosController {
  constructor(
    private readonly proyectos: ProyectosService,
    private readonly pdf: PdfReportsService,
  ) {}

  @Get()
  getCatalogo(
    @Query('numdoc') numdoc?: string,
    @Query('fecini') fecini?: string,
    @Query('fecfin') fecfin?: string,
  ) {
    return this.proyectos.getCatalogo(numdoc, fecini, fecfin);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.proyectos.findOne(id);
  }

  @Get(':id/detalle')
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.proyectos.getDetailProyect(id, soloActivos === '1' || soloActivos === 'true');
  }

  @Get(':id/pdf')
  async pdfProyecto(@Param('id', ParseIntPipe) id: number, @Res() res?: Response) {
    const [proyecto, filas] = await Promise.all([
      this.proyectos.findOne(id),
      this.proyectos.getDetailProyect(id, true),
    ]);
    if (!res) return;
    const buf = await this.pdf.proyecto(proyecto, filas);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="proyecto-${proyecto.numdoc ?? id}.pdf"`);
    res.send(buf);
  }

  @Get(':id/actividades')
  getActividades(@Param('id', ParseIntPipe) id: number) {
    return this.proyectos.getActivityByProyect(id);
  }

  @Get(':id/cronograma/generar')
  async generarCronograma(@Param('id', ParseIntPipe) id: number) {
    const proyecto = await this.proyectos.findOne(id);
    await this.proyectos.generarCronograma(id, proyecto.dateIni, proyecto.dateFin);
    return { message: 'Cronograma generado/actualizado' };
  }

  @Post()
  create(@Body() dto: CreateProyectoDto) {
    return this.proyectos.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProyectoDto) {
    return this.proyectos.update(id, dto);
  }

  @Post(':id/anular')
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularProyectoDto) {
    return this.proyectos.anular(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proyectos.remove(id);
  }
}
