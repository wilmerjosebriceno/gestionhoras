import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { CotizacionesService } from './cotizaciones.service';
import { PdfCotizacionService } from './pdf-cotizacion.service';
import { MailService } from './mail.service';
import { CreateBudgetDto } from './dto/budget.dto';
import { CreateCotClientDto, CreateRegionDto, CreateCotTemplateDto, CreateEmpresaDto, CreateTasaIvaDto, CreateRangoUsuarioDto, CreateTarifaDto } from './dto/master.dto';

@ApiTags('Cotizaciones')
@Controller('cotizaciones')
@ApiBearerAuth('access-token')
export class CotizacionesController {
  constructor(
    private readonly service: CotizacionesService,
    private readonly pdf: PdfCotizacionService,
    private readonly mail: MailService,
  ) {}

  /* ---- Clientes ---- */
  @Get('clientes')
  @ApiOperation({ summary: 'Listar clientes de cotización' })
  clientes(@Query('q') q?: string) {
    return this.service.listarClientes(q);
  }

  @Post('clientes/sincronizar')
  @ApiOperation({ summary: 'Sincronizar clientes formales (sgh_client) a cot_client' })
  sincronizar() {
    return this.service.sincronizarClientes();
  }
  @Post('clientes')
  @ApiOperation({ summary: 'Crear cliente' })
  crearCliente(@Body() dto: CreateCotClientDto) {
    return this.service.crearCliente(dto);
  }
  @Get('clientes/:id')
  @ApiOperation({ summary: 'Detalle cliente' })
  getCliente(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCliente(id);
  }
  @Put('clientes/:id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  actualizarCliente(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCotClientDto) {
    return this.service.actualizarCliente(id, dto);
  }
  @Delete('clientes/:id')
  @ApiOperation({ summary: 'Eliminar cliente' })
  eliminarCliente(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarCliente(id);
  }

  /* ---- Regiones ---- */
  @Get('regiones')
  @ApiOperation({ summary: 'Listar regiones' })
  regiones(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.service.listarRegiones(incluirInactivos === 'true');
  }
  @Post('regiones')
  @ApiOperation({ summary: 'Crear región' })
  crearRegion(@Body() dto: CreateRegionDto) {
    return this.service.crearRegion(dto);
  }
  @Put('regiones/:id')
  @ApiOperation({ summary: 'Actualizar región' })
  actualizarRegion(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateRegionDto) {
    return this.service.actualizarRegion(id, dto);
  }
  @Delete('regiones/:id')
  @ApiOperation({ summary: 'Eliminar región' })
  eliminarRegion(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarRegion(id);
  }

  /* ---- Plantillas ---- */
  @Get('plantillas')
  @ApiOperation({ summary: 'Listar plantillas' })
  plantillas() {
    return this.service.listarPlantillas();
  }
  @Post('plantillas')
  @ApiOperation({ summary: 'Crear plantilla' })
  crearPlantilla(@Body() dto: CreateCotTemplateDto) {
    return this.service.crearPlantilla(dto);
  }
  @Put('plantillas/:id')
  @ApiOperation({ summary: 'Actualizar plantilla' })
  actualizarPlantilla(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCotTemplateDto) {
    return this.service.actualizarPlantilla(id, dto);
  }
  @Delete('plantillas/:id')
  @ApiOperation({ summary: 'Eliminar plantilla' })
  eliminarPlantilla(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarPlantilla(id);
  }

  /* ---- Empresas ---- */
  @Get('empresas')
  @ApiOperation({ summary: 'Listar empresas' })
  empresas() {
    return this.service.listarEmpresas();
  }
  @Post('empresas')
  @ApiOperation({ summary: 'Crear empresa' })
  crearEmpresa(@Body() dto: CreateEmpresaDto) {
    return this.service.crearEmpresa(dto);
  }
  @Put('empresas/:id')
  @ApiOperation({ summary: 'Actualizar empresa' })
  actualizarEmpresa(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateEmpresaDto) {
    return this.service.actualizarEmpresa(id, dto);
  }
  @Delete('empresas/:id')
  @ApiOperation({ summary: 'Eliminar empresa' })
  eliminarEmpresa(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarEmpresa(id);
  }

  /* ---- Tasas de IVA (parámetros) ---- */
  @Get('tasas-iva')
  @ApiOperation({ summary: 'Listar tasas de IVA (catálogo parametrizable)' })
  tasas(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.service.listarTasas(incluirInactivos === 'true' || incluirInactivos === '1');
  }
  @Put('tasas-iva/:id')
  @ApiOperation({ summary: 'Actualizar tasa de IVA' })
  actualizarTasa(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTasaIvaDto) {
    return this.service.actualizarTasa(id, dto);
  }

  /* ---- Rangos de usuarios ---- */
  @Get('rangos')
  @ApiOperation({ summary: 'Listar rangos de usuarios (desde/hasta)' })
  rangos() {
    return this.service.listarRangos();
  }
  @Post('rangos')
  @ApiOperation({ summary: 'Crear rango de usuarios' })
  crearRango(@Body() dto: CreateRangoUsuarioDto) {
    return this.service.crearRango(dto);
  }
  @Put('rangos/:id')
  @ApiOperation({ summary: 'Actualizar rango de usuarios' })
  actualizarRango(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateRangoUsuarioDto) {
    return this.service.actualizarRango(id, dto);
  }
  @Delete('rangos/:id')
  @ApiOperation({ summary: 'Eliminar rango de usuarios' })
  eliminarRango(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarRango(id);
  }

  /* ---- Tarifas (región + rango + modalidad) ---- */
  @Get('tarifas')
  @ApiOperation({ summary: 'Listar tarifas' })
  tarifas(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.service.listarTarifas(incluirInactivos === 'true' || incluirInactivos === '1');
  }
  @Post('tarifas')
  @ApiOperation({ summary: 'Crear tarifa' })
  crearTarifa(@Body() dto: CreateTarifaDto) {
    return this.service.crearTarifa(dto);
  }
  @Put('tarifas/:id')
  @ApiOperation({ summary: 'Actualizar tarifa' })
  actualizarTarifa(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTarifaDto) {
    return this.service.actualizarTarifa(id, dto);
  }
  @Delete('tarifas/:id')
  @ApiOperation({ summary: 'Eliminar tarifa' })
  eliminarTarifa(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarTarifa(id);
  }

  /* ---- Consultas de la tarifa (núcleo del requerimiento) ---- */
  @Get('rango')
  @ApiOperation({ summary: 'Rango que corresponde a un número de usuarios' })
  rangoPorNroUser(@Query('nroUser', ParseIntPipe) nroUser: number) {
    return this.service.resolverRango(nroUser);
  }
  @Get('tarifa')
  @ApiOperation({ summary: 'Tarifa según región + nro de usuarios + modalidad' })
  tarifa(
    @Query('idRegion', ParseIntPipe) idRegion: number,
    @Query('nroUser', ParseIntPipe) nroUser: number,
    @Query('modalidad') modalidad: string,
  ) {
    return this.service.obtenerTarifa(idRegion, nroUser, modalidad);
  }

  /* ---- Cotizaciones (budget) ---- */
  @Get()
  @ApiOperation({ summary: 'Listar cotizaciones (paginado, con búsqueda y filtros)' })
  listar(
    @Query('status') status?: string,
    @Query('idClient') idClient?: string,
    @Query('q') q?: string,
    @Query('de') de?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listarBudgets({
      status: status !== undefined ? Number(status) : undefined,
      idClient: idClient ? Number(idClient) : undefined,
      q,
      de,
      hasta,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
  @Get('kpis')
  @ApiOperation({ summary: 'KPIs del dashboard de cotizaciones' })
  kpis(
    @Query('de') de?: string,
    @Query('hasta') hasta?: string,
    @Query('idEmpresa') idEmpresa?: string,
    @Query('idClient') idClient?: string,
  ) {
    return this.service.obtenerKpis({
      de,
      hasta,
      idEmpresa: idEmpresa ? Number(idEmpresa) : undefined,
      idClient: idClient ? Number(idClient) : undefined,
    });
  }
  @Get('vencidas')
  @ApiOperation({ summary: 'Cotizaciones vencidas y por vencer (alerta)' })
  vencidas(@Query('diasAlerta') diasAlerta?: string, @Query('diasPorVencer') diasPorVencer?: string) {
    return this.service.listarVencidas(
      diasAlerta ? Number(diasAlerta) : 15,
      diasPorVencer ? Number(diasPorVencer) : 5,
    );
  }
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de cotización' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.getBudget(id);
  }
  @Post()
  @ApiOperation({ summary: 'Crear cotización' })
  crear(@Body() dto: CreateBudgetDto, @Req() req?: any) {
    const login = (req?.user as any)?.login;
    return this.service.crearBudget(dto, login);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cotización' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateBudgetDto, @Req() req?: any) {
    const login = (req?.user as any)?.login;
    return this.service.actualizarBudget(id, dto, login);
  }
  @Post(':id/calcular')
  @ApiOperation({ summary: 'Recalcular totales' })
  recalcular(@Param('id', ParseIntPipe) id: number) {
    return this.service.recalcular(id);
  }
  @Post(':id/duplicar')
  @ApiOperation({ summary: 'Duplicar cotización como una nueva (BORRADOR)' })
  duplicar(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const login = (req?.user as any)?.login;
    return this.service.duplicarBudget(id, login);
  }
  @Post(':id/estado/:status')
  @ApiOperation({ summary: 'Cambiar estado' })
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Param('status', ParseIntPipe) status: number, @Req() req?: any) {
    const login = (req?.user as any)?.login;
    return this.service.cambiarEstado(id, status, login);
  }
  @Post(':id/historial')
  @ApiOperation({ summary: 'Registrar nota en historial' })
  historial(@Param('id', ParseIntPipe) id: number, @Body() body: { nota: string }, @Req() req?: any) {
    const login = (req?.user as any)?.login;
    return this.service.registrarHistorial(id, body.nota, login);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar PDF de la cotización (elegante)' })
  async generarPdf(@Param('id', ParseIntPipe) id: number, @Res() res?: Response) {
    const buf = await this.pdf.generarPdf(id);
    if (!res) return;
    const cot = await this.service.getBudget(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cotizacion-${cot.codeBudget}.pdf"`);
    res.send(buf);
  }

  @Post(':id/enviar')
  @ApiOperation({ summary: 'Enviar cotización por correo (PDF adjunto)' })
  async enviar(@Param('id', ParseIntPipe) id: number) {
    const cot = await this.service.getBudget(id);
    const email = cot.client?.contactEmail;
    if (!email) {
      throw new Error('El cliente no tiene un correo electrónico configurado');
    }
    const buf = await this.pdf.generarPdf(id);
    const asunto = `Cotización ${cot.codeBudget} - ${cot.client?.nameClient || ''}`;
    const texto = `Estimados señores,\n\nAdjuntamos la cotización ${cot.codeBudget}.\n\nSaludos cordiales.`;
    await this.mail.enviarCotizacion(email, asunto, texto, buf, `cotizacion-${cot.codeBudget}.pdf`);
    await this.service.registrarHistorial(id, `Cotización enviada por correo a ${email}`, (cot as any).usuario);
    return { enviado: true, email };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lógicamente cotización (estado ELIMINADA)' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const login = (req?.user as any)?.login;
    return this.service.eliminarBudget(id, login);
  }
}