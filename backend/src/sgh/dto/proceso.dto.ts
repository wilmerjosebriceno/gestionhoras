import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProcesoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameProcess: string;

  @IsOptional()
  @IsInt()
  active?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  code?: string;

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class UpdateProcesoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameProcess?: string;

  @IsOptional()
  @IsInt()
  active?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  code?: string;

  @IsOptional()
  @IsInt()
  orden?: number;
}
