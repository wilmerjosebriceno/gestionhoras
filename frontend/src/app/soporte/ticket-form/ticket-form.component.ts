import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SoporteService, TicketCatalogos } from '../services/soporte.service';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-soporte-nuevo',
  standalone: false,
  templateUrl: './ticket-form.component.html',
})
export class TicketFormComponent implements OnInit {
  catalogos: TicketCatalogos | null = null;
  cargandoCatalogo = false;
  enviando = false;

  type = 'incidente';
  title = '';
  description = '';
  categoryId: number | null = null;
  groupId: number | null = null;
  service = '';
  affectedUser = '';
  impact = 'moderado';
  urgency = 'media';
  channel = 'telefono';
  idClient: number | null = null;
  clientName = '';
  clientRif = '';

  // Adjuntos (se suben después de crear el ticket)
  archivosSeleccionados: File[] = [];

  constructor(
    private readonly soporte: SoporteService,
    private readonly swal: SwalService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cargandoCatalogo = true;
    this.soporte.catalogo().subscribe({
      next: (c) => {
        this.catalogos = c;
        this.groupId = c.grupos.length ? c.grupos[0].id : null;
        this.categoryId = c.categorias.length ? c.categorias[0].id : null;
        this.cargandoCatalogo = false;
      },
      error: (e) => {
        this.cargandoCatalogo = false;
        this.swal.error('Error al cargar catálogos', this.msg(e));
      },
    });
  }

  volver(): void {
    this.router.navigate(['/soporte/tickets']);
  }

  guardar(): void {
    if (this.title.trim().length < 5) {
      this.swal.advertencia('Título inválido', 'El título debe tener al menos 5 caracteres.');
      return;
    }
    if (this.description.trim().length < 10) {
      this.swal.advertencia('Descripción inválida', 'La descripción debe tener al menos 10 caracteres.');
      return;
    }

    this.enviando = true;
    this.soporte
      .crear({
        type: this.type,
        title: this.title.trim(),
        description: this.description.trim(),
        categoryId: this.categoryId ?? undefined,
        groupId: this.groupId ?? undefined,
        service: this.service.trim() || undefined,
        affectedUser: this.affectedUser.trim() || undefined,
        impact: this.impact,
        urgency: this.urgency,
        channel: this.channel,
        idClient: this.idClient ?? undefined,
        clientName: this.clientName.trim() || undefined,
        clientRif: this.clientRif.trim() || undefined,
      })
      .subscribe({
        next: (t) => {
          // Subir los adjuntos seleccionados al ticket recién creado
          if (this.archivosSeleccionados.length) {
            this.soporte.subirAdjuntos(t.id, this.archivosSeleccionados).subscribe({
              next: () => {
                this.enviando = false;
                this.swal.exito(
                  'Ticket creado',
                  `Número: ${t.number} con ${this.archivosSeleccionados.length} adjunto(s) (${t.priority})`,
                );
                this.router.navigate(['/soporte/tickets', t.id]);
              },
              error: (e2) => {
                this.enviando = false;
                this.swal.error(
                  'Ticket creado, pero los adjuntos fallaron',
                  `Número: ${t.number}. ${this.msg(e2)}`,
                );
                this.router.navigate(['/soporte/tickets', t.id]);
              },
            });
          } else {
            this.enviando = false;
            this.swal.exito('Ticket creado', `Número: ${t.number} (${t.priority})`);
            this.router.navigate(['/soporte/tickets', t.id]);
          }
        },
        error: (e) => {
          this.enviando = false;
          this.swal.error('No se pudo crear el ticket', this.msg(e));
        },
      });
  }

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

  private msg(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' · ') : m || e?.message || 'Error desconocido';
  }
}