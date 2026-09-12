import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';
import { SghService } from '../services/sgh.service';
import {
  Cliente,
  ItemActividad,
  TipoActividad,
  ProyectoCliente,
  UsuarioSgh,
  EstructuraProceso,
  ActividadHeader,
} from '../models/sgh.models';
import { ActividadFormService } from './actividad-form.service';
import { validarActividad } from './actividad.validators';
import { FilaDetalle } from './detalle-horas/detalle-horas.component';

/**
 * Composición del formulario de Actividad/Horas (cabecera + detalle).
 * Solo coordina presentación: la lógica vivió en ActividadFormService y
 * en los validadores puros (SRP/DIP).
 */
@Component({
  selector: 'app-actividad-form',
  standalone: false,
  templateUrl: './actividad-form.component.html',
})
export class ActividadFormComponent implements OnInit {
  tipos: TipoActividad[] = [];
  items: ItemActividad[] = [];
  proyectos: ProyectoCliente[] = [];
  usuarioActual: UsuarioSgh | null = null;

  header: ActividadHeader = { numdoc: '', responsible: '', dateDocument: '', note: '', visit: 0 };
  detalles: FilaDetalle[] = [];
  clienteSeleccionado: Cliente | null = null;

  editando = false;
  loading = false;
  error = '';
  errosDetalle: string[] = [];

  private id?: number;

  constructor(
    private readonly service: ActividadFormService,
    private readonly sgh: SghService,
    private readonly swal: SwalService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.service.cargarCatalogos().subscribe((c) => {
      this.tipos = c.tipos;
      this.items = c.items;
      this.usuarioActual = this.service.usuarioDefault();
      if (this.usuarioActual) this.header.idUser = this.usuarioActual.idUser;
    });

    this.id = this.route.snapshot.params['id'];
    if (this.id) {
      this.editando = true;
      this.cargar(this.id);
    } else {
      this.agregarFila();
    }
  }

  cargar(id: number): void {
    this.service.cargarActividad(id).subscribe({
      next: (data) => {
        this.header = data.header;
        this.clienteSeleccionado = data.cliente ?? null;
        this.detalles = data.detalles as FilaDetalle[];
        if (this.header.idClient) this.cargarProyectos(this.header.idClient);
      },
      error: (err) => this.mostrarError(err),
    });
  }

  cargarProcesos(idItem: number): Observable<EstructuraProceso[]> {
    return this.service.procesosDelItem(idItem);
  }

  agregarFila(): void {
    this.detalles.push({
      idItemActivity: undefined,
      idProcess: undefined,
      situation: '',
      hours: 0,
      note: '',
      mantis: '',
    });
  }

  onClienteSeleccionado(cliente: Cliente | null): void {
    this.clienteSeleccionado = cliente;
    this.header.idClient = cliente?.idClient;
    this.header.idProyect = undefined;
    this.proyectos = [];
    if (cliente) this.cargarProyectos(cliente.idClient);
  }

  cargarProyectos(idClient: number): void {
    this.service.proyectosDelCliente(idClient).subscribe((p: ProyectoCliente[]) => (this.proyectos = p));
  }

  guardar(): void {
    this.error = '';
    this.errosDetalle = [];
    const errores = validarActividad(this.header, this.detalles);
    if (errores.length) {
      this.errosDetalle = errores;
      this.swal.advertencia('Valide los datos', errores.join(' · '));
      return;
    }

    this.loading = true;
    this.swal.cargando('Guardando actividad...');
    this.service.guardar(this.header, this.detalles).subscribe({
      next: (a) => {
        this.swal.cerrar();
        this.swal.exito(this.editando ? 'Actividad actualizada' : 'Actividad creada');
        const id = a?.idActivity ?? this.header.idActivity;
        this.preguntarImprimir(id);
        this.router.navigate(['/sgh/actividades']);
      },
      error: (err: any) => {
        this.swal.cerrar();
        this.loading = false;
        this.swal.error('Error al guardar', this.mensajeError(err));
      },
    });
  }

  /** Tras guardar, ofrece imprimir el formato (igual que la versión anterior). */
  private async preguntarImprimir(id?: number): Promise<void> {
    if (!id) return;
    const ok = await this.swal.confirmar({
      titulo: 'Imprimir formato',
      texto: 'La actividad se guardó correctamente. ¿Desea imprimir el formato PDF?',
      textoConfirmar: 'Sí, imprimir',
      textoCancelar: 'Ahora no',
    });
    if (ok) this.imprimir(id);
  }

  /** Genera y abre el PDF del formato de la actividad. */
  imprimir(id?: number): void {
    const actividadId = id ?? this.header.idActivity;
    if (!actividadId) {
      this.swal.advertencia('Imprimir', 'Debe guardar la actividad antes de imprimir.');
      return;
    }
    this.swal.cargando('Generando PDF...');
    this.sgh.pdfActividad(actividadId).subscribe({
      next: (blob) => {
        this.swal.cerrar();
        abrirPdf(blob, `actividad-${this.header.numdoc || actividadId}.pdf`);
      },
      error: () => {
        this.swal.cerrar();
        this.swal.error('Error al imprimir', 'No se pudo generar el formato PDF');
      },
    });
  }

  private mensajeError(err: any): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join(' · ') : msg || 'No se pudo completar la operación';
  }

  private mostrarError(err: any): void {
    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join(' · ') : msg || 'Error en la operación';
  }
}
