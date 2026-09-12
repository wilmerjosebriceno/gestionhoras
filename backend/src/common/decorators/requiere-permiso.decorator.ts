import { SetMetadata } from '@nestjs/common';

export interface PermisoOptions {
  sistema: string;
  pagina: string;
  permiso?: 'acceso' | 'seleccionar' | 'insertar' | 'actualizar' | 'eliminar' | 'ejecutar' | 'imprimir' | 'anular';
}

export const REQUIERE_PERMISO_KEY = 'requiere_permiso';
export const RequierePermiso = (options: PermisoOptions) =>
  SetMetadata(REQUIERE_PERMISO_KEY, options);
