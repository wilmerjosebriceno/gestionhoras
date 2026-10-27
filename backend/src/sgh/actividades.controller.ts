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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ActividadesService } from './actividades.service';
import { ActivityAttachmentsService } from './activity-attachments.service';
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
    private readonly adjuntos: ActivityAttachmentsService,
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
    @Query('online') online?: string,
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
      online: online !== undefined && online !== '' ? Number(online) : undefined,
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
    @Query('online') online?: string,
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
      online: online !== undefined && online !== '' ? Number(online) : undefined,
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

  /* ==================== Documentos adjuntos ==================== */

  /** Lista los adjuntos vigentes de la actividad. */
  @Get(':id/attachments')
  listarAdjuntos(@Param('id', ParseIntPipe) id: number) {
    return this.adjuntos.listar(id);
  }

  /** Sube uno o varios archivos (PDF/JPG/PNG, campo `archivos`). */
  @Post(':id/attachments')
  @UseInterceptors(
    FilesInterceptor('archivos', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  adjuntar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Req() req?: any,
  ) {
    const login = (req?.user as any)?.login;
    return this.adjuntos.agregar(id, archivos ?? [], login);
  }

  /** Descarga un adjunto con sesión. */
  @Get(':id/attachments/:adjuntoId')
  async descargarAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Param('adjuntoId', ParseIntPipe) adjuntoId: number,
    @Res() res: Response,
  ) {
    const adjunto = await this.adjuntos.rutaDescarga(id, adjuntoId);
    res.download(adjunto.ruta, adjunto.nombre);
  }

  /** Elimina un adjunto (baja lógica + borrado físico). */
  @Delete(':id/attachments/:adjuntoId')
  eliminarAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Param('adjuntoId', ParseIntPipe) adjuntoId: number,
  ) {
    return this.adjuntos.eliminar(id, adjuntoId);
  }
}
