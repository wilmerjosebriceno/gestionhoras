import { IsOptional, IsInt, IsString, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCotClientDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idSghClient?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameClient?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adressClient?: string;

  @IsOptional()
  @IsIn([0, 1])
  active?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactEmail?: string;
}

export class UpdateCotClientDto extends CreateCotClientDto {}

export class CreateRegionDto {
  @IsOptional()
  @IsInt()
  idClient?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  priceOnline?: number;

  @IsOptional()
  @IsIn([0, 1])
  active?: number;
}

export class CreateCotTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  hours?: number;
}

export class CreateEmpresaDto {

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telephone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  web?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  prefix?: string;
}

export class CreateTasaIvaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  porcentaje?: number;

  @IsOptional()
  @IsIn([0, 1])
  activo?: number;

  @IsOptional()
  @IsInt()
  orden?: number;
}