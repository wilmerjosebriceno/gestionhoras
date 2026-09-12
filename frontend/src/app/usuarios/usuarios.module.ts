import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { UsuariosListComponent } from './usuarios-list/usuarios-list.component';
import { UsuariosFormComponent } from './usuarios-form/usuarios-form.component';

const routes: Routes = [
  { path: '', component: UsuariosListComponent },
  { path: 'nuevo', component: UsuariosFormComponent },
  { path: ':login', component: UsuariosFormComponent },
];

@NgModule({
  declarations: [UsuariosListComponent, UsuariosFormComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class UsuariosModule {}
