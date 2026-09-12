import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EstructuraService } from './estructura.service';
import { GuardarAsignacionDto } from './dto/estructura.dto';

@ApiTags('SGH - Estructura de Proyecto')
@Controller('sgh/estructura')
export class EstructuraController {
  constructor(private readonly estructura: EstructuraService) {}

  @Get()
  getData() {
    return this.estructura.getdataEstructure();
  }

  @Get('items-activos')
  itemsActivos() {
    return this.estructura.itemsActivos();
  }

  @Get('asignacion')
  getAsignacion(@Query('idItemActivity', ParseIntPipe) idItemActivity: number) {
    return this.estructura.getAsignacion(idItemActivity);
  }

  @Post('asignacion')
  guardarAsignacion(@Body() dto: GuardarAsignacionDto) {
    return this.estructura.guardarAsignaciones(dto);
  }

  @Get('asignacion/:idItem/desactivar')
  desactivar(
    @Param('idItem', ParseIntPipe) idItemActivity: number,
    @Query('idProcess', ParseIntPipe) idProcess: number,
  ) {
    return this.estructura.desactivarOtras(idItemActivity, idProcess);
  }
}
