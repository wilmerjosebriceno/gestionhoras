import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ProyectosListaComponent } from './proyectos/proyectos-lista.component';
import { ProyectoDetalleComponent } from './proyecto-detalle/proyecto-detalle.component';
import { RecursosComponent } from './recursos/recursos.component';
import { RolesComponent } from './roles/roles.component';
import { GpiGanttComponent } from './gantt/gantt.component';
import { GpiCargaComponent } from './carga/carga.component';
import { GpiCalendarioComponent } from './calendario/calendario.component';
import { GpiDashboardComponent } from './dashboard/dashboard.component';

const routes: Routes = [
  { path: '', redirectTo: 'proyectos', pathMatch: 'full' },
  { path: 'dashboard', component: GpiDashboardComponent },
  { path: 'proyectos', component: ProyectosListaComponent },
  { path: 'proyectos/:id', component: ProyectoDetalleComponent },
  { path: 'recursos', component: RecursosComponent },
  { path: 'roles', component: RolesComponent },
];

@NgModule({
  declarations: [
    ProyectosListaComponent,
    ProyectoDetalleComponent,
    RecursosComponent,
    RolesComponent,
    GpiGanttComponent,
    GpiCargaComponent,
    GpiCalendarioComponent,
    GpiDashboardComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class GpiModule {}
