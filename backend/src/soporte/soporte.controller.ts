import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequierePermiso } from '../common/decorators/requiere-permiso.decorator';
import { SoporteService, UsuarioGestor } from './soporte.service';
import { AlertasService } from './alertas.service';
import { MantisDashboardService } from './mantis-dashboard.service';
import { MantisSyncService } from './mantis-sync.service';
import { MantisReporteService } from './mantis-reporte.service';
import {
  AssignTicketDto,
  CerrarDesdeMantisDto,
  ChangeStateDto,
  CreateMessageDto,
  CreateTicketDto,
  DashboardMantisDto,
  EnviarCorreoIncidenciaDto,
  EnviarMantisDto,
  EnviarSeguimientoDto,
  NotificarCierreDto,
  OverridePriorityDto,
  QueryTicketsDto,
  UpdateTicketDto,
} from './dto/soporte.dto';

const gestorDe = (req: Request): UsuarioGestor => {
  const u = (req as any).user ?? {};
  return {
    sub: String(u.sub ?? ''),
    login: String(u.login ?? ''),
    adminUser: Number(u.adminUser ?? 0),
  };
};

@ApiTags('Soporte - Incidencias')
@Controller('soporte')
export class SoporteController {
  constructor(
    private readonly soporte: SoporteService,
    private readonly mantisDashboard: MantisDashboardService,
    private readonly mantisSync: MantisSyncService,
    private readonly mantisReporte: MantisReporteService,
    private readonly alertas: AlertasService,
  ) {}

  /** Catálogos precargados (categorías, grupos, agentes, políticas SLA) */
  @Get('catalogs')
  catalogo() {
    return this.soporte.catalogo();
  }

  /** Indicadores del tablero de incidencias */
  @Get('stats')
  estadisticas() {
    return this.soporte.estadisticas();
  }

  /* ==================== Alertas de casos sin atender ==================== */

  /** Casos sin atender por mas de N horas laborables (para la pantalla). */
  @Get('alertas/sin-atender')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  alertasSinAtender() {
    return this.alertas.sinAtender();
  }

  /** Contador de casos sin atender (badge). */
  @Get('alertas/resumen')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  alertasResumen() {
    return this.alertas.resumen();
  }

  /** Historial de alertas generadas. */
  @Get('alertas')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  alertasHistorial(@Query('limite') limite?: string) {
    return this.alertas.historial(limite ? Number(limite) : undefined);
  }

  /** Estado/diagnostico de la alerta. */
  @Get('alertas/estado')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  alertasEstado() {
    return this.alertas.estado();
  }

  /** Reinicia el control del resumen diario (pruebas). */
  @Post('alertas/reset')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  resetAlertas() {
    return this.alertas.resetearResumenDiario();
  }

  /** Disparar manualmente el envio del resumen por correo. */
  @Post('alertas/enviar')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  enviarAlerta() {
    return this.alertas.enviarAlerta(true);
  }

  /** Listado / bandeja de tickets con filtros y paginación */
  @Get('tickets')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  listar(@Query() dto: QueryTicketsDto, @Req() req: Request) {
    return this.soporte.listar(dto, gestorDe(req));
  }

  /** Detalle completo de un ticket (mensajes, adjuntos, historial) */
  @Get('tickets/:id')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  obtener(@Param('id') id: string) {
    return this.soporte.obtener(Number(id));
  }

  /** Estado y comentarios actuales del caso en Mantis (botón «Sincronizar») */
  @Get('tickets/:id/mantis/estado')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  estadoMantis(@Param('id') id: string) {
    return this.soporte.estadoMantis(Number(id));
  }

  /** Enviar la carta formal de cierre al cliente por correo */
  @Post('tickets/:id/notificar')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  notificar(@Param('id') id: string, @Body() dto: NotificarCierreDto, @Req() req: Request) {
    return this.soporte.enviarCartaCierre(Number(id), dto, gestorDe(req));
  }

  /** Cerrar el ticket porque el caso está cerrado en Mantis y notificar al cliente */
  @Post('tickets/:id/cerrar-desde-mantis')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  cerrarDesdeMantis(
    @Param('id') id: string,
    @Body() dto: CerrarDesdeMantisDto,
    @Req() req: Request,
  ) {
    return this.soporte.cerrarDesdeMantis(Number(id), dto, gestorDe(req));
  }

  /** Enviar la incidencia (con sus documentos adjuntos) por correo a calidad */
  @Post('tickets/:id/enviar-correo')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  enviarCorreo(
    @Param('id') id: string,
    @Body() dto: EnviarCorreoIncidenciaDto,
    @Req() req: Request,
  ) {
    return this.soporte.enviarIncidenciaCorreo(Number(id), dto, gestorDe(req));
  }

  /** Usuarios de Mantis con acceso a un proyecto (para elegir el responsable) */
  @Get('mantis/proyecto/:proyectoId/usuarios')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  usuariosMantis(@Param('proyectoId') proyectoId: string) {
    return this.soporte.usuariosMantisProyecto(Number(proyectoId));
  }

  /* ==================== Dashboard de Mantis (espejo local) ==================== */

  /** KPIs: por proyecto, por estatus, abiertos por usuario y tiempos entre estados */
  @Get('mantis/dashboard')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  dashboardMantis(@Query() dto: DashboardMantisDto) {
    return this.mantisDashboard.dashboard({
      desde: dto.desde,
      hasta: dto.hasta,
      projectId: dto.projectId,
      handlerId: dto.handlerId,
      reporterId: dto.reporterId,
      statusId: dto.statusId,
      excluirStatusIds: dto.excluirStatusIds,
      soloAbiertos: dto.soloAbiertos,
      reopened: dto.reopened,
      estancadosDias: dto.estancadosDias,
    });
  }

  /** Exporta a CSV (Excel): los casos (`tipo=casos`) o el resumen de KPIs (`tipo=resumen`) */
  @Get('mantis/export')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  async exportarCasosMantis(@Query() dto: DashboardMantisDto, @Res() res: Response) {
    const filtros = {
      desde: dto.desde,
      hasta: dto.hasta,
      projectId: dto.projectId,
      handlerId: dto.handlerId,
      reporterId: dto.reporterId,
      statusId: dto.statusId,
      excluirStatusIds: dto.excluirStatusIds,
      soloAbiertos: dto.soloAbiertos,
      reopened: dto.reopened,
    };
    const { nombre, contenido } =
      dto.tipo === 'resumen'
        ? await this.mantisDashboard.exportarResumen(filtros)
        : await this.mantisDashboard.exportarCasos(filtros);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(contenido);
  }

  /** Reporte PDF elegante de casos + comentarios (parametrizado por proyecto y rango). */
  @Get('mantis/reporte/pdf')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  async reportePdfMantis(@Query() dto: DashboardMantisDto, @Res() res: Response) {
    const { nombre, buffer } = await this.mantisReporte.generarPdf({
      desde: dto.desde,
      hasta: dto.hasta,
      projectId: dto.projectId,
      handlerId: dto.handlerId,
      reporterId: dto.reporterId,
      statusId: dto.statusId,
      excluirStatusIds: dto.excluirStatusIds,
      soloAbiertos: dto.soloAbiertos,
      reopened: dto.reopened,
      incluirNotas: dto.conDetalle === true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.send(buffer);
  }

  /** Envía por correo el reporte PDF (destinatario opcional; si falta usa MANTIS_ALERTAS_EMAIL). */
  @Post('mantis/reporte/pdf/enviar')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  enviarReportePdfMantis(@Body() dto: DashboardMantisDto) {
    return this.mantisReporte.enviarPdf({
      desde: dto.desde,
      hasta: dto.hasta,
      projectId: dto.projectId,
      handlerId: dto.handlerId,
      reporterId: dto.reporterId,
      statusId: dto.statusId,
      excluirStatusIds: dto.excluirStatusIds,
      soloAbiertos: dto.soloAbiertos,
      reopened: dto.reopened,
      incluirNotas: dto.conDetalle === true,
      destinatario: dto.destinatario,
    });
  }

  /** Listado paginado de casos del espejo (reporte por usuario/proyecto/estado/rango). */
  @Get('mantis/casos')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  listarCasosMantis(@Query() dto: DashboardMantisDto) {
    return this.mantisDashboard.listarCasos({
      desde: dto.desde,
      hasta: dto.hasta,
      projectId: dto.projectId,
      handlerId: dto.handlerId,
      reporterId: dto.reporterId,
      statusId: dto.statusId,
      excluirStatusIds: dto.excluirStatusIds,
      soloAbiertos: dto.soloAbiertos,
      reopened: dto.reopened,
      limit: dto.limit,
      offset: dto.offset,
    });
  }

  /** Recorrido paso a paso de un caso (timeline de estados) consultado en vivo a Mantis. */
  @Get('mantis/issue/:id')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  seguimientoMantis(@Param('id') id: string) {
    return this.soporte.seguimientoCaso(Number(id));
  }

  /** Envía por correo la alerta de casos estancados */
  @Post('mantis/alertas/estancados')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'actualizar' })
  alertaEstancados(@Body() dto: DashboardMantisDto) {
    return this.mantisDashboard.alertaEstancados({
      desde: dto.desde,
      hasta: dto.hasta,
      projectId: dto.projectId,
      handlerId: dto.handlerId,
      estancadosDias: dto.estancadosDias,
      destinatario: dto.destinatario,
    });
  }

  /** Estado del espejo local (última sincronización, casos, en curso) */
  @Get('mantis/sincronizar/estado')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'seleccionar' })
  estadoSyncMantis() {
    return this.mantisSync.estado();
  }

  /** Lanza la sincronización del espejo con Mantis (segundo plano) */
  @Post('mantis/sincronizar')
  @RequierePermiso({ sistema: 'SOP', pagina: 'mantis', permiso: 'actualizar' })
  sincronizarMantis() {
    return this.mantisSync.iniciarEnSegundoPlano('manual');
  }

  /** Registrar una incidencia interna */
  @Post('tickets')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'insertar' })
  crear(@Body() dto: CreateTicketDto, @Req() req: Request) {
    return this.soporte.crear(dto, gestorDe(req));
  }

  /** Editar clasificación del ticket */
  @Patch('tickets/:id')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  actualizar(@Param('id') id: string, @Body() dto: UpdateTicketDto, @Req() req: Request) {
    return this.soporte.actualizar(Number(id), dto, gestorDe(req));
  }

  /** Asignar agente y/o grupo */
  @Patch('tickets/:id/assign')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  asignar(@Param('id') id: string, @Body() dto: AssignTicketDto, @Req() req: Request) {
    return this.soporte.asignar(Number(id), dto, gestorDe(req));
  }

  /** Forzar prioridad (solo admin) */
  @Patch('tickets/:id/priority')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  forzarPrioridad(@Param('id') id: string, @Body() dto: OverridePriorityDto, @Req() req: Request) {
    return this.soporte.forzarPrioridad(Number(id), dto, gestorDe(req));
  }

  /** Cambiar estado (con resolución cuando corresponde) */
  @Patch('tickets/:id/state')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  cambiarEstado(@Param('id') id: string, @Body() dto: ChangeStateDto, @Req() req: Request) {
    return this.soporte.cambiarEstado(Number(id), dto, gestorDe(req));
  }

  /** Enviar la incidencia a MantisBT (acción manual) */
  @Post('tickets/:id/mantis')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  enviarAMantis(@Param('id') id: string, @Body() dto: EnviarMantisDto, @Req() req: Request) {
    return this.soporte.enviarAMantis(Number(id), dto, gestorDe(req));
  }

  /** Responder al solicitante o agregar nota interna */
  @Post('tickets/:id/messages')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  agregarMensaje(@Param('id') id: string, @Body() dto: CreateMessageDto, @Req() req: Request) {
    return this.soporte.agregarMensaje(Number(id), dto, gestorDe(req));
  }

  /** Eliminar un comentario del ticket (baja logica, queda en el historial) */
  @Delete('tickets/:id/messages/:mensajeId')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  eliminarMensaje(
    @Param('id') id: string,
    @Param('mensajeId') mensajeId: string,
    @Req() req: Request,
  ) {
    return this.soporte.eliminarMensaje(Number(id), Number(mensajeId), gestorDe(req));
  }

  /** Enviar manualmente el seguimiento (solo comentarios públicos) al cliente */
  @Post('tickets/:id/enviar-seguimiento')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  enviarSeguimiento(@Param('id') id: string, @Body() dto: EnviarSeguimientoDto, @Req() req: Request) {
    return this.soporte.enviarSeguimientoCliente(Number(id), dto, gestorDe(req));
  }

  /** Subir uno o varios adjuntos al ticket */
  @Post('tickets/:id/attachments')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  @UseInterceptors(
    FilesInterceptor('archivos', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  adjuntar(
    @Param('id') id: string,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.soporte.agregarAdjuntos(Number(id), archivos ?? [], gestorDe(req));
  }

  /** Descargar un adjunto con sesión */
  @Get('tickets/:id/attachments/:adjuntoId')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })
  async descargar(
    @Param('id') id: string,
    @Param('adjuntoId') adjuntoId: string,
    @Res() res: Response,
  ) {
    const adjunto = await this.soporte.rutaAdjunto(Number(id), Number(adjuntoId));
    res.download(adjunto.ruta, adjunto.nombre);
  }

  /** Eliminar adjunto (baja lógica + físico) */
  @Delete('tickets/:id/attachments/:adjuntoId')
  @RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'actualizar' })
  eliminarAdjunto(@Param('id') id: string, @Param('adjuntoId') adjuntoId: string) {
    return this.soporte.eliminarAdjunto(Number(id), Number(adjuntoId));
  }
}