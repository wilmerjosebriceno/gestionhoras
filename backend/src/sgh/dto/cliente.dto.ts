import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  rif: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  adress: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacTel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacName?: string;

  @IsOptional()
  @IsDateString()
  creation?: string;

  @IsOptional()
  @IsInt()
  active?: number;
}

export class UpdateClienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adress?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacTel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contacName?: string;

  @IsOptional()
  @IsInt()
  active?: number;
}
