import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGrupoDto {
  @ApiProperty({ example: 'ADMINISTRADORES', description: 'Nombre único del grupo' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  grupo: string;

  @ApiProperty({ example: 'Administradores del Sistema', description: 'Descripción del grupo' })
  @IsString()
  @MaxLength(80)
  denominacion: string;
}
