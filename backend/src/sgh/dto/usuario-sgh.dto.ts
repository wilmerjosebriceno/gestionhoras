import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUsuarioSghDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  login: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameUser: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(100)
  email: string;

  @IsOptional()
  @IsInt()
  idCategory?: number;

  @IsOptional()
  @IsDateString()
  creation?: string;

  @IsOptional()
  @IsInt()
  active?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  rol?: string;
}

export class UpdateUsuarioSghDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  login?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameUser?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsInt()
  idCategory?: number;

  @IsOptional()
  @IsInt()
  active?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  rol?: string;
}
