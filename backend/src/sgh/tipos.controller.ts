import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';
import { CreateTipoActividadDto, UpdateTipoActividadDto } from './dto/tipo-actividad.dto';

@ApiTags('SGH - Tipos de Actividad')
@Controller('sgh/tipos')
export class TiposController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllTipos(act);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneTipo(id);
  }

  @Post()
  create(@Body() dto: CreateTipoActividadDto) {
    return this.catalogos.createTipo(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTipoActividadDto) {
    return this.catalogos.updateTipo(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeTipo(id);
  }
}
