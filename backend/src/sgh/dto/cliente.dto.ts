import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Envío por correo del formato de habilitación de tickets. */
export class EnviarFormatoHabilitacionDto {
  @IsOptional()
  @IsEmail({}, { message: 'El correo del destinatario no es válido' })
  @MaxLength(150)
  destinatario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;
}

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

  @IsOptional()
  @IsInt()
  mantenimiento?: number;

  @IsOptional()
  @IsInt()
  idMantisProyect?: number;
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

  @IsOptional()
  @IsInt()
  mantenimiento?: number;

  @IsOptional()
  @IsInt()
  idMantisProyect?: number;
}
