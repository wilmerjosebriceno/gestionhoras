import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CambioPasswordDto } from './dto/cambio-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Audit } from '../common/interceptors/audit.interceptor';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 900000 } })
  @ApiOperation({ summary: 'Iniciar sesión', description: 'Autentica un usuario y devuelve tokens JWT' })
  @ApiResponse({ status: 200, description: 'Login exitoso. Retorna accessToken, refreshToken y datos del usuario.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 403, description: 'Cuenta bloqueada temporalmente' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Renovar tokens', description: 'Obtiene un nuevo accessToken usando el refreshToken' })
  @ApiResponse({ status: 200, description: 'Tokens renovados exitosamente' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(@CurrentUser('login') login: string) {
    return this.authService.refreshTokens(login);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión', description: 'Invalida el refreshToken del usuario' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async logout(@CurrentUser('login') login: string) {
    return this.authService.logout(login);
  }

  @Post('mis-permisos')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Permisos del usuario autenticado', description: 'Devuelve qué páginas/componentes puede acceder el usuario' })
  @ApiResponse({ status: 200, description: 'Lista de permisos del usuario' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async misPermisos(@CurrentUser('login') login: string) {
    return this.authService.misPermisos(login);
  }

  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar contraseña', description: 'Cambia la contraseña del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Las contraseñas no coinciden' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Audit({ evento: 'CAMBIO_PASSWORD', sistema: 'SEC' })
  async cambiarPassword(
    @CurrentUser('login') login: string,
    @Body() dto: CambioPasswordDto,
  ) {
    return this.authService.cambiarPassword(login, dto);
  }
}
