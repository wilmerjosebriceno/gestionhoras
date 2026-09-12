import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { Fase, Seguimiento, Hito, UsuarioSgh, Proyecto } from '../models/sgh.models';

@Component({
  selector: 'app-cronograma',
  standalone: false,
  templateUrl: './cronograma.component.html',
})
export class CronogramaComponent implements OnInit {
  idProyect!: number;
  header: { numdoc?: string; responsable?: string; dateIni?: string; dateFin?: string; nameClient?: string } = {};
  fases: Fase[] = [];
  hitos: Hito[] = [];
  usuarios: UsuarioSgh[] = [];
  loading = true;
  error = '';

  faseEditar?: Fase;
  faseForm: any = {};
  seguimientoFase?: Fase;
  segForm: any = {};
  segHistorial: Seguimiento[] = [];
  hitoForm: any = {};
  mostrandoHito = false;

  // Selección de proyecto cuando se entra sin id
  necesitaProyecto = false;
  proyectos: Proyecto[] = [];
  proyectoSel?: number;

  constructor(private route: ActivatedRoute, private service: SghService, private swal: SwalService) {}

  ngOnInit(): void {
    this.idProyect = Number(this.route.snapshot.params['idProyect'] ?? 0);
    this.service.listUsuariosSgh(1).subscribe((u) => (this.usuarios = u));
    if (!this.idProyect || this.idProyect <= 0) {
      this.necesitaProyecto = true;
      this.cargarProyectos();
      return;
    }
    this.cargar();
  }

  cargarProyectos(): void {
    this.service.listProyectos().subscribe((p) => (this.proyectos = p));
  }

  seleccionarProyecto(): void {
    if (!this.proyectoSel) return;
    this.idProyect = this.proyectoSel;
    this.necesitaProyecto = false;
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.cronogramaProyecto(this.idProyect).subscribe((h) => (this.header = h));
    this.service.cronogramaFases(this.idProyect).subscribe({
      next: (f) => {
        this.fases = f;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.setError(err);
      },
    });
    this.service.hitosProyecto(this.idProyect).subscribe((h) => (this.hitos = h));
  }

  estadoFase(s: number): string {
    switch (s) {
      case 0: return 'Pendiente';
      case 1: return 'En Curso';
      case 2: return 'Atrasada';
      case 3: return 'Cerrada';
      default: return 'Pendiente';
    }
  }

  colorFase(s: number): string {
    switch (s) {
      case 0: return 'bg-yellow-900/60 text-yellow-300';
      case 1: return 'bg-blue-900/60 text-blue-300';
      case 2: return 'bg-red-900/60 text-red-300';
      case 3: return 'bg-green-900/60 text-green-300';
      default: return 'bg-gray-700 text-gray-400';
    }
  }

  abrirEditarFase(f: Fase): void {
    this.faseEditar = f;
    this.faseForm = {
      fechaIniPlan: this.toDateStr(f.fechaIniPlan),
      fechaFinPlan: this.toDateStr(f.fechaFinPlan),
      fechaIniReal: this.toDateStr(f.fechaIniReal),
      fechaFinReal: this.toDateStr(f.fechaFinReal),
      idUserResponsable: f.idUserResponsable,
      status: f.status,
      avanceModelo: f.avanceModelo,
      avance: f.avance,
    };
  }

  guardarFase(): void {
    if (!this.faseEditar) return;
    this.service.updateFase(this.faseEditar.idCron, this.faseForm).subscribe({
      next: () => {
        this.swal.exito('Fase actualizada');
        this.faseEditar = undefined;
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  abrirSeguimiento(f: Fase): void {
    this.seguimientoFase = f;
    this.segForm = { idCron: f.idCron, idProyect: f.idProyect, idUser: this.usuarios[0]?.idUser, statusNew: f.status, avanceNew: f.avanceFinal, comentario: '' };
    this.segHistorial = [];
    this.service.seguimientoFase(f.idCron).subscribe((s) => (this.segHistorial = s));
  }

  guardarSeguimiento(): void {
    if (!this.seguimientoFase) return;
    this.service.registrarSeguimiento(this.segForm).subscribe({
      next: () => {
        this.swal.exito('Seguimiento registrado');
        this.seguimientoFase = undefined;
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  nuevoHito(): void {
    this.hitoForm = { idProyect: this.idProyect, idCron: this.fases[0]?.idCron, nombre: '', fechaPlan: '', fechaReal: '', status: 0, peso: 0, comentario: '' };
    this.mostrandoHito = true;
  }

  guardarHito(): void {
    this.service.createHito(this.hitoForm).subscribe({
      next: () => {
        this.swal.exito('Hito creado');
        this.mostrandoHito = false;
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  async eliminarHito(h: Hito): Promise<void> {
    const ok = await this.swal.confirmar({
      titulo: `¿Eliminar hito ${h.nombre}?`,
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.service.removeHito(h.idHito).subscribe({
      next: () => {
        this.swal.exito('Hito eliminado');
        this.cargar();
      },
      error: (err) => {
        this.setError(err);
        const msg = err?.error?.message;
        this.swal.error('Error al eliminar', Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo eliminar el hito'));
      },
    });
  }

  generar(): void {
    this.service.generarCronogramaProyecto(this.idProyect).subscribe({
      next: () => {
        this.swal.exito('Cronograma generado/actualizado');
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  toDateStr(d: string | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  setError(err: any): void {
    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error en la operación';
  }
}
