import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
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
  ActividadAttachment,
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

  adjuntos: ActividadAttachment[] = [];
  /** Archivos elegidos en una actividad nueva; se suben al guardar. */
  archivosPendientes: File[] = [];
  subiendo = false;

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
        this.cargarAdjuntos();
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

  /* ==================== Documentos adjuntos ==================== */

  /** Carga la lista de adjuntos de la actividad actual (solo si ya existe). */
  cargarAdjuntos(): void {
    if (!this.id) return;
    this.sgh.listAdjuntos(this.id).subscribe({
      next: (a) => (this.adjuntos = a),
      error: () => (this.adjuntos = []),
    });
  }

  /**
   * Procesa los archivos seleccionados (PDF/JPG/PNG, máx. 5 MB c/u).
   * - Actividad existente: se suben de inmediato.
   * - Actividad nueva: quedan pendientes y se suben al guardar.
   */
  onArchivosSeleccionados(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    if (!archivos.length) return;

    const permitidos = ['application/pdf', 'image/jpeg', 'image/png'];
    const invalido = archivos.find((a) => !permitidos.includes(a.type));
    if (invalido) {
      this.swal.advertencia('Formato no permitido', `"${invalido.name}" no es PDF, JPG o PNG.`);
      return;
    }
    const grande = archivos.find((a) => a.size > 5 * 1024 * 1024);
    if (grande) {
      this.swal.advertencia('Archivo muy grande', `"${grande.name}" supera los 5 MB.`);
      return;
    }

    // Actividad nueva (sin id): se conservan y se suben al guardar.
    if (!this.id) {
      this.archivosPendientes = [...this.archivosPendientes, ...archivos];
      this.swal.exito(`${archivos.length} archivo(s) listo(s). Se subirán al guardar.`);
      return;
    }

    this.subir(this.id, archivos);
  }

  /** Sube archivos a una actividad ya persistida. */
  private subir(id: number, archivos: File[]): void {
    this.subiendo = true;
    this.swal.cargando('Subiendo archivos...');
    this.sgh.subirAdjuntos(id, archivos).subscribe({
      next: (nuevos) => {
        this.swal.cerrar();
        this.subiendo = false;
        this.adjuntos = [...nuevos, ...this.adjuntos];
        this.swal.exito(`${nuevos.length} archivo(s) adjuntado(s)`);
      },
      error: (err: any) => {
        this.swal.cerrar();
        this.subiendo = false;
        this.swal.error('Error al subir', this.mensajeError(err));
      },
    });
  }

  /** Sube los archivos pendientes a la actividad recién creada. */
  private async subirPendientes(id?: number): Promise<void> {
    if (!id || !this.archivosPendientes.length) return;
    this.swal.cargando(`Subiendo ${this.archivosPendientes.length} archivo(s)...`);
    try {
      const nuevos = await firstValueFrom(this.sgh.subirAdjuntos(id, this.archivosPendientes));
      this.adjuntos = [...nuevos, ...this.adjuntos];
      this.archivosPendientes = [];
    } catch (err: any) {
      this.swal.error('Error al subir', this.mensajeError(err));
    } finally {
      this.swal.cerrar();
    }
  }

  /** Quita un archivo pendiente antes de guardar. */
  quitarPendiente(i: number): void {
    this.archivosPendientes.splice(i, 1);
  }

  /** Descarga un adjunto conservando su nombre original. */
  descargarAdjunto(adjunto: ActividadAttachment): void {
    if (!this.id) return;
    this.sgh.descargarAdjunto(this.id, adjunto.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = adjunto.filename;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.swal.error('Error al descargar', 'No se pudo descargar el archivo'),
    });
  }

  /** Elimina un adjunto (con confirmación). */
  async eliminarAdjunto(adjunto: ActividadAttachment): Promise<void> {
    if (!this.id) return;
    const ok = await this.swal.confirmar({
      titulo: 'Eliminar adjunto',
      texto: `¿Eliminar "${adjunto.filename}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Sí, eliminar',
      icono: 'warning',
    });
    if (!ok) return;

    this.sgh.eliminarAdjunto(this.id, adjunto.id).subscribe({
      next: () => {
        this.adjuntos = this.adjuntos.filter((a) => a.id !== adjunto.id);
        this.swal.exito('Adjunto eliminado');
      },
      error: (err: any) => this.swal.error('Error al eliminar', this.mensajeError(err)),
    });
  }

  /** Tamaño legible (KB/MB). */
  tamanoLegible(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        const id = a?.idActivity ?? this.header.idActivity;
        this.subirPendientes(id).finally(() => {
          this.swal.exito(this.editando ? 'Actividad actualizada' : 'Actividad creada');
          this.preguntarImprimir(id);
          this.router.navigate(['/sgh/actividades']);
        });
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
