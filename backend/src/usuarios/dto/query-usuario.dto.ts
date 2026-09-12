import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryUsuarioDto {
  @ApiProperty({ example: 'SOFTBRI', description: 'Filtrar por login (LIKE)', required: false })
  @IsOptional()
  @IsString()
  login?: string;

  @ApiProperty({ example: 'ADMIN', description: 'Filtrar por nombres (LIKE)', required: false })
  @IsOptional()
  @IsString()
  nombres?: string;

  @ApiProperty({ example: 'PÉREZ', description: 'Filtrar por apellidos (LIKE)', required: false })
  @IsOptional()
  @IsString()
  apellidos?: string;

  @ApiProperty({ example: 'admin@sigesp.com', description: 'Filtrar por email (LIKE)', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 1, description: 'Filtrar por estatus (1=activo, 0=inactivo)', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  estatus?: number;

  @ApiProperty({ example: 'ADMINISTRADORES', description: 'Filtrar por grupo', required: false })
  @IsOptional()
  @IsString()
  grupo?: string;

  @ApiProperty({ example: 1, description: 'Número de página', required: false })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiProperty({ example: 25, description: 'Resultados por página', required: false })
  @IsOptional()
  @IsInt()
  limit?: number = 25;
}
