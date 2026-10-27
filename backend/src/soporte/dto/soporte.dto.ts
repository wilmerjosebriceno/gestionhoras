import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const aNumero = ({ value }: { value: unknown }) =>
  value === null || value === undefined || value === '' ? undefined : Number(value);

/** Filtros de la bandeja de tickets */
export class QueryTicketsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['nuevo', 'asignado', 'en_progreso', 'en_espera', 'resuelto', 'cerrado', 'cancelado'])
  state?: string;

  @IsOptional()
  @IsIn(['P1', 'P2', 'P3', 'P4'])
  priority?: string;

  @IsOptional()
  @IsIn(['incidente', 'requerimiento', 'problema', 'cambio'])
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  /** Filtrar por categoría/módulo (id de ticket_categories) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  /** Solo los tickets asignados al agente autenticado */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  soloMios?: boolean;

  /** Solo tickets con SLA vencido o por vencer */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  slaEnRiesgo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

/** Creación de ticket interno */
export class CreateTicketDto {
  @IsOptional()
  @IsIn(['incidente', 'requerimiento', 'problema', 'cambio'])
  type?: string;

  @IsString({ message: 'El título es obligatorio' })
  @MinLength(5, { message: 'El título debe tener al menos 5 caracteres' })
  @MaxLength(200)
  title: string;

  @IsString({ message: 'La descripción es obligatoria' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  groupId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  affectedUser?: string;

  @IsOptional()
  @IsIn(['extenso', 'significativo', 'moderado', 'menor'])
  impact?: string;

  @IsOptional()
  @IsIn(['critica', 'alta', 'media', 'baja'])
  urgency?: string;

  @IsOptional()
  @IsIn(['portal', 'correo', 'telefono', 'whatsapp', 'presencial'])
  channel?: string;

  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clientRif?: string;
}

/** Edición de la clasificación del ticket */
export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  groupId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  affectedUser?: string;

  @IsOptional()
  @IsIn(['extenso', 'significativo', 'moderado', 'menor'])
  impact?: string;

  @IsOptional()
  @IsIn(['critica', 'alta', 'media', 'baja'])
  urgency?: string;

  @IsOptional()
  @IsIn(['incidente', 'requerimiento', 'problema', 'cambio'])
  type?: string;
}

/** Asignación de agente y/o grupo */
export class AssignTicketDto {
  @IsOptional()
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsInt()
  groupId?: number;

  /** Asignarse el ticket a sí mismo */
  @IsOptional()
  @IsBoolean()
  tomar?: boolean;
}

/** Forzar prioridad (solo admin) */
export class OverridePriorityDto {
  @IsIn(['P1', 'P2', 'P3', 'P4'], { message: 'Prioridad inválida' })
  priority: string;

  @IsString({ message: 'Debes indicar el motivo del cambio de prioridad' })
  @MinLength(5)
  @MaxLength(300)
  justificacion: string;
}

/** Cambio de estado (incluye resolución cuando corresponde) */
export class ChangeStateDto {
  @IsIn(['nuevo', 'asignado', 'en_progreso', 'en_espera', 'resuelto', 'cerrado', 'cancelado'], {
    message: 'Estado inválido',
  })
  state: string;

  @IsOptional()
  @IsIn(['espera_usuario', 'espera_proveedor', 'espera_ventana_cambio', 'espera_tercero'])
  holdReason?: string;

  @IsOptional()
  @IsIn([
    'solucionado',
    'workaround',
    'no_reproducible',
    'duplicado',
    'error_del_usuario',
    'cancelado_usuario',
    'requiere_cambio',
  ])
  resolutionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  resolutionNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

/** Mensaje o nota interna del ticket */
export class CreateMessageDto {
  @IsString({ message: 'El mensaje no puede estar vacío' })
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

/** Envío manual del ticket a MantisBT (botón «Enviar a Mantis»). */
export class EnviarMantisDto {
  /** Proyecto de Mantis. Si se omite, se usa el del cliente (sgh_client.id_mantis_proyect). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  /** Responsable (handler) en Mantis. Opcional. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  handlerId?: number;

  /** Categoría del proyecto en Mantis. Si se omite, se usa la primera habilitada. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  /** Prioridad de Mantis. Si se omite, se deduce de la prioridad del ticket. */
  @IsOptional()
  @IsIn(['P1', 'P2', 'P3', 'P4'])
  priority?: string;

  /** Severidad de Mantis. Si se omite, se deduce del impacto del ticket. */
  @IsOptional()
  @IsIn(['block', 'crash', 'major', 'minor', 'tweak', 'text', 'trivial', 'feature'])
  severity?: string;

  /**
   * Valores de los campos personalizados obligatorios del proyecto, indexados
   * por el id del campo en Mantis, p. ej. { "15": "SEP" } para «MODULOS ERP».
   */
  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;
}

/** Carta formal de cierre que se envía al cliente por correo. */
export class NotificarCierreDto {
  /** Correo del destinatario. Si se omite, se usa el del ticket/cliente. */
  @IsOptional()
  @IsEmail({}, { message: 'El correo del destinatario no es válido' })
  @MaxLength(150)
  destinatario?: string;

  /** Incluir la conversación pública con el cliente (por defecto sí). */
  @IsOptional()
  @IsBoolean()
  incluirConversacion?: boolean;

  /** Párrafo adicional del agente (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;

  /** Solo generar la carta (vista previa) sin enviarla. */
  @IsOptional()
  @IsBoolean()
  previsualizar?: boolean;
}

/** Envío de la incidencia (con sus documentos adjuntos) por correo. */
export class EnviarCorreoIncidenciaDto {
  /** Correo destinatario. Si se omite, se usa calidad@sigesp.com.ve. */
  @IsOptional()
  @IsEmail({}, { message: 'El correo del destinatario no es válido' })
  @MaxLength(150)
  destinatario?: string;

  /** Incluir la conversación pública del ticket en el cuerpo. */
  @IsOptional()
  @IsBoolean()
  incluirConversacion?: boolean;

  /** Nota o mensaje adicional del remitente (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;
}

/** Cierre automático del ticket porque el caso está cerrado en Mantis. */
export class CerrarDesdeMantisDto {
  /** Texto de la conversación (si se omite, se usa la plantilla de cierre). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;

  /** Incluir la conversación pública en la carta de cierre (por defecto sí). */
  @IsOptional()
  @IsBoolean()
  incluirConversacion?: boolean;

  /** Enviar la carta de cierre al cliente por correo (por defecto sí). */
  @IsOptional()
  @IsBoolean()
  notificar?: boolean;

  /** Correo del destinatario (si se omite, se usa el del ticket/cliente). */
  @IsOptional()
  @IsEmail({}, { message: 'El correo del destinatario no es válido' })
  @MaxLength(150)
  destinatario?: string;

  /** Código de resolución (si se omite, se conserva el actual). */
  @IsOptional()
  @IsIn([
    'solucionado',
    'workaround',
    'no_reproducible',
    'duplicado',
    'error_del_usuario',
    'cancelado_usuario',
    'requiere_cambio',
  ])
  resolutionCode?: string;

  /** Notas de resolución (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;
}

/** Envío manual del seguimiento (solo comentarios públicos) del ticket al cliente. */
export class EnviarSeguimientoDto {
  /** Correo destinatario. Si se omite, se usa el del ticket/cliente. */
  @IsOptional()
  @IsEmail({}, { message: 'El correo del destinatario no es válido' })
  @MaxLength(150)
  destinatario?: string;

  /**
   * Ids de los comentarios a incluir. Si se omite, se incluyen todos los
   * comentarios públicos. Los internos se excluyen siempre.
   */
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  mensajeIds?: number[];

  /** Párrafo introductorio del agente (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;

  /** Incluir los documentos adjuntos del ticket. */
  @IsOptional()
  @IsBoolean()
  incluirAdjuntos?: boolean;

  /** Solo generar el correo (vista previa) sin enviarlo. */
  @IsOptional()
  @IsBoolean()
  previsualizar?: boolean;
}

/** Filtros del dashboard de Mantis (rango de fechas y proyecto). */
export class DashboardMantisDto {
  @IsOptional()
  @IsDateString({}, { message: '«desde» debe ser una fecha válida (YYYY-MM-DD)' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: '«hasta» debe ser una fecha válida (YYYY-MM-DD)' })
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  /** Días sin actualización para considerar un caso "estancado" (por defecto 15). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estancadosDias?: number;

  /** Filtrar por responsable (handler de Mantis). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  handlerId?: number;

  /** Filtrar por informador (reporter de Mantis). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reporterId?: number;

  /** Filtrar por estatus (status_id de Mantis). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusId?: number;

  /** Estatus a EXCLUIR del resultado (lista de status_id). Acepta `a,b,c` o repetidos. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const arr = Array.isArray(value) ? value : String(value).split(',');
    const nums = arr.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    return nums.length ? nums : undefined;
  })
  @IsArray()
  @IsInt({ each: true })
  excluirStatusIds?: number[];

  /** Si es true, solo casos abiertos (excluye Resolved y Closed). */
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined
      ? undefined
      : value === true || value === '1' || value === 'true',
  )
  @IsBoolean()
  soloAbiertos?: boolean;

  /** Contenido del reporte PDF: false = solo registro principal (sin comentarios). */
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined
      ? undefined
      : value === true || value === '1' || value === 'true',
  )
  @IsBoolean()
  conDetalle?: boolean;

  /** Filtrar por reaperturas: 'si' (reabiertas), '1' (una vez) o '2mas' (2 o más). */
  @IsOptional()
  @IsIn(['si', '1', '2mas'])
  reopened?: string;

  /** Paginación del listado de casos (GET /mantis/casos). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  /** Contenido del CSV: `casos` (por defecto) o `resumen` (KPIs). */
  @IsOptional()
  @IsIn(['casos', 'resumen'])
  tipo?: string;

  /** Destinatario de la alerta (si se omite, MANTIS_ALERTAS_EMAIL del .env). */
  @IsOptional()
  @IsEmail({}, { message: 'El correo del destinatario no es válido' })
  destinatario?: string;
}