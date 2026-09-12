import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { PermisosUsuarioComponent } from './permisos-usuario/permisos-usuario.component';
import { PermisosGridComponent } from './permisos-grupo/permisos-grid.component';
import { SharedModule } from '../shared/shared.module';

const routes: Routes = [
  { path: '', component: PermisosUsuarioComponent },
];

@NgModule({
  declarations: [PermisosUsuarioComponent, PermisosGridComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), SharedModule],
})
export class PermisosModule {}
