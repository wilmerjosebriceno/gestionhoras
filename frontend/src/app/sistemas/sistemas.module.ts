import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SistemasListComponent } from './sistemas-list/sistemas-list.component';
import { SistemasFormComponent } from './sistemas-form/sistemas-form.component';
import { SharedModule } from '../shared/shared.module';

const routes: Routes = [
  { path: '', component: SistemasListComponent },
  { path: 'nuevo', component: SistemasFormComponent },
  { path: ':sistema', component: SistemasFormComponent },
];

@NgModule({
  declarations: [SistemasListComponent, SistemasFormComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), SharedModule],
})
export class SistemasModule {}
