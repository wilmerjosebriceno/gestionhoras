import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarUsuariosDto {
  @ApiProperty({ example: ['SOFTBRI', 'USUARIO2'], description: 'Lista de logins a asignar al grupo' })
  @IsArray()
  @IsString({ each: true })
  logins: string[];
}
