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
import { CreateProcesoDto, UpdateProcesoDto } from './dto/proceso.dto';

@ApiTags('SGH - Procesos')
@Controller('sgh/procesos')
export class ProcesosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllProcesos(act);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneProceso(id);
  }

  @Post()
  create(@Body() dto: CreateProcesoDto) {
    return this.catalogos.createProceso(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProcesoDto) {
    return this.catalogos.updateProceso(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeProceso(id);
  }
}
