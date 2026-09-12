import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PermisosService, ArbolItem } from './permisos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Permisos')
@Controller('permisos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get('sistemas')
  @ApiOperation({ summary: 'Listar sistemas' })
  getSistemas() {
    return this.permisosService.getSistemas();
  }

  @Get('arbol/:sistema')
  @ApiOperation({ summary: 'Obtener arbol de paginas XML como JSON' })
  getArbol(@Param('sistema') sistema: string): Promise<ArbolItem[]> {
    return this.permisosService.getArbol(sistema);
  }

  @Get('listar/usuarios')
  @ApiOperation({ summary: 'Listar usuarios activos' })
  getUsuarios() {
    return this.permisosService.getListarUsuarios();
  }

  @Get('listar/grupos')
  @ApiOperation({ summary: 'Listar grupos' })
  getGrupos() {
    return this.permisosService.getListarGrupos();
  }

  @Get('usuario/:login')
  @ApiOperation({ summary: 'Obtener permisos de un usuario' })
  @ApiQuery({ name: 'sistema', required: false })
  getPermisosUsuario(@Param('login') login: string, @Query('sistema') sistema?: string) {
    return this.permisosService.getPermisosUsuario(login, sistema);
  }

  @Get('grupo/:grupo')
  @ApiOperation({ summary: 'Obtener permisos de un grupo' })
  @ApiQuery({ name: 'sistema', required: false })
  getPermisosGrupo(@Param('grupo') grupo: string, @Query('sistema') sistema?: string) {
    return this.permisosService.getPermisosGrupo(grupo, sistema);
  }

  @Post('guardar')
  @ApiOperation({ summary: 'Guardar permisos (batch)' })
  @ApiResponse({ status: 201, description: 'Permisos guardados' })
  guardarPermisos(
    @Body() dto: {
      tipo: 'U' | 'G';
      sistema: string;
      logins?: string[];
      grupos?: string[];
      permisos: Array<{
        pagina: string;
        denpagina?: string;
        acceso?: number;
        seleccionar?: number;
        insertar?: number;
        actualizar?: number;
        eliminar?: number;
        ejecutar?: number;
        imprimir?: number;
        anular?: number;
      }>;
    },
  ) {
    return this.permisosService.guardarPermisos(dto);
  }

  @Get('verificar/:pagina')
  @ApiOperation({ summary: 'Verificar permiso del usuario autenticado' })
  @ApiQuery({ name: 'sistema', required: false })
  async verificarPermiso(
    @CurrentUser('login') login: string,
    @Param('pagina') pagina: string,
    @Query('sistema') sistema: string = 'SEC',
    @Query('permiso') permiso: string = 'acceso',
  ) {
    const tienePermiso = await this.permisosService.verificarPermiso(login, sistema, pagina, permiso);
    return { tienePermiso };
  }
}
