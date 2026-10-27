import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { TicketsBandejaComponent } from './tickets-bandeja/tickets-bandeja.component';
import { TicketDetalleComponent } from './ticket-detalle/ticket-detalle.component';
import { TicketFormComponent } from './ticket-form/ticket-form.component';
import { MantisDashboardComponent } from './mantis-dashboard/mantis-dashboard.component';
import { MantisSeguimientoComponent } from './mantis-seguimiento/mantis-seguimiento.component';

const routes: Routes = [
  { path: '', redirectTo: 'tickets', pathMatch: 'full' },
  { path: 'tickets', component: TicketsBandejaComponent },
  { path: 'tickets/nuevo', component: TicketFormComponent },
  { path: 'tickets/:id', component: TicketDetalleComponent },
  { path: 'mantis', component: MantisDashboardComponent },
];

@NgModule({
  declarations: [
    TicketsBandejaComponent,
    TicketDetalleComponent,
    TicketFormComponent,
    MantisDashboardComponent,
    MantisSeguimientoComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class SoporteModule {}