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
import { CreateUsuarioSghDto, UpdateUsuarioSghDto } from './dto/usuario-sgh.dto';

@ApiTags('SGH - Usuarios')
@Controller('sgh/usuarios')
export class UsuariosSghController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllUsuariosSgh(act);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneUsuarioSgh(id);
  }

  @Post()
  create(@Body() dto: CreateUsuarioSghDto) {
    return this.catalogos.createUsuarioSgh(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioSghDto) {
    return this.catalogos.updateUsuarioSgh(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeUsuarioSgh(id);
  }
}
