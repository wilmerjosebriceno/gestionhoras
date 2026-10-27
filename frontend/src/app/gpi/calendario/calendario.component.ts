import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GpiService } from '../services/gpi.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-gpi-calendario',
  standalone: false,
  templateUrl: './calendario.component.html',
})
export class GpiCalendarioComponent implements OnChanges {
  @Input() proyectoId!: number;

  cargando = false;
  calendarios: any[] = [];
  seleccionado: any = null;
  excepciones: any[] = [];
  mostrarFormCal = false;
  mostrarFormExc = false;
  guardando = false;

  dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  calForm: any = this.calVacio();
  excForm: any = this.excVacio();

  constructor(private readonly gpi: GpiService, private readonly swal: SwalService) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['proyectoId'] && this.proyectoId) this.cargar();
  }

  private calVacio() {
    return { nombre: 'Calendario del proyecto', lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: false, domingo: false, horasPorDia: 8 };
  }
  private excVacio() {
    return { fecha: new Date().toISOString().slice(0, 10), laborable: false, horas: 0, motivo: '' };
  }

  cargar(): void {
    this.cargando = true;
    this.gpi.listarCalendarios(this.proyectoId).subscribe({
      next: (c) => {
        this.calendarios = c;
        this.seleccionado = c.length ? c[0] : null;
        if (this.seleccionado) this.cargarExcepciones();
        this.cargando = false;
      },
      error: () => {
        this.calendarios = [];
        this.cargando = false;
      },
    });
  }

  seleccionar(c: any): void {
    this.seleccionado = c;
    this.cargarExcepciones();
  }

  cargarExcepciones(): void {
    if (!this.seleccionado) return;
    this.gpi.listarExcepciones(this.seleccionado.id_calendario).subscribe({
      next: (e) => (this.excepciones = e),
      error: () => (this.excepciones = []),
    });
  }

  nuevoCalendario(): void {
    this.calForm = this.calVacio();
    this.mostrarFormCal = true;
  }

  guardarCalendario(): void {
    const payload: any = {
      idProyecto: this.proyectoId,
      nombre: this.calForm.nombre?.trim() || 'Calendario del proyecto',
      lunes: this.calForm.lunes,
      martes: this.calForm.martes,
      miercoles: this.calForm.miercoles,
      jueves: this.calForm.jueves,
      viernes: this.calForm.viernes,
      sabado: this.calForm.sabado,
      domingo: this.calForm.domingo,
      horasPorDia: Number(this.calForm.horasPorDia) || 8,
    };
    this.guardando = true;
    this.gpi.crearCalendario(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarFormCal = false;
        this.swal.exito('Calendario guardado');
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        this.swal.error('No se pudo guardar', this.msg(e));
      },
    });
  }

  agregarExcepcion(): void {
    if (!this.seleccionado) return;
    const payload: any = {
      fecha: this.excForm.fecha,
      laborable: !!this.excForm.laborable,
      horas: Number(this.excForm.horas) || 0,
    };
    if (this.excForm.motivo?.trim()) payload.motivo = this.excForm.motivo.trim();
    this.gpi.crearExcepcion(this.seleccionado.id_calendario, payload).subscribe({
      next: () => {
        this.mostrarFormExc = false;
        this.excForm = this.excVacio();
        this.swal.exito('Excepción guardada');
        this.cargarExcepciones();
      },
      error: (e) => this.swal.error('No se pudo guardar', this.msg(e)),
    });
  }

  eliminarExcepcion(e: any): void {
    this.gpi.eliminarExcepcion(e.id).subscribe({
      next: () => this.cargarExcepciones(),
      error: (err) => this.swal.error('No se pudo eliminar', this.msg(err)),
    });
  }

  diasActivos(c: any): string {
    return this.dias.filter((d) => c[d]).map((d) => d.slice(0, 3)).join(', ');
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}
