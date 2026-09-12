import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { Cliente, Proyecto, ProyectoActividadRow } from '../models/sgh.models';

@Component({
  selector: 'app-proyectos-form',
  standalone: false,
  templateUrl: './proyectos-form.component.html',
})
export class ProyectosFormComponent implements OnInit {
  clientes: Cliente[] = [];
  dto: Partial<Proyecto> & { actividades?: ProyectoActividadRow[] } = {
    numdoc: '',
    dateProyect: '',
    dateIni: '',
    dateFin: '',
    responsable: '',
    idClient: undefined,
    status: 1,
    enterprise: 0,
    actividades: [],
  };
  id?: number;
  editando = false;
  loading = false;
  error = '';

  constructor(
    private service: SghService,
    private route: ActivatedRoute,
    private router: Router,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.service.listClientes(1).subscribe((c) => (this.clientes = c));
    this.id = this.route.snapshot.params['id'];
    if (this.id) {
      this.editando = true;
      this.loading = true;

      this.service.getProyecto(this.id).subscribe({
        next: (p) => {
          // Se muta el objeto dto (no se reemplaza) para no perder 'actividades'
          this.dto.numdoc = p.numdoc;
          this.dto.dateProyect = this.toDateStr(p.dateProyect);
          this.dto.dateIni = this.toDateStr(p.dateIni);
          this.dto.dateFin = this.toDateStr(p.dateFin);
          this.dto.responsable = p.responsable;
          this.dto.idClient = p.idClient;
          this.dto.status = p.status;
          this.dto.enterprise = p.enterprise ?? 0;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.setError(err);
        },
      });

      this.service.detalleProyecto(this.id).subscribe({
        next: (d) => {
          this.dto.actividades = d.map((fila) => ({
            idProyectActivity: fila.idProyectActivity,
            idEp: fila.idEp,
            hour: fila.hour,
            hourE: fila.hourE,
            active: fila.active,
            name: fila.name,
            nameProcess: fila.nameProcess,
          }));
        },
        error: (err) => this.setError(err),
      });
    }
  }

  toDateStr(d: Date | string | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  guardar(): void {
    this.error = '';
    this.loading = true;
    const actividades = (this.dto.actividades ?? []).map((a) => ({
      idProyectActivity: a.idProyectActivity,
      idEp: a.idEp,
      hour: a.hour,
      hourE: a.hourE,
      active: a.active,
    }));
    const body = {
      ...this.dto,
      actividades,
      dateProyect: this.dto.dateProyect || new Date().toISOString().slice(0, 10),
    };
    const obs = this.editando && this.id
      ? this.service.updateProyecto(this.id, body)
      : this.service.createProyecto(body);
    obs.subscribe({
      next: () => {
        this.swal.exito(this.editando ? 'Proyecto actualizado' : 'Proyecto creado');
        this.router.navigate(['/sgh/proyectos']);
      },
      error: (err) => {
        this.loading = false;
        this.swal.error('Error al guardar', this.mensajeError(err));
      },
    });
  }

  private mensajeError(err: any): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo completar la operación');
  }

  setError(err: any): void {
    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error en la operación';
  }
}
