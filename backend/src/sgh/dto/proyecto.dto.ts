import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ProyectoActividadRowDto {
  @IsOptional()
  @IsInt()
  idProyectActivity?: number;

  @IsOptional()
  @IsInt()
  idEp?: number;

  @IsOptional()
  hour?: number;

  @IsOptional()
  hourE?: number;

  @IsOptional()
  @IsInt()
  active?: number;
}

export class CreateProyectoDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  numdoc?: string;

  @IsOptional()
  @IsDateString()
  dateProyect?: string;

  @IsOptional()
  @IsDateString()
  dateIni?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  responsable?: string;

  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsInt()
  enterprise?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProyectoActividadRowDto)
  actividades?: ProyectoActividadRowDto[];
}

export class UpdateProyectoDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  numdoc?: string;

  @IsOptional()
  @IsDateString()
  dateProyect?: string;

  @IsOptional()
  @IsDateString()
  dateIni?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  responsable?: string;

  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsInt()
  enterprise?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProyectoActividadRowDto)
  actividades?: ProyectoActividadRowDto[];
}

export class AnularProyectoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  motivo: string;
}
