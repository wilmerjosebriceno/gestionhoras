import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Cliente } from '../../models/sgh.models';
import { ActividadFormService } from '../actividad-form.service';

/**
 * Picker de cliente: búsqueda por RIF/nombre con grilla de resultados
 * (SRP: solo localiza y selecciona clientes). La cabecera la pinta el padre.
 */
@Component({
  selector: 'app-cliente-picker',
  standalone: false,
  templateUrl: './cliente-picker.component.html',
})
export class ClientePickerComponent {
  @Input() seleccionado: Cliente | null = null;
  @Output() seleccion = new EventEmitter<Cliente | null>();

  rif = '';
  nombre = '';
  resultados: Cliente[] = [];
  buscando = false;

  constructor(private readonly service: ActividadFormService) {}

  buscar(): void {
    const termino = `${this.rif} ${this.nombre}`.trim();
    if (!termino) return;
    this.buscando = true;
    this.service.buscarClientes(termino).subscribe({
      next: (r) => {
        this.resultados = r;
        this.buscando = false;
      },
      error: () => {
        this.resultados = [];
        this.buscando = false;
      },
    });
  }

  elegir(cliente: Cliente): void {
    this.seleccionado = cliente;
    this.resultados = [];
    this.rif = '';
    this.nombre = '';
    this.seleccion.emit(cliente);
  }

  limpiar(): void {
    this.seleccionado = null;
    this.resultados = [];
    this.seleccion.emit(null);
  }
}
