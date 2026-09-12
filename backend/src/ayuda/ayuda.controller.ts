import { Controller, Get, Param } from '@nestjs/common';
import { AyudaService, AyudaContenido, AyudaIndice } from './ayuda.service';

@Controller('ayuda')
export class AyudaController {
  constructor(private readonly service: AyudaService) {}

  @Get('indice')
  getIndice(): AyudaIndice[] {
    return this.service.getIndice();
  }

  @Get(':sistema/:pagina')
  get(@Param('sistema') sistema: string, @Param('pagina') pagina: string): AyudaContenido {
    return this.service.getAyuda(sistema, pagina);
  }
}
