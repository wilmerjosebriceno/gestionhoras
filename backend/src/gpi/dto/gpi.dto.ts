import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const ESTADOS_PROYECTO = ['planificado', 'en_ejecucion', 'en_pausa', 'cerrado', 'cancelado'];
const ESTADOS_ACTIVIDAD = ['pendiente', 'en_proceso', 'bloqueada', 'completada', 'cancelada'];
const TIPOS_ACTIVIDAD = ['tarea', 'resumen', 'hito'];
const TIPOS_DEPENDENCIA = ['FS', 'SS', 'FF', 'SF'];
const TIPOS_RECURSO = ['consultor', 'desarrollador', 'analista', 'lider', 'qa', 'soporte', 'otro'];

/* ==================== Proyectos ==================== */

export class QueryProyectoDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(ESTADOS_PROYECTO) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}

export class CrearProyectoDto {
  @IsString() @MinLength(2) @MaxLength(20) codigo: string;
  @IsString() @MinLength(3) @MaxLength(200) nombre: string;
  @IsOptional() @IsString() @MaxLength(5000) descripcion?: string;
  @IsOptional() @Type(() => Number) @IsInt() idArea?: number;
  @IsOptional() @Type(() => Number) @IsInt() idGerente?: number;
  @IsOptional() @IsIn(ESTADOS_PROYECTO) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() prioridad?: number;
  @IsOptional() @IsString() fechaIniPlan?: string;
  @IsOptional() @IsString() fechaFinPlan?: string;
  @IsOptional() @Type(() => Number) @IsNumber() horasEstimadas?: number;
}

export class ActualizarProyectoDto {
  @IsOptional() @IsString() @MaxLength(200) nombre?: string;
  @IsOptional() @IsString() @MaxLength(5000) descripcion?: string;
  @IsOptional() @Type(() => Number) @IsInt() idArea?: number;
  @IsOptional() @Type(() => Number) @IsInt() idGerente?: number;
  @IsOptional() @IsIn(ESTADOS_PROYECTO) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() prioridad?: number;
  @IsOptional() @IsString() fechaIniPlan?: string;
  @IsOptional() @IsString() fechaFinPlan?: string;
  @IsOptional() @IsString() fechaIniReal?: string;
  @IsOptional() @IsString() fechaFinReal?: string;
  @IsOptional() @Type(() => Number) @IsNumber() horasEstimadas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() avancePct?: number;
}

/* ==================== Recursos y roles ==================== */

export class CrearRecursoDto {
  @IsString() @MinLength(2) @MaxLength(150) nombre: string;
  @IsOptional() @Type(() => Number) @IsInt() idUsuario?: number;
  @IsOptional() @IsString() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(100) cargo?: string;
  @IsOptional() @IsIn(TIPOS_RECURSO) tipo?: string;
  @IsOptional() @IsString() @MaxLength(100) area?: string;
  @IsOptional() @Type(() => Number) @IsNumber() capacidadSemanal?: number;
  @IsOptional() @Type(() => Number) @IsNumber() tarifaHora?: number;
}

export class ActualizarRecursoDto {
  @IsOptional() @IsString() @MaxLength(150) nombre?: string;
  @IsOptional() @IsString() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(100) cargo?: string;
  @IsOptional() @IsIn(TIPOS_RECURSO) tipo?: string;
  @IsOptional() @IsString() @MaxLength(100) area?: string;
  @IsOptional() @Type(() => Number) @IsNumber() capacidadSemanal?: number;
  @IsOptional() @Type(() => Number) @IsNumber() tarifaHora?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearRolDto {
  @IsString() @MinLength(1) @MaxLength(20) codigo: string;
  @IsString() @MinLength(2) @MaxLength(80) nombre: string;
}

/* ==================== Miembros ==================== */

export class CrearMiembroDto {
  @Type(() => Number) @IsInt() idRecurso: number;
  @IsOptional() @Type(() => Number) @IsInt() idRol?: number;
  @IsOptional() @Type(() => Number) @IsNumber() dedicacionPct?: number;
  @IsOptional() @IsString() fechaAlta?: string;
}

export class ActualizarMiembroDto {
  @IsOptional() @Type(() => Number) @IsInt() idRol?: number;
  @IsOptional() @Type(() => Number) @IsNumber() dedicacionPct?: number;
  @IsOptional() @IsString() fechaBaja?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

/* ==================== Actividades y dependencias ==================== */

export class QueryActividadDto {
  @IsOptional() @Type(() => Number) @IsInt() proyectoId?: number;
}

export class CrearActividadDto {
  @Type(() => Number) @IsInt() idProyecto: number;
  @IsOptional() @Type(() => Number) @IsInt() idPadre?: number;
  @IsOptional() @IsString() @MaxLength(30) codigoWbs?: string;
  @IsString() @MinLength(2) @MaxLength(250) nombre: string;
  @IsOptional() @IsString() @MaxLength(5000) descripcion?: string;
  @IsOptional() @IsIn(TIPOS_ACTIVIDAD) tipo?: string;
  @IsOptional() @Type(() => Number) @IsInt() idResponsable?: number;
  @IsOptional() @IsIn(ESTADOS_ACTIVIDAD) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() prioridad?: number;
  @IsOptional() @IsString() fechaIniPlan?: string;
  @IsOptional() @IsString() fechaFinPlan?: string;
  @IsOptional() @Type(() => Number) @IsNumber() horasEstimadas?: number;
  @IsOptional() @Type(() => Number) @IsInt() orden?: number;
}

export class ActualizarActividadDto {
  @IsOptional() @IsString() @MaxLength(250) nombre?: string;
  @IsOptional() @IsString() @MaxLength(5000) descripcion?: string;
  @IsOptional() @IsIn(TIPOS_ACTIVIDAD) tipo?: string;
  @IsOptional() @Type(() => Number) @IsInt() idResponsable?: number;
  @IsOptional() @IsIn(ESTADOS_ACTIVIDAD) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() prioridad?: number;
  @IsOptional() @IsString() fechaIniPlan?: string;
  @IsOptional() @IsString() fechaFinPlan?: string;
  @IsOptional() @IsString() fechaIniReal?: string;
  @IsOptional() @IsString() fechaFinReal?: string;
  @IsOptional() @Type(() => Number) @IsNumber() horasEstimadas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() avancePct?: number;
  @IsOptional() @Type(() => Number) @IsInt() orden?: number;
}

export class CrearDependenciaDto {
  @Type(() => Number) @IsInt() idActividad: number;
  @Type(() => Number) @IsInt() idPredecesora: number;
  @IsOptional() @IsIn(TIPOS_DEPENDENCIA) tipo?: string;
  @IsOptional() @Type(() => Number) @IsInt() lagDias?: number;
}

/* ==================== Asignaciones y horas ==================== */

export class QueryAsignacionDto {
  @IsOptional() @Type(() => Number) @IsInt() proyectoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() actividadId?: number;
}

export class CrearAsignacionDto {
  @Type(() => Number) @IsInt() idActividad: number;
  @Type(() => Number) @IsInt() idMiembro: number;
  @IsOptional() @Type(() => Number) @IsNumber() horasEstimadas?: number;
  @IsOptional() @IsString() fechaIni?: string;
  @IsOptional() @IsString() fechaFin?: string;
  @IsOptional() @Type(() => Number) @IsNumber() porcentaje?: number;
}

export class ActualizarAsignacionDto {
  @IsOptional() @Type(() => Number) @IsNumber() horasEstimadas?: number;
  @IsOptional() @IsString() fechaIni?: string;
  @IsOptional() @IsString() fechaFin?: string;
  @IsOptional() @Type(() => Number) @IsNumber() porcentaje?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

class AsignacionHoraItem {
  @IsString() fecha: string;
  @Type(() => Number) @IsNumber() horas: number;
}

export class GuardarAsignacionHorasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionHoraItem)
  horas: AsignacionHoraItem[];
}

/* ==================== Partes de horas ==================== */

export class QueryParteHoraDto {
  @IsOptional() @Type(() => Number) @IsInt() proyectoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() asignacionId?: number;
}

export class CrearParteHoraDto {
  @Type(() => Number) @IsInt() idAsignacion: number;
  @IsString() fecha: string;
  @Type(() => Number) @IsNumber() horas: number;
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
}

/* ==================== Calendario ==================== */

export class CrearCalendarioDto {
  @IsOptional() @Type(() => Number) @IsInt() idProyecto?: number;
  @IsString() @MinLength(2) @MaxLength(80) nombre: string;
  @IsOptional() @IsBoolean() lunes?: boolean;
  @IsOptional() @IsBoolean() martes?: boolean;
  @IsOptional() @IsBoolean() miercoles?: boolean;
  @IsOptional() @IsBoolean() jueves?: boolean;
  @IsOptional() @IsBoolean() viernes?: boolean;
  @IsOptional() @IsBoolean() sabado?: boolean;
  @IsOptional() @IsBoolean() domingo?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() horasPorDia?: number;
}

export class CrearExcepcionDto {
  @IsString() fecha: string;
  @IsOptional() @IsBoolean() laborable?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() horas?: number;
  @IsOptional() @IsString() @MaxLength(150) motivo?: string;
}

/* ==================== Programacion ==================== */

export class ProgramarDto {
  @IsOptional() @IsString() fechaInicio?: string;
}
