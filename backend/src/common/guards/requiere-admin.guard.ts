import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIERE_ADMIN_KEY } from '../decorators/requiere-admin.decorator';

@Injectable()
export class RequiereAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiereAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIERE_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiereAdmin) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user;
    if (!user || user.adminUser !== 1) {
      throw new ForbiddenException(
        'Solo el administrador del sistema puede ejecutar esta acción',
      );
    }

    return true;
  }
}
