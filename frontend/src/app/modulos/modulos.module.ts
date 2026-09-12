import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ModulosDashboardComponent } from './modulos-dashboard/modulos-dashboard.component';
import { ModuloPlaceholderComponent } from './modulo-placeholder/modulo-placeholder.component';

const routes: Routes = [
  { path: '', component: ModulosDashboardComponent },
  { path: 'sfv', component: ModuloPlaceholderComponent },
  { path: 'siv', component: ModuloPlaceholderComponent },
  { path: 'lab', component: ModuloPlaceholderComponent },
];

@NgModule({
  declarations: [ModulosDashboardComponent, ModuloPlaceholderComponent],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class ModulosModule {}
