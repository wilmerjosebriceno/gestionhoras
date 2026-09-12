import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AuditoriaLogsComponent } from './auditoria-logs/auditoria-logs.component';
import { SharedModule } from '../shared/shared.module';

const routes: Routes = [
  { path: '', component: AuditoriaLogsComponent },
];

@NgModule({
  declarations: [AuditoriaLogsComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), SharedModule],
})
export class AuditoriaModule {}
