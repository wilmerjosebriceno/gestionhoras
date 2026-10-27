import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SistemaService } from '../../core/services/sistema.service';
import { Sistema } from '../../core/models/sistema.model';
import { AuthService } from '../../core/services/auth.service';

const ICONS: Record<string, string> = {
  SFV: '/icons/facturacion.svg',
  SIV: '/icons/inventario.svg',
  LAB: '/icons/laboratory.jpg',
  SEC: '/icons/seguridad.svg',
  SGH: '/icons/documents.svg',
  COT: '/icons/cotizacion.png',
  SOP: '/icons/soporte.jpeg',
};

@Component({
  selector: 'app-modulos-dashboard',
  standalone: false,
  templateUrl: './modulos-dashboard.component.html',
})
export class ModulosDashboardComponent implements OnInit {
  modulos: Sistema[] = [];
  loading = false;
  error = '';

  constructor(
    private service: SistemaService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    this.service.findAll()
      .pipe(
        timeout(15000),
        catchError((err) => throwError(() => err)),
      )
      .subscribe({
        next: (s) => {
          const usuario = this.authService.currentUser;
          let modulos = s.filter((m) => m.estatus !== 0);

          // Si no es admin: cargar permisos (si aun no) y filtrar sistemas
          if (usuario && usuario.adminUser !== 1) {
            if (!this.authService.permisosCacheados) {
              this.authService.misPermisos().subscribe({
                next: () => this.aplicarFiltro(modulos),
                error: () => { this.modulos = []; this.loading = false; },
              });
              return;
            }
            this.aplicarFiltro(modulos);
            return;
          }

          this.modulos = modulos;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.message || err.message;
          this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al cargar los módulos');
        },
      });
  }

  private aplicarFiltro(modulos: Sistema[]): void {
    const sistemasAcceso = new Set<string>();
    const permisos = this.authService.permisosCacheados;
    if (permisos) {
      for (const p of permisos) if (p.sistema) sistemasAcceso.add(p.sistema);
    }
    this.modulos = modulos.filter((m) => sistemasAcceso.has(m.sistema));
    this.loading = false;
  }

  icono(modulo: Sistema): string {
    return ICONS[modulo.sistema] || '/icons/software.png';
  }

  ir(modulo: Sistema): void {
    const ruta = modulo.ruta || `/${modulo.sistema.toLowerCase()}`;
    this.router.navigateByUrl(ruta);
  }
}
