import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { CambioPasswordComponent } from './cambio-password.component';

const routes: Routes = [{ path: '', component: CambioPasswordComponent }];

@NgModule({
  declarations: [CambioPasswordComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class CambioPasswordModule {}
