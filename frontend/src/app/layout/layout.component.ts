import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { AuthResponse } from '../core/models/auth.model';
import { MENUS, ModuleMenu } from '../core/config/menu.config';
import { buscarPermisoDeRuta } from '../core/config/permisos.map';
import { AyudaContextoService } from '../core/services/ayuda-contexto.service';
import { HelpPanelComponent } from '../core/components/help-panel/help-panel.component';

@Component({
  selector: 'app-layout',
  standalone: false,
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, OnDestroy {
  usuario: AuthResponse['usuario'] | null = null;
  menu: ModuleMenu | null = null;
  titulo = '';
  esDashboard = false;
  private sub = new Subscription();
  private accesos: Set<string> = new Set();

  // Ayuda en linea contextual
  helpVisible = false;
  helpSistema = '';
  helpPagina = '';
  helpTitulo = '';

  constructor(private authService: AuthService, private router: Router, private ayudaCtx: AyudaContextoService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((u) => (this.usuario = u));
    this.cargarPermisos();
    this.actualizarMenu(this.router.url);
    this.sub.add(
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
        this.actualizarMenu((e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url);
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private cargarPermisos(): void {
    const usuario = this.authService.currentUser;
    if (!usuario) return;

    if (usuario.adminUser === 1) {
      this.accesos.clear(); // admin: todo permitido (Set vacio = sin filtro)
      return;
    }

    this.authService.misPermisos().subscribe({
      next: (res) => {
        this.accesos = new Set(
          res.permisos.filter((p) => p.acceso).map((p) => `${p.sistema}/${p.pagina}`),
        );
        this.actualizarMenu(this.router.url);
      },
      error: () => (this.accesos = new Set()),
    });
  }

  private tieneAcceso(pagina: string, sistema: string): boolean {
    if (this.usuario?.adminUser === 1) return true;
    return this.accesos.has(`${sistema}/${pagina}`);
  }

  private itemPermitido(item: { route?: string; url?: string }): boolean {
    if (item.route) {
      const permiso = buscarPermisoDeRuta(item.route);
      if (!permiso) return true; // sin pagina mapeada -> se muestra
      return this.tieneAcceso(permiso.pagina, permiso.sistema);
    }
    // legacy (url externa): solo se muestra si hay BASE configurada (no vacía)
    return !!item.url;
  }

  private actualizarModulo(url: string): string {
    const seg = (url.split('?')[0].split('/')[1] || '').toUpperCase();
    // El modulo de Soporte vive en /soporte/... pero su sistema es 'SOP'.
    const ALIAS: Record<string, string> = { SOPORTE: 'SOP' };
    return ALIAS[seg] ?? seg;
  }

  private actualizarMenu(url: string): void {
    const modulo = this.actualizarModulo(url);
    const base = MENUS.find((m) => m.sistema === modulo) ?? null;
    this.menu = base ? { ...base, grupos: base.grupos.map((g) => ({
      ...g,
      items: g.items.filter((i) => this.itemPermitido(i)),
    })) } : null;
    this.titulo = this.menu?.titulo || '';
    this.esDashboard = (url.split('?')[0] === '/');
  }

  logout(): void {
    this.authService.logout().subscribe({ next: () => this.clearSession(), error: () => this.clearSession() });
  }

  abrirAyuda(): void {
    // Contexto explicito (pantallas sin ruta propia, p. ej. pestañas GPI)
    if (this.ayudaCtx.pagina && this.ayudaCtx.sistema) {
      this.helpSistema = this.ayudaCtx.sistema;
      this.helpPagina = this.ayudaCtx.pagina;
      this.helpTitulo = this.titulo;
      this.helpVisible = true;
      return;
    }
    const permiso = buscarPermisoDeRuta(this.router.url);
    if (!permiso) {
      this.helpSistema = '';
      this.helpPagina = '';
      this.helpVisible = true; // mostraremos mensaje generico
      return;
    }
    this.helpSistema = permiso.sistema;
    this.helpPagina = permiso.pagina;
    this.helpTitulo = this.titulo;
    this.helpVisible = true;
  }

  cerrarAyuda(): void {
    this.helpVisible = false;
  }

  private clearSession(): void {
    this.authService.clearSession();
    this.router.navigate(['/login']);
  }
}