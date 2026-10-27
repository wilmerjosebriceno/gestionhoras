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
import { CatalogosService } from './catalogos.service';
import { PdfReportsService } from './pdf-reports.service';
import { SoporteMailService } from '../soporte/soporte-mail.service';
import {
  CreateClienteDto,
  EnviarFormatoHabilitacionDto,
  UpdateClienteDto,
} from './dto/cliente.dto';

@ApiTags('SGH - Clientes')
@Controller('sgh/clientes')
export class ClientesController {
  constructor(
    private readonly catalogos: CatalogosService,
    private readonly pdf: PdfReportsService,
    private readonly mail: SoporteMailService,
  ) {}

  @Get()
  findAll(@Query('active') active?: string, @Query('filtro') filtro?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllClientes(act, filtro);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneCliente(id);
  }

  @Get(':id/proyectos')
  proyectosActivos(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.proyectosActivosDelCliente(id);
  }

  /** Formato (PDF) de habilitación de generación de tickets vía web para la institución. */
  @Get(':id/formato-habilitacion/pdf')
  async formatoHabilitacion(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const cliente = await this.catalogos.findOneCliente(id);
    const buf = await this.pdf.formatoHabilitacionCliente(cliente);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="formato-habilitacion-${cliente.rif ?? id}.pdf"`,
    );
    res.send(buf);
  }

  /** Envía por correo el formato de habilitación (PDF) a la institución o a calidad. */
  @Post(':id/formato-habilitacion/enviar-correo')
  async enviarFormatoHabilitacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnviarFormatoHabilitacionDto,
  ) {
    const cliente = await this.catalogos.findOneCliente(id);
    const destinatario =
      (dto.destinatario ?? '').trim() ||
      (cliente.email ?? '').trim() ||
      (process.env.SOPORTE_CALIDAD_EMAIL || '').trim() ||
      'calidad@sigesp.com.ve';

    const pdf = await this.pdf.formatoHabilitacionCliente(cliente);
    const nombre = `formato-habilitacion-${cliente.rif || id}.pdf`;
    const asunto = `Formato de habilitación de tickets vía web · ${cliente.name}`;
    const mensaje = (dto.mensaje ?? '').trim();

    const html =
      `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;font-size:14px;line-height:1.6;">` +
      `<p>Estimados representantes de <b>${this.esc(cliente.name)}</b>:</p>` +
      (mensaje ? `<p>${this.esc(mensaje)}</p>` : '') +
      `<p>Adjunto encontrarán el <b>Formato de Habilitación para la Generación de Tickets vía Página Web</b> correspondiente a su institución. Por favor complétenlo con los datos de contacto y devuélvanlo firmado y sellado.</p>` +
      `<p style="margin-top:16px;">Atentamente,<br/><b>Mesa de Ayuda SIGESP</b></p>` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;"/>` +
      `<p style="font-size:11px;color:#94a3b8;">SIGESP, C.A. · soporte@sigesp.com.ve</p>` +
      `</div>`;

    const envio = await this.mail.enviar({
      para: destinatario,
      asunto,
      html,
      texto: `Formato de habilitación de tickets vía web · ${cliente.name}`,
      adjuntos: [{ filename: nombre, content: pdf, contentType: 'application/pdf' }],
    });

    return {
      enviado: envio.enviado,
      simulado: envio.simulado,
      destinatario,
      asunto,
      adjunto: nombre,
    };
  }

  private esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.catalogos.createCliente(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClienteDto) {
    return this.catalogos.updateCliente(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeCliente(id);
  }
}
