import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'SOFTBRI', description: 'Nombre de usuario' })
  @IsString()
  @MaxLength(50)
  login: string;
}
