import { ApiProperty } from '@nestjs/swagger';

export class RegistrarLogDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'UUID del usuario', required: false })
  idUser?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'UUID del evento', required: false })
  idEvento?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'UUID del acceso', required: false })
  idAcceso?: string;

  @ApiProperty({ example: 'CRITICO', description: 'Nombre del evento' })
  evento: string;

  @ApiProperty({ example: 'INICIO DE SESION EXITOSO', description: 'Descripción del log' })
  nota: string;

  @ApiProperty({ example: '192.168.1.1', description: 'Dirección IP' })
  tcpip: string;

  @ApiProperty({ example: 'Mozilla/5.0...', description: 'User-Agent del navegador', required: false })
  userAgent?: string;

  @ApiProperty({ example: 0, description: 'Estatus de bloqueo (0=normal, 1=bloqueado)', required: false })
  estblk?: number;
}
