import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateItemActividadDto {
  @IsOptional()
  @IsString()
  @MaxLength(6)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsInt()
  active?: number;
}

export class UpdateItemActividadDto {
  @IsOptional()
  @IsString()
  @MaxLength(6)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsInt()
  active?: number;
}
