import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SistemasService } from './sistemas.service';
import { CreateSistemaDto } from './dto/create-sistema.dto';
import { UpdateSistemaDto } from './dto/update-sistema.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Sistemas')
@Controller('sistemas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SistemasController {
  constructor(private readonly sistemasService: SistemasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear sistema' })
  @ApiResponse({ status: 201, description: 'Sistema creado' })
  @ApiResponse({ status: 409, description: 'El sistema ya existe' })
  create(@Body() dto: CreateSistemaDto) {
    return this.sistemasService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar sistemas' })
  findAll() {
    return this.sistemasService.findAll();
  }

  @Get(':sistema')
  @ApiOperation({ summary: 'Obtener sistema por codigo' })
  findOne(@Param('sistema') sistema: string) {
    return this.sistemasService.findOne(sistema);
  }

  @Put(':sistema')
  @ApiOperation({ summary: 'Actualizar sistema' })
  update(@Param('sistema') sistema: string, @Body() dto: UpdateSistemaDto) {
    return this.sistemasService.update(sistema, dto);
  }

  @Delete(':sistema')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar sistema' })
  remove(@Param('sistema') sistema: string) {
    return this.sistemasService.remove(sistema);
  }
}
