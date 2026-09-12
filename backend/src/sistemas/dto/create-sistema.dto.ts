import { IsString, MinLength, MaxLength, Matches, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSistemaDto {
  @ApiProperty({ example: 'SEC', description: 'Código del sistema (4 caracteres)' })
  @IsString()
  @MinLength(1)
  @MaxLength(4)
  @Matches(/^[A-Z0-9]+$/, { message: 'El código debe contener solo mayúsculas y números' })
  sistema: string;

  @ApiProperty({ example: 'Sistema de Seguridad', description: 'Nombre descriptivo del sistema' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  denominacion: string;

  @ApiProperty({ example: 'Control de perfiles, accesos y log', description: 'Descripción del módulo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({ example: '/sec', description: 'Ruta de acceso al módulo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ruta?: string;

  @ApiProperty({ example: 1, description: 'Estatus activo/inactivo', required: false })
  @IsOptional()
  @IsInt()
  estatus?: number;
}
