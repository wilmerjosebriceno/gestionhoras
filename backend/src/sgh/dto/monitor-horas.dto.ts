import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ScrinConfigDto {
  @IsOptional()
  @IsInt()
  scrinCompanyId?: number;

  @IsOptional()
  @IsInt()
  scrinEmploymentId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  scrinToken?: string;
}

export class MonitorFetchDto {
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}

export class MonitorCheckDto {
  @Type(() => Number)
  @IsInt()
  selected: number;
}

/**
 * Verificacion en vivo contra Scrin de la identidad configurada
 * (boton "Probar conexion"). Permite probar un ID/token aun no guardado.
 */
export class VerificarScrinDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scrinEmploymentId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  scrinToken?: string;
}

/** Consultar un token de Scrin para listar los IDs de empleado que expone. */
export class ExplorarTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  scrinToken: string;
}

/** Marca/desmarca de una sola vez todos los registros pendientes (checklist). */
export class MonitorCheckAllDto {
  @Type(() => Number)
  @IsInt()
  selected: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ConsultaFetchDto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  idUsers: number[];

  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}

export class SummaryAssignDto {
  @Type(() => Number)
  @IsInt()
  idProyect: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idType?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idProcess?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idItemActivity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
