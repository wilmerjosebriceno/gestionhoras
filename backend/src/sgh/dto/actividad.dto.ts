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

export class DetalleActividadRowDto {
  @IsOptional()
  @IsInt()
  idDetail?: number;

  @IsOptional()
  @IsInt()
  idItemActivity?: number;

  @IsOptional()
  @IsInt()
  idProcess?: number;

  @IsOptional()
  @IsString()
  situation?: string;

  @IsOptional()
  hours?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mantis?: string;
}

export class CreateActividadDto {
  @IsOptional()
  @IsInt()
  idType?: number;

  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsInt()
  idUser?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numdoc?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  responsible: string;

  @IsDateString()
  @IsNotEmpty()
  dateDocument: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsInt()
  visit?: number;

  @IsOptional()
  @IsInt()
  idProyect?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  file?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleActividadRowDto)
  detalles?: DetalleActividadRowDto[];
}

export class UpdateActividadDto {
  @IsOptional()
  @IsInt()
  idType?: number;

  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsInt()
  idUser?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  responsible?: string;

  @IsOptional()
  @IsDateString()
  dateDocument?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsInt()
  visit?: number;

  @IsOptional()
  @IsInt()
  idProyect?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  file?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleActividadRowDto)
  detalles?: DetalleActividadRowDto[];
}

export class AnularActividadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  motivo: string;
}
