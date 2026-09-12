import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { CotizacionesListComponent } from './cotizaciones-list/cotizaciones-list.component';
import { CotizacionesFormComponent } from './cotizaciones-form/cotizaciones-form.component';
import { CotCatalogosComponent } from './cot-catalogos/cot-catalogos.component';
import { DashboardKpisComponent } from './dashboard-kpis/dashboard-kpis.component';

const routes: Routes = [
  { path: '', component: CotizacionesListComponent },
  { path: 'kpis', component: DashboardKpisComponent },
  { path: 'nuevo', component: CotizacionesFormComponent },
  { path: 'catalogos/:tipo', component: CotCatalogosComponent },
  { path: 'editar/:id', component: CotizacionesFormComponent },
  { path: ':id', component: CotizacionesFormComponent },
];

@NgModule({
  declarations: [CotizacionesListComponent, CotizacionesFormComponent, CotCatalogosComponent, DashboardKpisComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), SharedModule],
})
export class CotizacionesModule {}