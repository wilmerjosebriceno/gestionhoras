import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { GruposListComponent } from './grupos-list/grupos-list.component';
import { GruposFormComponent } from './grupos-form/grupos-form.component';

const routes: Routes = [
  { path: '', component: GruposListComponent },
  { path: 'nuevo', component: GruposFormComponent },
  { path: ':grupo', component: GruposFormComponent },
];

@NgModule({
  declarations: [GruposListComponent, GruposFormComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class GruposModule {}
