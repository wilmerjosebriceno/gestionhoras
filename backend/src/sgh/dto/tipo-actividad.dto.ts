import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTipoActividadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameType: string;

  @IsOptional()
  @IsInt()
  active?: number;
}

export class UpdateTipoActividadDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameType?: string;

  @IsOptional()
  @IsInt()
  active?: number;
}
