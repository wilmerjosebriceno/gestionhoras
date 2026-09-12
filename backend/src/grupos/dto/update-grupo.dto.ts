import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGrupoDto {
  @ApiProperty({ example: 'Administradores generales', description: 'Nueva descripción del grupo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  denominacion?: string;
}
