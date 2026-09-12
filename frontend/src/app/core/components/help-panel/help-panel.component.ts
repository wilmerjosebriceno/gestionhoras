import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AyudaService, AyudaContenido } from '../../services/ayuda.service';

@Component({
  selector: 'app-help-panel',
  standalone: false,
  templateUrl: './help-panel.component.html',
})
export class HelpPanelComponent implements OnChanges {
  @Input() visible = false;
  @Input() sistema = '';
  @Input() pagina = '';
  @Input() titulo = '';
  @Output() close = new EventEmitter<void>();

  contenido: AyudaContenido | null = null;
  cargando = false;
  sinContenido = false;
  paginas: string[] = [];
  paginaActual = '';

  constructor(private ayudaService: AyudaService) {}

  ngOnChanges(): void {
    if (this.visible) this.cargar();
  }

  private cargar(): void {
    this.paginaActual = this.pagina;
    if (!this.sistema || !this.pagina) {
      this.cargando = false;
      this.sinContenido = true;
      return;
    }
    this.cargando = true;
    this.sinContenido = false;
    this.contenido = null;
    this.ayudaService.getAyuda(this.sistema, this.pagina).subscribe({
      next: (c) => {
        this.contenido = c;
        this.cargando = false;
      },
      error: (e: HttpErrorResponse) => {
        this.cargando = false;
        this.sinContenido = e.status === 404;
      },
    });
  }

  cerrar(): void {
    this.close.emit();
  }
}
