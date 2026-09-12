import { NgModule, provideZoneChangeDetection } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { AuthGuard } from './core/guards/auth.guard';
import { PermisoGuard } from './core/guards/permiso.guard';
import { SinAccesoComponent } from './core/pages/sin-acceso/sin-acceso.component';
import { LayoutComponent } from './layout/layout.component';
import { HelpPanelComponent } from './core/components/help-panel/help-panel.component';
import { AppComponent } from './app.component';

const routes: Routes = [
  { path: 'login', loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', loadChildren: () => import('./modulos/modulos.module').then((m) => m.ModulosModule) },
      { path: 'sec', canActivate: [PermisoGuard], loadChildren: () => import('./sec/sec.module').then((m) => m.SecModule) },
      { path: 'sgh', canActivate: [PermisoGuard], loadChildren: () => import('./sgh/sgh.module').then((m) => m.SghModule) },
      { path: 'cot', canActivate: [PermisoGuard], loadChildren: () => import('./cotizaciones/cotizaciones.module').then((m) => m.CotizacionesModule) },
      { path: 'sin-acceso', component: SinAccesoComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  declarations: [AppComponent, LayoutComponent, SinAccesoComponent, HelpPanelComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot(routes),
  ],
  providers: [
    provideZoneChangeDetection(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
