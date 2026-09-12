import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'SOFTBRI', description: 'Nombre de usuario' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  login: string;

  @ApiProperty({ example: 'SigespAdmin2026!', description: 'Contraseña del usuario' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  password: string;
}
