import { SetMetadata } from '@nestjs/common';

export const REQUIERE_ADMIN_KEY = 'requiere_admin';
export const RequiereAdmin = () => SetMetadata(REQUIERE_ADMIN_KEY, true);
