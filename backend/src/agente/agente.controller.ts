import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AgenteService } from './agente.service';
import { ChatAgenteDto } from './dto/chat.dto';
import { ContextoHerramienta } from './agente.tipos';

@ApiTags('Agente IA')
@Controller('agente')
@ApiBearerAuth('access-token')
export class AgenteController {
  constructor(private readonly service: AgenteService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Indica si el agente de IA está configurado' })
  estado() {
    return { configurado: this.service.configurado() };
  }

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Conversa con el agente de IA (solo lectura)' })
  chat(@Body() dto: ChatAgenteDto, @Req() req: any) {
    const user = req?.user ?? {};
    const ctx: ContextoHerramienta = {
      login: user.login,
      idUsuario: user.sub,
    };
    return this.service.chat(dto, ctx);
  }
}
