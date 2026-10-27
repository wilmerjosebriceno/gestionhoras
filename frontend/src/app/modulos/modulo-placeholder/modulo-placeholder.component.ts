import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SistemaService } from '../../core/services/sistema.service';

@Component({
  selector: 'app-modulo-placeholder',
  standalone: false,
  templateUrl: './modulo-placeholder.component.html',
})
export class ModuloPlaceholderComponent implements OnInit {
  modulo: string = '';
  denominacion: string = 'Módulo';
  icono: string = '/icons/software.png';
  cargando = false;
  error = '';

  private readonly ICONS: Record<string, string> = {
    SFV: '/icons/facturacion.svg',
    SIV: '/icons/inventario.svg',
    LAB: '/icons/laboratory.jpg',
    SEC: '/icons/seguridad.svg',
    SGH: '/icons/documents.svg',
    COT: '/icons/cotizacion.png',
    SOP: '/icons/soporte.jpeg',
  };

  constructor(private service: SistemaService, private router: Router) {}

  ngOnInit(): void {
    const seg = window.location.pathname.split('/')[1] || '';
    this.modulo = seg.toUpperCase();
    this.icono = this.ICONS[this.modulo] || '/icons/software.png';
    this.cargando = true;
    this.service.findAll()
      .pipe(
        timeout(15000),
        catchError((err) => throwError(() => err)),
      )
      .subscribe({
        next: (sistemas) => {
          const s = sistemas.find((x) => x.sistema === this.modulo);
          if (s) this.denominacion = s.denominacion;
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          const msg = err.error?.message || err.message;
          this.error = Array.isArray(msg) ? msg.join('. ') : (msg || 'Error al cargar el módulo');
        },
      });
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}
