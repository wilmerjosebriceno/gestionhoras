import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameCategory: string;

  @IsOptional()
  @IsInt()
  active?: number;
}

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameCategory?: string;

  @IsOptional()
  @IsInt()
  active?: number;
}
