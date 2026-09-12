import {
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsEmail,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUsuarioDto {
  @ApiProperty({ example: 'V-12345678', description: 'Cédula de identidad', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  cedula?: string;

  @ApiProperty({ example: 'JUAN', description: 'Nombres', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombres?: string;

  @ApiProperty({ example: 'PÉREZ', description: 'Apellidos', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  apellidos?: string;

  @ApiProperty({ example: '04121234567', description: 'Teléfono', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @ApiProperty({ example: 'Usuario activo', description: 'Observación', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacion?: string;

  @ApiProperty({ example: 'user@sigesp.com', description: 'Correo electrónico', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiProperty({ example: 1, description: 'Estatus (1=activo, 0=inactivo)', required: false })
  @IsOptional()
  @IsInt()
  estatus?: number;

  @ApiProperty({ example: 1, description: 'Nivel general', required: false })
  @IsOptional()
  @IsInt()
  nivelGeneral?: number;

  @ApiProperty({ example: 'GERENTE', description: 'Cargo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'UUID del grupo', required: false })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  idGrupo?: string;
}
