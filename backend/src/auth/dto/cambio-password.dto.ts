import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambioPasswordDto {
  @ApiProperty({ example: 'MiViejaPass1', description: 'Contraseña actual' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  passwordActual: string;

  @ApiProperty({ example: 'MiNuevaPass1', description: 'Nueva contraseña' })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener mayúsculas, minúsculas y números',
  })
  passwordNuevo: string;

  @ApiProperty({ example: 'MiNuevaPass1', description: 'Confirmación de la nueva contraseña' })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  passwordConfirmacion: string;
}
