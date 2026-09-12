import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
  { path: 'usuarios', loadChildren: () => import('../usuarios/usuarios.module').then((m) => m.UsuariosModule) },
  { path: 'grupos', loadChildren: () => import('../grupos/grupos.module').then((m) => m.GruposModule) },
  { path: 'sistemas', loadChildren: () => import('../sistemas/sistemas.module').then((m) => m.SistemasModule) },
  { path: 'permisos', loadChildren: () => import('../permisos/permisos.module').then((m) => m.PermisosModule) },
  { path: 'auditoria', loadChildren: () => import('../auditoria/auditoria.module').then((m) => m.AuditoriaModule) },
  { path: 'cambio-password', loadChildren: () => import('./cambio-password/cambio-password.module').then((m) => m.CambioPasswordModule) },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class SecModule {}