import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { SghDashboardComponent } from './sgh-dashboard/sgh-dashboard.component';
import { ProyectosListComponent } from './proyectos/proyectos-list.component';
import { ProyectosFormComponent } from './proyectos/proyectos-form.component';
import { ProyectoDetalleComponent } from './proyectos/proyecto-detalle.component';
import { ActividadesListComponent } from './actividades/actividades-list.component';
import { ActividadFormComponent } from './actividades/actividad-form.component';
import { ClientePickerComponent } from './actividades/cliente-picker/cliente-picker.component';
import { DetalleHorasComponent } from './actividades/detalle-horas/detalle-horas.component';
import { ActividadFormService } from './actividades/actividad-form.service';
import { CatalogosComponent } from './catalogos/catalogos.component';
import { EstructuraComponent } from './estructura/estructura.component';
import { CronogramaComponent } from './cronograma/cronograma.component';
import { ReportesComponent } from './reportes/reportes.component';
import { LogosComponent } from './logos/logos.component';
import { MonitorHorasComponent } from './monitor-horas/monitor-horas.component';
import { ConsultaMonitorHorasComponent } from './consulta-monitor-horas/consulta-monitor-horas.component';
import { MantisReportesComponent } from './mantis-reportes/mantis-reportes.component';

const routes: Routes = [
  { path: '', component: SghDashboardComponent },
  { path: 'proyectos', component: ProyectosListComponent },
  { path: 'proyectos/nuevo', component: ProyectosFormComponent },
  { path: 'proyectos/:id/editar', component: ProyectosFormComponent },
  { path: 'proyectos/:id', component: ProyectoDetalleComponent },
  { path: 'actividades', component: ActividadesListComponent },
  { path: 'actividades/nuevo', component: ActividadFormComponent },
  { path: 'actividades/:id', component: ActividadFormComponent },
  { path: 'catalogos', redirectTo: 'catalogos/clientes', pathMatch: 'full' },
  { path: 'catalogos/:tipo', component: CatalogosComponent },
  { path: 'estructura', component: EstructuraComponent },
  { path: 'cronograma/:idProyect', component: CronogramaComponent },
  { path: 'reportes', component: ReportesComponent },
  { path: 'monitor-horas', component: MonitorHorasComponent },
  { path: 'monitor-horas-consulta', component: ConsultaMonitorHorasComponent },
  { path: 'mantis-reportes', component: MantisReportesComponent },
  { path: 'logos', component: LogosComponent },
];

@NgModule({
  declarations: [
    SghDashboardComponent,
    ProyectosListComponent,
    ProyectosFormComponent,
    ProyectoDetalleComponent,
    ActividadesListComponent,
    ActividadFormComponent,
    ClientePickerComponent,
    DetalleHorasComponent,
    CatalogosComponent,
    EstructuraComponent,
    CronogramaComponent,
    ReportesComponent,
    LogosComponent,
    MonitorHorasComponent,
    ConsultaMonitorHorasComponent,
    MantisReportesComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), SharedModule],
  providers: [ActividadFormService],
})
export class SghModule {}
