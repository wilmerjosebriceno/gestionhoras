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
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ActividadesService } from './actividades.service';
import { PdfReportsService } from './pdf-reports.service';
import {
  CreateActividadDto,
  UpdateActividadDto,
  AnularActividadDto,
} from './dto/actividad.dto';

@ApiTags('SGH - Actividades')
@Controller('sgh/actividades')
export class ActividadesController {
  constructor(
    private readonly actividades: ActividadesService,
    private readonly pdf: PdfReportsService,
  ) {}

  @Get()
  getCatalogo(
    @Query('numdoc') numdoc?: string,
    @Query('fecini') fecini?: string,
    @Query('fecfin') fecfin?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const login = (req?.user as any)?.login;
    return this.actividades.getCatalogo(
      numdoc,
      fecini,
      fecfin,
      login,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('reporte')
  reporte(
    @Query('fecini') fecini?: string,
    @Query('fecfin') fecfin?: string,
    @Query('idType') idType?: string,
    @Query('idProcess') idProcess?: string,
    @Query('idUser') idUser?: string,
    @Query('idClient') idClient?: string,
    @Req() req?: any,
  ) {
    const login = (req?.user as any)?.login;
    return this.actividades.reporteActividades({
      fecini,
      fecfin,
      idType: idType ? Number(idType) : undefined,
      idProcess: idProcess ? Number(idProcess) : undefined,
      idUser: idUser ? Number(idUser) : undefined,
      idClient: idClient ? Number(idClient) : undefined,
    }, login);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.actividades.getDetailActivity(id);
  }

  @Get('reporte/pdf')
  async pdfReporte(
    @Query('fecini') fecini?: string,
    @Query('fecfin') fecfin?: string,
    @Query('idType') idType?: string,
    @Query('idProcess') idProcess?: string,
    @Query('idUser') idUser?: string,
    @Query('idClient') idClient?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    const login = (req?.user as any)?.login;
    const filas = await this.actividades.reporteActividades({
      fecini,
      fecfin,
      idType: idType ? Number(idType) : undefined,
      idProcess: idProcess ? Number(idProcess) : undefined,
      idUser: idUser ? Number(idUser) : undefined,
      idClient: idClient ? Number(idClient) : undefined,
    }, login);
    if (!res) return;
    const buf = await this.pdf.reporte(filas);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="reporte-actividades.pdf"');
    res.send(buf);
  }

  @Get(':id/pdf')
  async pdfActividad(@Param('id', ParseIntPipe) id: number, @Res() res?: Response) {
    const actividad = await this.actividades.getDetailActivity(id);
    if (!res) return;
    const buf = await this.pdf.actividad(actividad);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="actividad-${actividad.numdoc}.pdf"`);
    res.send(buf);
  }

  @Post(':id/recalcular')
  recalcular(@Param('id', ParseIntPipe) id: number) {
    return this.actividades.recalcularProyecto(id);
  }

  @Post()
  create(@Body() dto: CreateActividadDto) {
    return this.actividades.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActividadDto, @Req() req?: any) {
    const user = (req?.user as any) || {};
    return this.actividades.update(id, dto, user.login, user.adminUser === 1);
  }

  @Post(':id/anular')
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularActividadDto, @Req() req?: any) {
    const user = (req?.user as any) || {};
    return this.actividades.anular(id, dto, user.login, user.adminUser === 1);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const user = (req?.user as any) || {};
    return this.actividades.remove(id, user.login, user.adminUser === 1);
  }
}
