import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequierePermiso, PermisoOptions } from '../common/decorators/requiere-permiso.decorator';
import { GpiService } from './gpi.service';
import {
  ActualizarActividadDto,
  ActualizarAsignacionDto,
  ActualizarMiembroDto,
  ActualizarProyectoDto,
  ActualizarRecursoDto,
  CrearActividadDto,
  CrearAsignacionDto,
  CrearCalendarioDto,
  CrearDependenciaDto,
  CrearExcepcionDto,
  CrearMiembroDto,
  CrearParteHoraDto,
  CrearProyectoDto,
  CrearRecursoDto,
  CrearRolDto,
  GuardarAsignacionHorasDto,
  ProgramarDto,
  QueryActividadDto,
  QueryAsignacionDto,
  QueryParteHoraDto,
  QueryProyectoDto,
} from './dto/gpi.dto';

const P = (pagina: string, permiso: PermisoOptions['permiso'] = 'seleccionar'): PermisoOptions => ({
  sistema: 'GPI',
  pagina,
  permiso,
});

@ApiTags('GPI - Proyectos Internos')
@Controller('gpi')
export class GpiController {
  constructor(private readonly gpi: GpiService) {}

  /** Catalogos para selects (recursos y roles). */
  @Get('catalogos')
  @RequierePermiso(P('recursos'))
  catalogos() {
    return this.gpi.catalogos();
  }

  /* ==================== Proyectos ==================== */

  @Get('proyectos')
  @RequierePermiso(P('proyectos'))
  listarProyectos(@Query() dto: QueryProyectoDto) {
    return this.gpi.listarProyectos(dto);
  }

  @Get('proyectos/:id')
  @RequierePermiso(P('proyectos'))
  obtenerProyecto(@Param('id') id: string) {
    return this.gpi.obtenerProyecto(Number(id));
  }

  @Post('proyectos')
  @RequierePermiso(P('proyectos', 'insertar'))
  crearProyecto(@Body() dto: CrearProyectoDto) {
    return this.gpi.crearProyecto(dto);
  }

  @Patch('proyectos/:id')
  @RequierePermiso(P('proyectos', 'actualizar'))
  actualizarProyecto(@Param('id') id: string, @Body() dto: ActualizarProyectoDto) {
    return this.gpi.actualizarProyecto(Number(id), dto);
  }

  @Delete('proyectos/:id')
  @RequierePermiso(P('proyectos', 'eliminar'))
  eliminarProyecto(@Param('id') id: string) {
    return this.gpi.eliminarProyecto(Number(id));
  }

  /* ==================== Miembros ==================== */

  @Get('proyectos/:id/miembros')
  @RequierePermiso(P('proyectos'))
  listarMiembros(@Param('id') id: string) {
    return this.gpi.listarMiembros(Number(id));
  }

  @Post('proyectos/:id/miembros')
  @RequierePermiso(P('proyectos', 'actualizar'))
  crearMiembro(@Param('id') id: string, @Body() dto: CrearMiembroDto) {
    return this.gpi.crearMiembro(Number(id), dto);
  }

  @Patch('miembros/:id')
  @RequierePermiso(P('proyectos', 'actualizar'))
  actualizarMiembro(@Param('id') id: string, @Body() dto: ActualizarMiembroDto) {
    return this.gpi.actualizarMiembro(Number(id), dto);
  }

  @Delete('miembros/:id')
  @RequierePermiso(P('proyectos', 'actualizar'))
  eliminarMiembro(@Param('id') id: string) {
    return this.gpi.eliminarMiembro(Number(id));
  }

  /* ==================== Recursos y roles ==================== */

  @Get('recursos')
  @RequierePermiso(P('recursos'))
  listarRecursos() {
    return this.gpi.listarRecursos();
  }

  @Post('recursos')
  @RequierePermiso(P('recursos', 'insertar'))
  crearRecurso(@Body() dto: CrearRecursoDto) {
    return this.gpi.crearRecurso(dto);
  }

  @Patch('recursos/:id')
  @RequierePermiso(P('recursos', 'actualizar'))
  actualizarRecurso(@Param('id') id: string, @Body() dto: ActualizarRecursoDto) {
    return this.gpi.actualizarRecurso(Number(id), dto);
  }

  @Delete('recursos/:id')
  @RequierePermiso(P('recursos', 'eliminar'))
  eliminarRecurso(@Param('id') id: string) {
    return this.gpi.eliminarRecurso(Number(id));
  }

  @Get('roles')
  @RequierePermiso(P('roles'))
  listarRoles() {
    return this.gpi.listarRoles();
  }

  @Post('roles')
  @RequierePermiso(P('roles', 'insertar'))
  crearRol(@Body() dto: CrearRolDto) {
    return this.gpi.crearRol(dto);
  }

  /* ==================== Actividades y dependencias ==================== */

  @Get('actividades')
  @RequierePermiso(P('actividades'))
  listarActividades(@Query() dto: QueryActividadDto) {
    return this.gpi.listarActividades(Number(dto.proyectoId ?? 0));
  }

  @Post('actividades')
  @RequierePermiso(P('actividades', 'insertar'))
  crearActividad(@Body() dto: CrearActividadDto) {
    return this.gpi.crearActividad(dto);
  }

  @Patch('actividades/:id')
  @RequierePermiso(P('actividades', 'actualizar'))
  actualizarActividad(@Param('id') id: string, @Body() dto: ActualizarActividadDto) {
    return this.gpi.actualizarActividad(Number(id), dto);
  }

  @Delete('actividades/:id')
  @RequierePermiso(P('actividades', 'eliminar'))
  eliminarActividad(@Param('id') id: string) {
    return this.gpi.eliminarActividad(Number(id));
  }

  @Get('dependencias')
  @RequierePermiso(P('actividades'))
  listarDependencias(@Query() dto: QueryActividadDto) {
    return this.gpi.listarDependencias(Number(dto.proyectoId ?? 0));
  }

  @Post('dependencias')
  @RequierePermiso(P('actividades', 'actualizar'))
  crearDependencia(@Body() dto: CrearDependenciaDto) {
    return this.gpi.crearDependencia(dto);
  }

  @Delete('dependencias/:id')
  @RequierePermiso(P('actividades', 'actualizar'))
  eliminarDependencia(@Param('id') id: string) {
    return this.gpi.eliminarDependencia(Number(id));
  }

  /* ==================== Asignaciones y horas ==================== */

  @Get('asignaciones')
  @RequierePermiso(P('asignaciones'))
  listarAsignaciones(@Query() dto: QueryAsignacionDto) {
    return this.gpi.listarAsignaciones(dto);
  }

  @Post('asignaciones')
  @RequierePermiso(P('asignaciones', 'insertar'))
  crearAsignacion(@Body() dto: CrearAsignacionDto) {
    return this.gpi.crearAsignacion(dto);
  }

  @Patch('asignaciones/:id')
  @RequierePermiso(P('asignaciones', 'actualizar'))
  actualizarAsignacion(@Param('id') id: string, @Body() dto: ActualizarAsignacionDto) {
    return this.gpi.actualizarAsignacion(Number(id), dto);
  }

  @Delete('asignaciones/:id')
  @RequierePermiso(P('asignaciones', 'eliminar'))
  eliminarAsignacion(@Param('id') id: string) {
    return this.gpi.eliminarAsignacion(Number(id));
  }

  @Get('asignaciones/:id/horas')
  @RequierePermiso(P('asignaciones'))
  obtenerHoras(@Param('id') id: string) {
    return this.gpi.obtenerHorasAsignacion(Number(id));
  }

  @Put('asignaciones/:id/horas')
  @RequierePermiso(P('asignaciones', 'actualizar'))
  guardarHoras(@Param('id') id: string, @Body() dto: GuardarAsignacionHorasDto) {
    return this.gpi.guardarHorasAsignacion(Number(id), dto);
  }

  /* ==================== Partes de horas ==================== */

  @Get('partes-horas')
  @RequierePermiso(P('partes_horas'))
  listarPartesHoras(@Query() dto: QueryParteHoraDto) {
    return this.gpi.listarPartesHoras(dto);
  }

  @Post('partes-horas')
  @RequierePermiso(P('partes_horas', 'insertar'))
  crearParteHora(@Body() dto: CrearParteHoraDto) {
    return this.gpi.crearParteHora(dto);
  }

  @Post('partes-horas/:id/aprobar')
  @RequierePermiso(P('partes_horas', 'actualizar'))
  aprobarParteHora(@Param('id') id: string) {
    return this.gpi.aprobarParteHora(Number(id));
  }

  /* ==================== Vistas ==================== */

  @Get('proyectos/:id/gantt')
  @RequierePermiso(P('gantt'))
  gantt(@Param('id') id: string) {
    return this.gpi.gantt(Number(id));
  }

  @Get('proyectos/:id/carga')
  @RequierePermiso(P('carga'))
  carga(
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.gpi.carga(Number(id), desde, hasta);
  }

  /* ==================== Calendario ==================== */

  @Get('calendario')
  @RequierePermiso(P('calendario'))
  listarCalendarios(@Query('proyectoId') proyectoId?: string) {
    return this.gpi.listarCalendarios(proyectoId ? Number(proyectoId) : undefined);
  }

  @Post('calendario')
  @RequierePermiso(P('calendario', 'insertar'))
  crearCalendario(@Body() dto: CrearCalendarioDto) {
    return this.gpi.crearCalendario(dto);
  }

  @Get('calendario/:id/excepciones')
  @RequierePermiso(P('calendario'))
  listarExcepciones(@Param('id') id: string) {
    return this.gpi.listarExcepciones(Number(id));
  }

  @Post('calendario/:id/excepciones')
  @RequierePermiso(P('calendario', 'actualizar'))
  crearExcepcion(@Param('id') id: string, @Body() dto: CrearExcepcionDto) {
    return this.gpi.crearExcepcion(Number(id), dto);
  }

  @Delete('calendario/excepciones/:id')
  @RequierePermiso(P('calendario', 'actualizar'))
  eliminarExcepcion(@Param('id') id: string) {
    return this.gpi.eliminarExcepcion(Number(id));
  }

  /* ==================== Programacion y nivelacion ==================== */

  @Post('proyectos/:id/programar')
  @RequierePermiso(P('gantt', 'actualizar'))
  programar(@Param('id') id: string, @Body() dto: ProgramarDto) {
    return this.gpi.programar(Number(id), dto.fechaInicio);
  }

  @Post('proyectos/:id/nivelar')
  @RequierePermiso(P('carga', 'actualizar'))
  nivelar(@Param('id') id: string) {
    return this.gpi.nivelar(Number(id));
  }

  /* ==================== Linea base ==================== */

  @Post('proyectos/:id/baseline')
  @RequierePermiso(P('proyectos', 'actualizar'))
  guardarBaseline(@Param('id') id: string) {
    return this.gpi.guardarBaseline(Number(id));
  }

  /* ==================== Dashboard / KPIs ==================== */

  @Get('dashboard')
  @RequierePermiso(P('dashboard'))
  dashboard() {
    return this.gpi.dashboard();
  }
}
