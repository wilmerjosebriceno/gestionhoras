import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateFaseDto {
  @IsOptional()
  @IsDateString()
  fechaIniPlan?: string;

  @IsOptional()
  @IsDateString()
  fechaFinPlan?: string;

  @IsOptional()
  @IsDateString()
  fechaIniReal?: string;

  @IsOptional()
  @IsDateString()
  fechaFinReal?: string;

  @IsOptional()
  @IsInt()
  idUserResponsable?: number;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsInt()
  avanceModelo?: number;

  @IsOptional()
  avance?: number;
}

export class RegistrarSeguimientoDto {
  @IsInt()
  idCron: number;

  @IsInt()
  idProyect: number;

  @IsInt()
  idUser: number;

  @IsOptional()
  @IsInt()
  statusNew?: number;

  @IsNotEmpty()
  avanceNew: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}

export class CrearHitoDto {
  @IsInt()
  idCron: number;

  @IsInt()
  idProyect: number;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsDateString()
  fechaPlan?: string;

  @IsOptional()
  @IsDateString()
  fechaReal?: string;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  peso?: number;

  @IsOptional()
  @IsString()
  comentario?: string;
}
