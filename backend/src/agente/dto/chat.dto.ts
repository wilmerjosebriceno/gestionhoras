import { IsArray, IsIn, IsOptional, IsString, MaxLength, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MensajeChatDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  content: string;
}

export class ChatAgenteDto {
  @ApiProperty({ type: [MensajeChatDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MensajeChatDto)
  messages: MensajeChatDto[];

  @ApiPropertyOptional({ description: 'Contexto opcional de la pantalla actual (ruta, id de cotización, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contexto?: string;
}
