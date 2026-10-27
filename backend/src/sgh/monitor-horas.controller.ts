import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MonitorHorasService } from './monitor-horas.service';
import {
  ConsultaFetchDto,
  ExplorarTokenDto,
  MonitorCheckAllDto,
  MonitorCheckDto,
  MonitorFetchDto,
  ScrinConfigDto,
  SummaryAssignDto,
  VerificarScrinDto,
} from './dto/monitor-horas.dto';

@ApiTags('SGH - Monitor de Horas (Scrin)')
@Controller('sgh/scrin/monitor')
export class MonitorHorasController {
  constructor(private readonly monitor: MonitorHorasService) {}

  private login(req: any): string {
    return (req?.user as any)?.login;
  }

  @Get('config')
  getConfig(@Req() req: any) {
    return this.monitor.getConfig(this.login(req));
  }

  @Put('config')
  saveConfig(@Req() req: any, @Body() dto: ScrinConfigDto) {
    return this.monitor.saveConfig(this.login(req), dto);
  }

  /** Boton "Probar conexion": valida token e ID contra Scrin en vivo. */
  @Post('config/verificar')
  verificarConfig(@Req() req: any, @Body() dto: VerificarScrinDto) {
    return this.monitor.verificarConexion(this.login(req), dto);
  }

  /**
   * Igual que el anterior pero para OTRO usuario SGH (pantalla Usuarios SGH).
   * Solo administradores (rol A/S).
   */
  @Post('usuarios/:id/verificar')
  verificarUsuario(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerificarScrinDto,
  ) {
    return this.monitor.verificarConexionDeUsuario(this.login(req), id, dto);
  }

  /**
   * Lista los IDs de empleado que expone un token de Scrin (solo admin).
   * Sirve para saber que ID asignar a cada usuario, incluso con un token nuevo.
   */
  @Post('token/empleados')
  explorarToken(@Req() req: any, @Body() dto: ExplorarTokenDto) {
    return this.monitor.explorarToken(this.login(req), dto.scrinToken);
  }

  @Post('fetch')
  fetch(@Req() req: any, @Body() dto: MonitorFetchDto) {
    return this.monitor.fetchRange(this.login(req), dto.from, dto.to);
  }

  @Get('activities')
  listActivities(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('selected') selected?: string,
    @Query('status') status?: string,
  ) {
    return this.monitor.listActivities(this.login(req), {
      from,
      to,
      onlySelected: selected === '1' || selected === 'true',
      status: status !== undefined ? Number(status) : undefined,
    });
  }

  /** Checklist: marca/desmarca todos los pendientes en una sola peticion. */
  @Patch('activities/check-all')
  checkAll(@Req() req: any, @Body() dto: MonitorCheckAllDto) {
    return this.monitor.setSelectedAll(this.login(req), dto.selected, dto.from, dto.to);
  }

  @Patch('activities/:id/check')
  check(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MonitorCheckDto,
  ) {
    return this.monitor.setSelected(this.login(req), id, dto.selected);
  }

  @Post('summary')
  buildSummary(@Req() req: any, @Body() dto: MonitorFetchDto) {
    return this.monitor.buildSummary(this.login(req), dto.from, dto.to);
  }

  @Get('summary')
  listSummary(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.monitor.listSummary(this.login(req), from, to);
  }

  @Put('summary/:id/assign')
  assign(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SummaryAssignDto,
  ) {
    return this.monitor.assignSummary(this.login(req), id, dto);
  }

  @Post('summary/:id/process')
  process(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.monitor.processSummary(this.login(req), id);
  }

  /* ==================== CONSULTA MULTIUSUARIO (SOLO LECTURA) ==================== */

  @Get('consulta/usuarios')
  consultaUsuarios(@Req() req: any, @Query('term') term?: string) {
    return this.monitor.usuariosParaConsulta(this.login(req), term);
  }

  @Post('consulta/fetch')
  consultaFetch(@Req() req: any, @Body() dto: ConsultaFetchDto) {
    return this.monitor.consultaFetch(this.login(req), dto.idUsers, dto.from, dto.to);
  }

  @Get('consulta/actividades')
  consultaActividades(
    @Req() req: any,
    @Query('idUsers') idUsers?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('syncStatus') syncStatus?: string,
  ) {
    const ids = (idUsers ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const sync = syncStatus !== undefined ? Number(syncStatus) : undefined;
    return this.monitor.consultaActividades(this.login(req), ids, from, to, sync);
  }
}
