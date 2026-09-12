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
import { CreateItemActividadDto, UpdateItemActividadDto } from './dto/item-actividad.dto';

@ApiTags('SGH - Items de Actividad')
@Controller('sgh/items')
export class ItemsController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllItems(act);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneItem(id);
  }

  @Post()
  create(@Body() dto: CreateItemActividadDto) {
    return this.catalogos.createItem(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemActividadDto) {
    return this.catalogos.updateItem(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeItem(id);
  }
}
