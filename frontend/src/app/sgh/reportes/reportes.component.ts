import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SghService } from '../services/sgh.service';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { abrirPdf } from '../../core/utils/pdf.util';
import { TipoActividad, Proceso, Cliente, UsuarioSgh } from '../models/sgh.models';

export interface FilaReporte {
  idActivity: number;
  numdoc: string;
  name?: string;
  nameType?: string;
  nameProcess?: string;
  nameUser?: string;
  dateDocument?: string;
  situation?: string;
  detalleNota?: string;
  hours?: number;
  mantis?: string;
  status?: number;
}

@Component({
  selector: 'app-reportes',
  standalone: false,
  templateUrl: './reportes.component.html',
})
export class ReportesComponent implements OnInit {
  tipos: TipoActividad[] = [];
  procesos: Proceso[] = [];
  clientes: Cliente[] = [];
  usuarios: UsuarioSgh[] = [];
  esAdminReportes = false;
  miIdUser?: number;

  fecini = '';
  fecfin = '';
  idType?: number;
  idProcess?: number;
  idClient?: number;
  idUser?: number;
  /** Modalidad: 1 = online · 0 = presencial · undefined = todas */
  online?: number;

  loading = false;
  filas: FilaReporte[] = [];
  consultado = false;

  constructor(
    private readonly service: SghService,
    private readonly auth: AuthService,
    private readonly swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.hoy();
    this.cargarCatalogos();
  }

  hoy(): void {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.fecini = iso;
    this.fecfin = iso;
  }

  private cargarCatalogos(): void {
    forkJoin({
      tipos: this.service.listTipos(1),
      procesos: this.service.listProcesos(1),
      clientes: this.service.listClientes(1),
      usuarios: this.service.listUsuariosSgh(1),
    }).subscribe((c) => {
      this.tipos = c.tipos;
      this.procesos = c.procesos;
      this.clientes = c.clientes;
      this.usuarios = c.usuarios;
      this.aplicarReglaDeRol();
    });
  }

  /**
   * Regla de acceso por rol de sgh_users:
   * - rol 'A' (administrador): puede ver los reportes de TODOS los usuarios,
   *   mostrando el select "Consultor" completo.
   * - Cualquier otro rol (o sin perfil sgh): ve SOLO sus propios datos;
   *   se oculta el select y se fuerza su id_user.
   */
  private aplicarReglaDeRol(): void {
    const login = this.auth.currentUser?.login;
    if (!login) return;
    const perfil = this.usuarios.find(
      (u) => u.login.toLowerCase() === login.toLowerCase(),
    );
    this.esAdminReportes = perfil?.rol === 'A';
    if (this.esAdminReportes) return;

    // No administrador: forzar su propio id_user (si tiene perfil) y ocultar select
    this.miIdUser = perfil?.idUser;
    if (this.miIdUser) {
      this.idUser = this.miIdUser;
    } else {
      this.idUser = undefined;
    }
  }

  limpiar(): void {
    this.fecini = '';
    this.fecfin = '';
    this.idType = undefined;
    this.idProcess = undefined;
    this.idClient = undefined;
    if (this.esAdminReportes) {
      this.idUser = undefined;
    } else {
      this.idUser = this.miIdUser;
    }
    this.online = undefined;
    this.filas = [];
    this.consultado = false;
  }

  generar(): void {
    if (!this.fecini || !this.fecfin) {
      this.swal.advertencia('Rango de fechas', 'Indique la fecha Desde y Hasta.');
      return;
    }
    if (this.fecini > this.fecfin) {
      this.swal.advertencia('Rango de fechas', 'La fecha Desde no puede ser mayor a Hasta.');
      return;
    }

    this.loading = true;
    this.consultado = false;
    this.service
      .reporteActividades({
        fecini: this.fecini,
        fecfin: this.fecfin,
        idType: this.idType,
        idProcess: this.idProcess,
        idClient: this.idClient,
        online: this.online,
        idUser: this.esAdminReportes ? this.idUser : this.miIdUser,
      })
      .subscribe({
        next: (d) => {
          this.filas = (d as unknown) as FilaReporte[];
          this.consultado = true;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          const msg = err?.error?.message;
          this.swal.error('Error al generar el reporte', Array.isArray(msg) ? msg.join(' · ') : (msg || 'No se pudo generar el reporte'));
        },
      });
  }

  totalHoras(): number {
    return this.filas.reduce((acc, f) => acc + Number(f.hours || 0), 0);
  }

  exportarPdf(): void {
    if (!this.fecini || !this.fecfin) {
      this.swal.advertencia('Rango de fechas', 'Indique la fecha Desde y Hasta.');
      return;
    }
    this.swal.cargando('Generando PDF...');
    this.service
      .pdfReporte({
        fecini: this.fecini,
        fecfin: this.fecfin,
        idType: this.idType,
        idProcess: this.idProcess,
        idClient: this.idClient,
        online: this.online,
        idUser: this.esAdminReportes ? this.idUser : this.miIdUser,
      })
      .subscribe({
        next: (blob) => {
          this.swal.cerrar();
          abrirPdf(blob, 'reporte-actividades.pdf');
        },
        error: () => {
          this.swal.cerrar();
          this.swal.error('Error al generar el PDF', 'No se pudo generar el reporte PDF');
        },
      });
  }
}
