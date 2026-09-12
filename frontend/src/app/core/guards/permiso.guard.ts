import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { PermisoService } from '../services/permiso.service';
import { buscarPermisoDeRuta } from '../config/permisos.map';

@Injectable({ providedIn: 'root' })
export class PermisoGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private permisoService: PermisoService,
    private router: Router,
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<boolean> | boolean {
    const usuario = this.authService.currentUser;
    if (!usuario) return false;

    // El administrador tiene acceso a todo
    if (usuario.adminUser === 1) return true;

    const ruta = buscarPermisoDeRuta(state.url);
    if (!ruta) return true; // rutas sin permiso mapeado se permiten

    return this.permisoService.verificarPermiso(ruta.pagina, ruta.sistema).pipe(
      map((res) => {
        if (res.tienePermiso) return true;

        // Ruta raiz del modulo: se permite si el usuario tiene AL MENOS un
        // permiso dentro de ese sistema (asi el sidebar filtrado es operable).
        if (esRaizModulo(state.url, ruta.sistema)) {
          return this.tieneAlgunPermiso(ruta.sistema);
        }

        this.router.navigate(['/sin-acceso']);
        return false;
      }),
      catchError(() => {
        this.router.navigate(['/sin-acceso']);
        return of(false);
      }),
    );
  }

  private tieneAlgunPermiso(sistema: string): boolean {
    const permisos = this.authService.permisosCacheados;
    return permisos?.some((p) => p.sistema === sistema && p.acceso) ?? false;
  }
}

function esRaizModulo(url: string, sistema: string): boolean {
  const path = url.split('?')[0].replace(/^\//, '').replace(/\/+$/, '');
  return path.toLowerCase() === sistema.toLowerCase();
}