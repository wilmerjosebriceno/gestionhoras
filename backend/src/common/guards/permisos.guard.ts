import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIERE_PERMISO_KEY, PermisoOptions } from '../decorators/requiere-permiso.decorator';
import { PermisosService } from '../../permisos/permisos.service';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosService: PermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permisoOptions = this.reflector.getAllAndOverride<PermisoOptions>(
      REQUIERE_PERMISO_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permisoOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const tienePermiso = await this.permisosService.verificarPermiso(
      user.login,
      permisoOptions.sistema,
      permisoOptions.pagina,
      permisoOptions.permiso || 'acceso',
    );

    if (!tienePermiso) {
      throw new ForbiddenException(
        `No tiene permiso de ${permisoOptions.permiso || 'acceso'} para esta página`,
      );
    }

    return true;
  }
}
