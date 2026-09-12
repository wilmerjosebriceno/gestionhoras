import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { QueryUsuarioDto } from './dto/query-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequierePermiso } from '../common/decorators/requiere-permiso.decorator';
import { RequiereAdmin } from '../common/decorators/requiere-admin.decorator';
import { Audit } from '../common/interceptors/audit.interceptor';

@ApiTags('Usuarios')
@Controller('usuarios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'insertar' })
  @Audit({ evento: 'CREAR_USUARIO', sistema: 'SEC' })
  @ApiOperation({ summary: 'Crear usuario', description: 'Crea un nuevo usuario en el sistema' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El usuario ya existe' })
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Get()
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'seleccionar' })
  @ApiOperation({ summary: 'Listar usuarios', description: 'Obtiene lista paginada de usuarios con filtros opcionales' })
  @ApiQuery({ name: 'login', required: false, description: 'Filtrar por login (LIKE)' })
  @ApiQuery({ name: 'nombres', required: false, description: 'Filtrar por nombres (LIKE)' })
  @ApiQuery({ name: 'apellidos', required: false, description: 'Filtrar por apellidos (LIKE)' })
  @ApiQuery({ name: 'email', required: false, description: 'Filtrar por email (LIKE)' })
  @ApiQuery({ name: 'estatus', required: false, description: 'Filtrar por estatus (1=activo, 0=inactivo)' })
  @ApiQuery({ name: 'grupo', required: false, description: 'Filtrar por grupo' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Resultados por página' })
  findAll(@Query() query: QueryUsuarioDto) {
    return this.usuariosService.findAll(query);
  }

  @Get(':login')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'seleccionar' })
  @ApiOperation({ summary: 'Obtener usuario', description: 'Obtiene los datos de un usuario por su login' })
  @ApiResponse({ status: 200, description: 'Datos del usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('login') login: string) {
    return this.usuariosService.findOne(login);
  }

  @Put(':login')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'actualizar' })
  @Audit({ evento: 'ACTUALIZAR_USUARIO', sistema: 'SEC' })
  @ApiOperation({ summary: 'Actualizar usuario', description: 'Actualiza los datos de un usuario existente' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  update(@Param('login') login: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(login, dto);
  }

  @Delete(':login')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'eliminar' })
  @Audit({ evento: 'ELIMINAR_USUARIO', sistema: 'SEC' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar usuario', description: 'Elimina un usuario del sistema' })
  @ApiResponse({ status: 204, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'El usuario no puede ser eliminado (nodelete=1)' })
  remove(@Param('login') login: string) {
    return this.usuariosService.remove(login);
  }

  @Post(':login/reset-password')
  @RequiereAdmin()
  @Audit({ evento: 'RESET_PASSWORD', sistema: 'SEC' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resetear contraseña', description: 'Reinicia la contraseña de un usuario a "123" (solo administrador)' })
  @ApiResponse({ status: 200, description: 'Contraseña reseteada exitosamente' })
  @ApiResponse({ status: 403, description: 'Solo el administrador puede resetear contraseñas' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  resetPassword(@Param('login') login: string) {
    return this.usuariosService.resetPassword(login);
  }

  @Post(':login/desbloquear')
  @RequiereAdmin()
  @Audit({ evento: 'DESBLOQUEAR_USUARIO', sistema: 'SEC' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desbloquear usuario', description: 'Desbloquea la cuenta de un usuario (solo administrador)' })
  @ApiResponse({ status: 200, description: 'Usuario desbloqueado exitosamente' })
  @ApiResponse({ status: 403, description: 'Solo el administrador puede desbloquear usuarios' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  desbloquear(@Param('login') login: string) {
    return this.usuariosService.desbloquear(login);
  }

  @Get(':login/firma')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'seleccionar' })
  @ApiOperation({ summary: 'Obtener firma', description: 'Devuelve la firma digitalizada del usuario como dataUri' })
  @ApiResponse({ status: 200, description: 'Firma del usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  getFirma(@Param('login') login: string) {
    return this.usuariosService.getFirma(login);
  }

  @Post(':login/firma')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'actualizar' })
  @Audit({ evento: 'ACTUALIZAR_FIRMA_USUARIO', sistema: 'SEC' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Subir firma', description: 'Sube/reemplaza la firma digitalizada del usuario (jpg/jpeg/png/gif)' })
  @ApiResponse({ status: 201, description: 'Firma actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @UseInterceptors(FileInterceptor('file'))
  subirFirma(@Param('login') login: string, @UploadedFile() file: any) {
    return this.usuariosService.subirFirma(login, file);
  }

  @Delete(':login/firma')
  @RequierePermiso({ sistema: 'SEC', pagina: 'sec_def_usuario.html.php', permiso: 'actualizar' })
  @Audit({ evento: 'ELIMINAR_FIRMA_USUARIO', sistema: 'SEC' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar firma', description: 'Elimina la firma digitalizada del usuario' })
  @ApiResponse({ status: 200, description: 'Firma eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  eliminarFirma(@Param('login') login: string) {
    return this.usuariosService.eliminarFirma(login);
  }

  @Post('firmas/sincronizar')
  @RequiereAdmin()
  @Audit({ evento: 'SINCRONIZAR_FIRMAS', sistema: 'SEC' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sincronizar firmas', description: 'Backfill: actualiza sec_user.firma desde los archivos en storage/firmas (solo administrador)' })
  @ApiResponse({ status: 200, description: 'Firmas sincronizadas exitosamente' })
  @ApiResponse({ status: 403, description: 'Solo el administrador puede sincronizar firmas' })
  sincronizarFirmas() {
    return this.usuariosService.sincronizarFirmas();
  }
}
