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
import { CreateCategoriaDto, UpdateCategoriaDto } from './dto/categoria.dto';

@ApiTags('SGH - Categorías')
@Controller('sgh/categorias')
export class CategoriasController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllCategorias(act);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneCategoria(id);
  }

  @Post()
  create(@Body() dto: CreateCategoriaDto) {
    return this.catalogos.createCategoria(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoriaDto) {
    return this.catalogos.updateCategoria(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeCategoria(id);
  }
}
