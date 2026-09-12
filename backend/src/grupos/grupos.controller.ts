import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GruposService } from './grupos.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { AsignarUsuariosDto } from './dto/asignar-usuarios.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequierePermiso } from '../common/decorators/requiere-permiso.decorator';
import { Audit } from '../common/interceptors/audit.interceptor';

@ApiTags('Grupos')
@Controller('grupos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Post()
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_grupo.html.php', permiso: 'insertar' })
  @Audit({ evento: 'CREAR_GRUPO', sistema: 'SEC' })
  @ApiOperation({ summary: 'Crear grupo', description: 'Crea un nuevo grupo de usuarios' })
  @ApiResponse({ status: 201, description: 'Grupo creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El grupo ya existe' })
  create(@Body() dto: CreateGrupoDto) {
    return this.gruposService.create(dto);
  }

  @Get()
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_grupo.html.php', permiso: 'seleccionar' })
  @ApiOperation({ summary: 'Listar grupos', description: 'Obtiene todos los grupos del sistema' })
  findAll() {
    return this.gruposService.findAll();
  }

  @Get(':grupo')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_grupo.html.php', permiso: 'seleccionar' })
  @ApiOperation({ summary: 'Obtener grupo', description: 'Obtiene los datos de un grupo por su nombre' })
  @ApiResponse({ status: 200, description: 'Datos del grupo' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  findOne(@Param('grupo') grupo: string) {
    return this.gruposService.findOne(grupo);
  }

  @Put(':grupo')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_grupo.html.php', permiso: 'actualizar' })
  @Audit({ evento: 'ACTUALIZAR_GRUPO', sistema: 'SEC' })
  @ApiOperation({ summary: 'Actualizar grupo', description: 'Actualiza la denominación de un grupo' })
  @ApiResponse({ status: 200, description: 'Grupo actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  update(@Param('grupo') grupo: string, @Body() dto: UpdateGrupoDto) {
    return this.gruposService.update(grupo, dto);
  }

  @Delete(':grupo')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_grupo.html.php', permiso: 'eliminar' })
  @Audit({ evento: 'ELIMINAR_GRUPO', sistema: 'SEC' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar grupo', description: 'Elimina un grupo del sistema' })
  @ApiResponse({ status: 204, description: 'Grupo eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  @ApiResponse({ status: 409, description: 'El grupo no puede ser eliminado (tiene usuarios asociados)' })
  remove(@Param('grupo') grupo: string) {
    return this.gruposService.remove(grupo);
  }

  @Post(':grupo/usuarios')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_pro_asignacion_grupos.html.php', permiso: 'actualizar' })
  @Audit({ evento: 'ASIGNAR_USUARIOS_GRUPO', sistema: 'SEC' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Asignar usuarios', description: 'Asigna una lista de usuarios a un grupo' })
  @ApiResponse({ status: 200, description: 'Usuarios asignados exitosamente' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  asignarUsuarios(
    @Param('grupo') grupo: string,
    @Body() dto: AsignarUsuariosDto,
  ) {
    return this.gruposService.asignarUsuarios(grupo, dto.logins);
  }
}
