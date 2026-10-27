import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SoporteService, TicketDetalle, TicketCatalogos, TicketAgente, TicketMensaje, MantisUsuario, MantisEstado, MantisCampo } from '../services/soporte.service';
import { MantisService, MantisProyecto } from '../../sgh/services/mantis.service';
import { SwalService } from '../../core/services/swal.service';
import { descargarBlob } from '../../core/utils/descarga.util';
import { construirTextoCierre } from '../utils/cierre.util';

const ETIQUETA_ESTADO: Record<string, string> = {
  nuevo: 'Nuevo',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const TRANSICIONES: Record<string, string[]> = {
  nuevo: ['asignado', 'en_progreso', 'cancelado'],
  asignado: ['en_progreso', 'en_espera', 'cancelado'],
  en_progreso: ['en_espera', 'resuelto', 'cancelado'],
  en_espera: ['en_progreso', 'resuelto'],
  resuelto: ['cerrado', 'en_progreso'],
  cerrado: ['en_progreso'],
  cancelado: [],
};

/**
 * Respuesta que se precarga por defecto en «Responder» (solo respuestas
 * públicas al solicitante; nunca en las notas internas).
 */
const RESPUESTA_PREDETERMINADA =
  'Gracias por registrar su incidencia. Nuestro equipo de soporte la está evaluando y le informaremos sobre su avance a la brevedad.';


@Component({
  selector: 'app-ticket-detalle',
  standalone: false,
  templateUrl: './ticket-detalle.component.html',
})
export class TicketDetalleComponent implements OnInit {
  cargando = false;
  ticket: TicketDetalle | null = null;
  catalogos: TicketCatalogos | null = null;

  nuevoMensaje = RESPUESTA_PREDETERMINADA;
  mensajeInterno = false;
  enviandoMensaje = false;
  /** true cuando el agente ya escribió un texto distinto a la respuesta predeterminada. */
  private respuestaEditada = false;

  // Estado
  estadosPosibles: string[] = [];
  destinoEstado = '';
  holdReason = '';
  resolutionCode = '';
  resolutionNotes = '';
  motivo = '';
  cambiandoEstado = false;

  // Asignación
  asignarId: number | null = null;
  grupoId: number | null = null;
  asignando = false;

  // Clasificación (módulo/categoría)
  categoriaId: number | null = null;
  guardandoCategoria = false;

  // Prioridad
  nuevaPrioridad = '';
  justificacion = '';
  forzandoPrioridad = false;

  // Adjuntos
  archivosSeleccionados: File[] = [];
  subiendoAdjuntos = false;
  eliminandoAdjunto: number | null = null;

  // Mantis (envío manual)
  mantisPanel = false;  mantisCargandoProyectos = false;
  mantisProyectos: MantisProyecto[] = [];
  mantisProyectoId: number | null = null;
  mantisPrioridad = '';
  mantisSeveridad = '';
  mantisEnviando = false;
  mantisUsuarios: MantisUsuario[] = [];
  mantisCargandoUsuarios = false;
  mantisUsuariosError = '';
  mantisHandlerId: number | null = null;
  mantisEstado: MantisEstado | null = null;
  /** Campos personalizados obligatorios del proyecto de Mantis. */
  mantisCampos: MantisCampo[] = [];
  /** Valor elegido por campo (id -> valor). */
  mantisCamposValores: { [id: number]: string } = {};
  mantisSyncCargando = false;
  mantisSyncError = '';

  // Auto-cierre desde Mantis
  mantisCierreMensaje = '';
  mantisCierreIncluirConversacion = true;
  cerrandoDesdeMantis = false;

  // Carta de cierre al cliente
  cartaMensaje = '';
  cartaIncluirConversacion = true;
  cartaEnviarAlCerrar = true;
  cartaEnviando = false;

  // Envío de la incidencia por correo (calidad)
  correoMensaje = '';
  correoIncluirConversacion = false;
  enviandoCorreo = false;

  // Seguimiento manual al cliente (solo comentarios públicos)
  seguimientoPanel = false;
  seguimientoDestinatario = '';
  seguimientoMensaje = '';
  seguimientoIncluirAdjuntos = false;
  seguimientoSeleccion: { [id: number]: boolean } = {};
  seguimientoEnviando = false;

  constructor(
    private readonly soporte: SoporteService,
    private readonly mantis: MantisService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly swal: SwalService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarCatalogo();
    this.cargar(id);
  }

  estadoLabel(e: string): string {
    return ETIQUETA_ESTADO[e] || e;
  }

  private cargarCatalogo(): void {
    this.soporte.catalogo().subscribe({
      next: (c) => {
        this.catalogos = c;
        this.asignarId = c.agentes.length ? c.agentes[0].id : null;
      },
      error: () => {},
    });
  }

  private cargar(id: number): void {
    this.cargando = true;
    this.soporte.obtener(id).subscribe({
      next: (t) => {
        this.ticket = t;
        this.estadosPosibles = TRANSICIONES[t.state] ?? [];
        this.destinoEstado = this.estadosPosibles[0] ?? '';
        this.asignarId = t.assigneeId ?? (this.catalogos?.agentes[0]?.id ?? null);
        this.grupoId = t.groupId ?? null;
        this.categoriaId = t.categoryId ?? null;
        this.nuevaPrioridad = t.priority;
        this.mantisProyectoId = t.clientMantisProyect ?? null;
        this.mantisPrioridad = t.priority;
        if (t.mantisIssueId) {
          this.sincronizarMantis();
        } else {
          this.mantisEstado = null;
          this.mantisSyncError = '';
        }
        this.cargando = false;
      },
      error: (e) => {
        this.cargando = false;
        this.swal.error('Error al cargar el ticket', this.msg(e));
      },
    });
  }

  volver(): void {
    this.router.navigate(['/soporte/tickets']);
  }

  enviarMensaje(): void {
    if (!this.ticket || !this.nuevoMensaje.trim()) {
      this.swal.advertencia('Mensaje vacío', 'Escribe un mensaje antes de enviar.');
      return;
    }
    this.enviandoMensaje = true;
    this.soporte
      .agregarMensaje(this.ticket.id, {
        body: this.nuevoMensaje.trim(),
        isInternal: this.mensajeInterno,
      })
      .subscribe({
        next: (m) => {
          this.enviandoMensaje = false;
          // Se restablece la respuesta pública predeterminada para el próximo mensaje
          this.nuevoMensaje = RESPUESTA_PREDETERMINADA;
          this.mensajeInterno = false;
          this.respuestaEditada = false;
          this.cargar(this.ticket!.id);
        },
        error: (e) => {
          this.enviandoMensaje = false;
          this.swal.error('No se pudo enviar el mensaje', this.msg(e));
        },
      });
  }

  /** Se invoca en cada pulsación del textarea. Marca si el agente personalizó el texto. */
  onRespuestaCambiada(valor: string): void {
    this.nuevoMensaje = valor;
    const limpio = this.nuevoMensaje.trim();
    this.respuestaEditada = limpio !== '' && limpio !== RESPUESTA_PREDETERMINADA;
  }

  /**
   * Al marcar «Nota interna» se retira la respuesta predeterminada (que es un
   * texto para el cliente), pero **solo si el agente no la ha personalizado**;
   * al volver a respuesta pública se restaura si el campo quedó vacío.
   */
  onTipoMensaje(interno: boolean): void {
    this.mensajeInterno = interno;
    if (interno) {
      if (!this.respuestaEditada && this.nuevoMensaje.trim() === RESPUESTA_PREDETERMINADA) {
        this.nuevoMensaje = '';
      }
    } else if (!this.nuevoMensaje.trim() && !this.respuestaEditada) {
      this.nuevoMensaje = RESPUESTA_PREDETERMINADA;
    }
  }

  cambiarEstado(): void {
    if (!this.ticket || !this.destinoEstado) return;
    const destino = this.destinoEstado;
    const avisar =
      this.cartaEnviarAlCerrar && (destino === 'resuelto' || destino === 'cerrado');
    const payload: any = { state: this.destinoEstado };
    if (this.destinoEstado === 'en_espera' && this.holdReason) payload.holdReason = this.holdReason;
    if (this.destinoEstado === 'resuelto') {
      payload.resolutionCode = this.resolutionCode;
      payload.resolutionNotes = this.resolutionNotes.trim();
    }
    if (this.destinoEstado === 'cancelado' && this.motivo) payload.motivo = this.motivo;

    this.cambiandoEstado = true;
    this.soporte.cambiarEstado(this.ticket.id, payload).subscribe({
      next: () => {
        this.cambiandoEstado = false;
        this.holdReason = '';
        this.resolutionCode = '';
        this.resolutionNotes = '';
        this.motivo = '';
        this.swal.exito('Estado actualizado', 'El ticket cambió de estado correctamente.');
        this.cargar(this.ticket!.id);
        if (avisar) this.enviarCarta();
      },
      error: (e) => {
        this.cambiandoEstado = false;
        this.swal.error('No se pudo cambiar el estado', this.msg(e));
      },
    });
  }

  /** Envía la carta formal de cierre al cliente. */
  enviarCarta(): void {
    if (!this.ticket) return;
    const payload: any = { incluirConversacion: this.cartaIncluirConversacion };
    if (this.cartaMensaje.trim()) payload.mensaje = this.cartaMensaje.trim();

    this.cartaEnviando = true;
    this.soporte.notificarCliente(this.ticket.id, payload).subscribe({
      next: (r) => {
        this.cartaEnviando = false;
        this.cartaMensaje = '';
        const nota = r?.simulado
          ? ' (SMTP no configurado: el correo no se envió realmente)'
          : '';
        this.swal.exito(
          'Carta de cierre enviada',
          `Se envió la carta a ${r?.destinatario ?? 'el cliente'}${nota}.`,
        );
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.cartaEnviando = false;
        this.swal.error('No se pudo enviar la carta', this.msg(e));
      },
    });
  }

  /** Muestra la carta en una pestaña nueva sin enviarla. */
  previsualizarCarta(): void {
    if (!this.ticket) return;
    const payload: any = {
      incluirConversacion: this.cartaIncluirConversacion,
      previsualizar: true,
    };
    if (this.cartaMensaje.trim()) payload.mensaje = this.cartaMensaje.trim();

    this.soporte.notificarCliente(this.ticket.id, payload).subscribe({
      next: (r) => {
        const ventana = window.open('', '_blank');
        if (!ventana) {
          this.swal.advertencia(
            'Vista previa bloqueada',
            'Permite las ventanas emergentes para ver la carta.',
          );
          return;
        }
        ventana.document.write(r?.html ?? '<p>No se pudo generar la carta.</p>');
        ventana.document.close();
      },
      error: (e) => this.swal.error('No se pudo previsualizar la carta', this.msg(e)),
    });
  }

  /** Envía la incidencia (con sus documentos adjuntos) a calidad@sigesp.com.ve. */
  enviarCorreoCalidad(): void {
    if (!this.ticket) return;
    const payload: any = { incluirConversacion: this.correoIncluirConversacion };
    if (this.correoMensaje.trim()) payload.mensaje = this.correoMensaje.trim();

    this.enviandoCorreo = true;
    this.soporte.enviarCorreoIncidencia(this.ticket.id, payload).subscribe({
      next: (r) => {
        this.enviandoCorreo = false;
        this.correoMensaje = '';
        const nota = r?.simulado ? ' (SMTP no configurado: el correo no se envió realmente)' : '';
        const dest = r?.destinatario ?? 'calidad@sigesp.com.ve';
        if (r?.adjuntosFaltantes) {
          this.swal.advertencia(
            'Correo enviado con avisos',
            `Se envió a ${dest} con ${r?.adjuntos ?? 0} adjunto(s), pero ${r.adjuntosFaltantes} no se ` +
              `encontraron en el servidor (revise el storage).${nota}`,
          );
        } else {
          this.swal.exito(
            'Correo enviado',
            `Se envió la incidencia a ${dest} con ${r?.adjuntos ?? 0} adjunto(s)${nota}.`,
          );
        }
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.enviandoCorreo = false;
        this.swal.error('No se pudo enviar el correo', this.msg(e));
      },
    });
  }

  /* ==================== Seguimiento manual al cliente ==================== */

  /** Abre el preparador de seguimiento; preselecciona los comentarios públicos. */
  abrirSeguimiento(): void {
    if (!this.ticket) return;
    this.seguimientoPanel = true;
    this.seguimientoDestinatario = this.ticket.requesterEmail || '';
    this.seguimientoSeleccion = {};
    for (const m of this.ticket.mensajes || []) {
      if (!m.is_internal) this.seguimientoSeleccion[m.id] = true;
    }
  }

  cerrarSeguimiento(): void {
    this.seguimientoPanel = false;
  }

  /** Solo los comentarios públicos son seleccionables. */
  toggleSeguimiento(m: TicketMensaje): void {
    if (m.is_internal) return;
    this.seguimientoSeleccion[m.id] = !this.seguimientoSeleccion[m.id];
  }

  seleccionCount(): number {
    return Object.values(this.seguimientoSeleccion).filter(Boolean).length;
  }

  private payloadSeguimiento(previsualizar: boolean): any {
    const ids = (this.ticket?.mensajes || [])
      .filter((m) => !m.is_internal && this.seguimientoSeleccion[m.id])
      .map((m) => m.id);
    const payload: any = { mensajeIds: ids, previsualizar };
    if (this.seguimientoDestinatario.trim()) payload.destinatario = this.seguimientoDestinatario.trim();
    if (this.seguimientoMensaje.trim()) payload.mensaje = this.seguimientoMensaje.trim();
    if (this.seguimientoIncluirAdjuntos) payload.incluirAdjuntos = true;
    return payload;
  }

  /** Envía por correo el seguimiento con los comentarios seleccionados. */
  enviarSeguimiento(): void {
    if (!this.ticket) return;
    if (!this.seleccionCount()) {
      this.swal.advertencia('Sin comentarios', 'Seleccione al menos un comentario público para enviar.');
      return;
    }
    this.seguimientoEnviando = true;
    this.soporte.enviarSeguimiento(this.ticket.id, this.payloadSeguimiento(false)).subscribe({
      next: (r) => {
        this.seguimientoEnviando = false;
        this.seguimientoPanel = false;
        this.seguimientoMensaje = '';
        const nota = r?.simulado ? ' (SMTP no configurado: el correo no se envió realmente)' : '';
        if (r?.adjuntosFaltantes) {
          this.swal.advertencia(
            'Seguimiento enviado con avisos',
            `Se envió a ${r?.destinatario ?? 'el cliente'} con ${r?.mensajesIncluidos ?? 0} comentario(s), ` +
              `pero ${r.adjuntosFaltantes} adjunto(s) no se encontraron en el servidor.${nota}`,
          );
        } else {
          this.swal.exito(
            'Seguimiento enviado',
            `Se envió a ${r?.destinatario ?? 'el cliente'} con ${r?.mensajesIncluidos ?? 0} comentario(s)${nota}.`,
          );
        }
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.seguimientoEnviando = false;
        this.swal.error('No se pudo enviar el seguimiento', this.msg(e));
      },
    });
  }

  /** Vista previa del correo de seguimiento (sin enviarlo). */
  previsualizarSeguimiento(): void {
    if (!this.ticket) return;
    this.soporte.enviarSeguimiento(this.ticket.id, this.payloadSeguimiento(true)).subscribe({
      next: (r) => {
        const ventana = window.open('', '_blank');
        if (!ventana) {
          this.swal.advertencia(
            'Vista previa bloqueada',
            'Permite las ventanas emergentes para ver el correo.',
          );
          return;
        }
        ventana.document.write(r?.html ?? '<p>No se pudo generar la vista previa.</p>');
        ventana.document.close();
      },
      error: (e) => this.swal.error('No se pudo previsualizar el seguimiento', this.msg(e)),
    });
  }

  asignar(): void {
    if (!this.ticket) return;
    const payload: any = {};
    if (this.asignarId != null) payload.assigneeId = this.asignarId;
    if (this.grupoId != null) payload.groupId = this.grupoId;

    this.asignando = true;
    this.soporte.asignar(this.ticket.id, payload).subscribe({
      next: () => {
        this.asignando = false;
        this.swal.exito('Asignación guardada', 'El ticket quedó asignado.');
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.asignando = false;
        this.swal.error('No se pudo asignar', this.msg(e));
      },
    });
  }

  /** Guarda el módulo/categoría del ticket (Clasificación). */
  guardarCategoria(): void {
    if (!this.ticket) return;
    this.guardandoCategoria = true;
    this.soporte
      .actualizar(this.ticket.id, { categoryId: this.categoriaId ?? undefined })
      .subscribe({
        next: () => {
          this.guardandoCategoria = false;
          this.swal.exito('Clasificación guardada', 'El módulo/categoría del ticket quedó actualizado.');
          this.cargar(this.ticket!.id);
        },
        error: (e) => {
          this.guardandoCategoria = false;
          this.swal.error('No se pudo guardar', this.msg(e));
        },
      });
  }

  forzarPrioridad(): void {
    if (!this.ticket) return;
    if (!this.justificacion.trim()) {
      this.swal.advertencia('Justificación', 'Para cambiar la prioridad debes indicar el motivo.');
      return;
    }
    this.forzandoPrioridad = true;
    this.soporte
      .forzarPrioridad(this.ticket.id, {
        priority: this.nuevaPrioridad,
        justificacion: this.justificacion.trim(),
      })
      .subscribe({
        next: () => {
          this.forzandoPrioridad = false;
          this.justificacion = '';
          this.swal.exito('Prioridad actualizada', 'El cambio de prioridad quedó registrado.');
          this.cargar(this.ticket!.id);
        },
        error: (e) => {
          this.forzandoPrioridad = false;
          this.swal.error('No se pudo forzar la prioridad', this.msg(e));
        },
      });
  }

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }

  /* ==================== Mantis (envío manual) ==================== */

  abrirMantis(): void {
    this.mantisPanel = true;
    this.mantisPrioridad = this.mantisPrioridad || this.ticket?.priority || 'P3';
    if (this.mantisProyectos.length) {
      this.cargarUsuariosMantis();
      return;
    }
    this.mantisCargandoProyectos = true;
    this.mantis.filtros().subscribe({
      next: (f) => {
        this.mantisProyectos = f.proyectos ?? [];
        this.mantisCargandoProyectos = false;
        this.cargarUsuariosMantis();
      },
      error: (e) => {
        this.mantisCargandoProyectos = false;
        this.swal.error('No se pudieron cargar los proyectos de Mantis', this.msg(e));
      },
    });
  }

  /** Proyecto efectivo: el elegido en el panel o el del cliente. */
  private proyectoMantisEfectivo(): number | null {
    return this.mantisProyectoId ?? this.ticket?.clientMantisProyect ?? null;
  }

  /** Al cambiar de proyecto hay que recargar sus responsables. */
  cambiarProyectoMantis(): void {
    this.cargarUsuariosMantis();
  }

  /** Trae los usuarios (responsables posibles) del proyecto y preselecciona uno. */
  cargarUsuariosMantis(): void {
    const proyectoId = this.proyectoMantisEfectivo();
    this.mantisUsuarios = [];
    this.mantisHandlerId = null;
    this.mantisUsuariosError = '';
    this.mantisCampos = [];
    this.mantisCamposValores = {};
    if (!proyectoId) return;

    this.mantisCargandoUsuarios = true;
    this.soporte.usuariosMantis(proyectoId).subscribe({
      next: (r) => {
        this.mantisUsuarios = r.usuarios ?? [];
        this.mantisCargandoUsuarios = false;
        // Campos obligatorios del proyecto (p. ej. «MODULOS ERP» en la Gobernación).
        this.mantisCampos = r.proyecto?.customFields ?? [];
        this.mantisCamposValores = {};
        for (const campo of this.mantisCampos) {
          this.mantisCamposValores[campo.id] =
            campo.possibleValues.length === 1 ? campo.possibleValues[0] : '';
        }
        // Preselecciona el responsable cuyo usuario de Mantis coincide con el
        // agente asignado al ticket (los username de Mantis = login de SIGESP).
        const login = (this.ticket?.assigneeNombre ?? '').toLowerCase();
        const match = this.mantisUsuarios.find((u) => u.name?.toLowerCase() === login);
        this.mantisHandlerId = match?.id ?? null;
      },
      error: (e) => {
        this.mantisCargandoUsuarios = false;
        this.mantisUsuariosError = this.msg(e);
      },
    });
  }

  /** Trae el estado y los comentarios actuales del caso en Mantis. */
  sincronizarMantis(): void {
    if (!this.ticket?.mantisIssueId) return;
    this.mantisSyncCargando = true;
    this.mantisSyncError = '';
    this.soporte.estadoMantis(this.ticket.id).subscribe({
      next: (e) => {
        this.mantisEstado = e;
        this.mantisSyncCargando = false;
        this.avisarMantisCerradoSiAplica();
      },
      error: (err) => {
        this.mantisSyncCargando = false;
        this.mantisSyncError = this.msg(err);
      },
    });
  }

  /* ==================== Auto-cierre desde Mantis ==================== */

  /** Texto de cierre sugerido (editable en el diálogo). */
  textoSugeridoCierre(): string {
    const t = this.ticket;
    if (!t) return '';
    return construirTextoCierre({
      solicitante: t.requesterName,
      numero: t.number,
      asunto: t.title,
      resolucion: this.mantisEstado?.resolucion?.label || this.mantisEstado?.resolucion?.name || '',
      notas: t.resolutionNotes,
    });
  }

  /** Si el caso está cerrado en Mantis y el ticket no, muestra el aviso (una vez por ticket). */
  private avisarMantisCerradoSiAplica(): void {
    const t = this.ticket;
    const e = this.mantisEstado;
    if (!t || !e || !e.cerrado) return;
    if (t.state === 'cerrado') return;
    const key = `sop_mantis_cerrado_${t.id}`;
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* sessionStorage no disponible: se muestra igual */
    }
    this.abrirDialogoCierreMantis();
  }

  /** Diálogo de cierre automático (aviso al cargar o botón del panel de Mantis). */
  async abrirDialogoCierreMantis(): Promise<void> {
    const t = this.ticket;
    if (!t) return;
    const e = this.mantisEstado;
    const resolucion = e?.resolucion?.label || e?.resolucion?.name;
    const html =
      `El caso <b>#${t.mantisIssueId ?? ''}</b> está <b>cerrado</b> en Mantis` +
      (resolucion ? ` (resolución: ${resolucion})` : '') +
      `.<div style="font-size:12px;color:#64748b;margin-top:6px;">` +
      `Puede cerrar el ticket y notificar al cliente con la conversación, o cerrarlo sin correo.</div>`;

    const r = await this.swal.confirmarConTexto({
      titulo: 'El caso está CERRADO en Mantis',
      html,
      valor: this.mantisCierreMensaje || this.textoSugeridoCierre(),
      textoPrincipal: 'Cerrar y notificar',
      textoSecundario: 'Solo cerrar',
      textoCancelar: 'Más tarde',
      icono: 'info',
    });
    if (r.accion === 'cancelar') return;
    this.mantisCierreMensaje = r.texto;
    this.ejecutarCierreDesdeMantis(r.accion === 'principal');
  }

  /** Ejecuta el cierre automático (con o sin notificación al cliente). */
  private ejecutarCierreDesdeMantis(notificar: boolean): void {
    if (!this.ticket) return;
    const id = this.ticket.id;
    this.cerrandoDesdeMantis = true;
    this.swal.cargando(
      notificar ? 'Cerrando y notificando al cliente...' : 'Cerrando el ticket...',
    );

    const payload: any = {
      incluirConversacion: this.mantisCierreIncluirConversacion,
      notificar,
    };
    if (this.mantisCierreMensaje.trim()) payload.mensaje = this.mantisCierreMensaje.trim();

    this.soporte.cerrarDesdeMantis(id, payload).subscribe({
      next: (r) => {
        this.cerrandoDesdeMantis = false;
        this.swal.cerrar();
        const nota = r?.simulado ? ' (SMTP no configurado: el correo no se envió)' : '';
        if (r?.notificado === false) {
          this.swal.exito('Ticket cerrado', 'El ticket quedó cerrado (sin notificación al cliente).');
        } else if (r?.sinCorreo) {
          this.swal.advertencia(
            'Ticket cerrado',
            'El ticket quedó cerrado, pero no se pudo notificar al cliente porque no tiene correo de contacto.',
          );
        } else {
          this.swal.exito(
            'Ticket cerrado',
            `Se cerró el ticket y se notificó a ${r?.destinatario ?? 'el cliente'}${nota}.`,
          );
        }
        this.cargar(id);
      },
      error: (e) => {
        this.cerrandoDesdeMantis = false;
        this.swal.cerrar();
        this.swal.error('No se pudo cerrar el ticket', this.msg(e));
      },
    });
  }

  /** Color del badge según el estado del caso en Mantis. */
  estadoMantisClase(e: MantisEstado): string {
    switch (e.status?.name) {
      case 'closed':
        return 'bg-gray-200 text-gray-700';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700';
      case 'assigned':
      case 'confirmed':
      case 'acknowledged':
        return 'bg-cyan-100 text-cyan-700';
      case 'feedback':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  }

  cerrarMantis(): void {
    this.mantisPanel = false;
  }

  enviarAMantis(): void {
    if (!this.ticket) return;

    // Campos obligatorios del proyecto de Mantis (p. ej. «MODULOS ERP»).
    const faltante = this.mantisCampos.find(
      (c) => !(this.mantisCamposValores[c.id] ?? '').trim(),
    );
    if (faltante) {
      this.swal.advertencia(
        'Campo requerido',
        `Seleccione un valor para «${faltante.name}».`,
      );
      return;
    }

    const payload: any = {};
    if (this.mantisProyectoId != null) payload.projectId = this.mantisProyectoId;
    if (this.mantisPrioridad) payload.priority = this.mantisPrioridad;
    if (this.mantisSeveridad) payload.severity = this.mantisSeveridad;
    if (this.mantisHandlerId != null) payload.handlerId = this.mantisHandlerId;

    const customFields: { [id: string]: string } = {};
    for (const campo of this.mantisCampos) {
      const valor = (this.mantisCamposValores[campo.id] ?? '').trim();
      if (valor) customFields[String(campo.id)] = valor;
    }
    if (Object.keys(customFields).length) payload.customFields = customFields;

    this.mantisEnviando = true;
    this.soporte.enviarAMantis(this.ticket.id, payload).subscribe({
      next: (r) => {
        this.mantisEnviando = false;
        this.mantisPanel = false;
        this.swal.exito(
          'Enviado a Mantis',
          `Se creó la incidencia #${r?.id ?? ''}${r?.proyecto?.name ? ` en «${r.proyecto.name}»` : ''}.`,
        );
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.mantisEnviando = false;
        this.swal.error('No se pudo enviar a Mantis', this.msg(e));
      },
    });
  }

  /* ==================== Adjuntos ==================== */

  onArchivosSeleccionados(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    if (archivos.length) {
      this.archivosSeleccionados = [...this.archivosSeleccionados, ...archivos];
    }
    input.value = '';
  }

  quitarSeleccionado(archivo: File): void {
    this.archivosSeleccionados = this.archivosSeleccionados.filter((a) => a !== archivo);
  }

  subirAdjuntos(): void {
    if (!this.ticket || !this.archivosSeleccionados.length) return;
    this.subiendoAdjuntos = true;
    this.soporte.subirAdjuntos(this.ticket.id, this.archivosSeleccionados).subscribe({
      next: () => {
        this.subiendoAdjuntos = false;
        this.archivosSeleccionados = [];
        this.swal.exito('Adjuntos subidos', 'Los archivos se guardaron en el ticket.');
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.subiendoAdjuntos = false;
        this.swal.error('No se pudieron subir los adjuntos', this.msg(e));
      },
    });
  }

  /** Elimina (baja logica) un comentario del ticket, con confirmacion. */
  async eliminarMensaje(m: TicketMensaje): Promise<void> {
    if (!this.ticket) return;
    const ok = await this.swal.confirmar({
      titulo: 'Eliminar comentario',
      texto: '¿Seguro que deseas eliminar este comentario? Quedará registrado en el historial.',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar',
      icono: 'warning',
    });
    if (!ok) return;
    this.soporte.eliminarMensaje(this.ticket.id, m.id).subscribe({
      next: () => {
        this.swal.exito('Comentario eliminado', 'El comentario se eliminó de la conversación.');
        this.cargar(this.ticket!.id);
      },
      error: (e) => this.swal.error('No se pudo eliminar el comentario', this.msg(e)),
    });
  }

  descargarAdjunto(a: any): void {
    if (!this.ticket) return;
    this.soporte.descargarAdjunto(this.ticket.id, a.id).subscribe({
      next: (blob) => descargarBlob(blob, a.filename || 'adjunto'),
      error: (e) =>
        this.swal.error(
          'No se pudo descargar el adjunto',
          e?.status ? `El servidor respondió ${e.status}.` : undefined,
        ),
    });
  }

  eliminarAdjunto(a: any): void {
    if (!this.ticket || this.eliminandoAdjunto !== null) return;
    this.eliminandoAdjunto = a.id;
    this.soporte.eliminarAdjunto(this.ticket.id, a.id).subscribe({
      next: () => {
        this.eliminandoAdjunto = null;
        this.swal.exito('Adjunto eliminado', 'El archivo quedó eliminado del ticket.');
        this.cargar(this.ticket!.id);
      },
      error: (e) => {
        this.eliminandoAdjunto = null;
        this.swal.error('No se pudo eliminar el adjunto', this.msg(e));
      },
    });
  }
}