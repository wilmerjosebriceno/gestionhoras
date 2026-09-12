import { IsString, MinLength, MaxLength, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSistemaDto {
  @ApiProperty({ example: 'Sistema de Seguridad', description: 'Nombre descriptivo del sistema' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  denominacion?: string;

  @ApiProperty({ example: 'Control de perfiles, accesos y log', description: 'Descripción del módulo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({ example: '/sec', description: 'Ruta de acceso al módulo' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ruta?: string;

  @ApiProperty({ example: 1, description: 'Estatus activo/inactivo' })
  @IsOptional()
  @IsInt()
  estatus?: number;
}
