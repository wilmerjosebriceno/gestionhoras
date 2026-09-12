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
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@ApiTags('SGH - Clientes')
@Controller('sgh/clientes')
export class ClientesController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  findAll(@Query('active') active?: string, @Query('filtro') filtro?: string) {
    const act = active !== undefined ? Number(active) : undefined;
    return this.catalogos.findAllClientes(act, filtro);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.findOneCliente(id);
  }

  @Get(':id/proyectos')
  proyectosActivos(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.proyectosActivosDelCliente(id);
  }

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.catalogos.createCliente(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClienteDto) {
    return this.catalogos.updateCliente(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogos.removeCliente(id);
  }
}
