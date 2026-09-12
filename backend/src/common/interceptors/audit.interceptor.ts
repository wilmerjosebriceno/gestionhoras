import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditoriaService } from '../../auditoria/auditoria.service';

interface AuditConfig {
  evento: string;
  sistema: string;
  pagina?: string;
  omit?: boolean;
}

export function Audit(config: AuditConfig): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('audit_config', config, target, propertyKey);
    return descriptor;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditConfig: AuditConfig | undefined = Reflect.getMetadata('audit_config', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(() => {
        if (auditConfig && !auditConfig.omit) {
          const nota = `${auditConfig.evento} - ${request.method} ${request.route?.path}`;
          const ip = request.ip || request.connection?.remoteAddress || '';

          this.auditoriaService.registrar({
            evento: auditConfig.evento,
            nota,
            tcpip: ip,
            userAgent: request.headers['user-agent'],
          }).catch((err: Error) => {
            if (process.env.NODE_ENV === 'development') {
              console.error('Audit log error:', err.message);
            }
          });
        }
      }),
    );
  }
}
