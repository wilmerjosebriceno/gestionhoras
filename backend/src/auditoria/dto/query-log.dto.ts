import { IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryLogDto {
  @ApiProperty({ example: 'INICIO DE SESION', description: 'Filtrar por contenido de la nota (LIKE)', required: false })
  @IsOptional()
  @IsString()
  nota?: string;

  @ApiProperty({ example: '2026-01-01', description: 'Fecha inicio (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiProperty({ example: '2026-12-31', description: 'Fecha fin (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiProperty({ example: 1, description: 'Número de página', required: false })
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @ApiProperty({ example: 50, description: 'Resultados por página', required: false })
  @IsOptional()
  @IsInt()
  limit?: number = 50;
}
