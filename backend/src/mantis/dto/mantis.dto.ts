import { IsOptional, IsString } from 'class-validator';

/**
 * DTO de consulta de reportes Mantis.
 * Se usa como clase (no interfaz) porque hay un ValidationPipe global con
 * whitelist; los campos numéricos se convierten implícitamente (string -> number).
 */
export class MantisConsultaDto {
  @IsOptional()
  projectId?: number;

  @IsOptional()
  statusId?: number;

  @IsOptional()
  reporterId?: number;

  @IsOptional()
  handlerId?: number;

  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  max?: number;
}
