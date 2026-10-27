import { Component, OnInit } from '@angular/core';
import {
  ConsultaActividad,
  ConsultaFetchResultado,
  ConsultaScrinUsuario,
  MonitorHorasService,
} from '../services/monitor-horas.service';
import { SwalService } from '../../core/services/swal.service';
import { descargarCsv } from '../../core/utils/csv.util';

/**
 * Consulta multiusuario del Monitor de Horas (Scrin), SOLO LECTURA.
 * Selecciona usuarios con token + id Scrin, consulta Scrin por rango de fechas
 * (guarda en staging) y muestra los registros en una tabla.
 */
@Component({
  selector: 'app-consulta-monitor-horas',
  standalone: false,
  templateUrl: './consulta-monitor-horas.component.html',
})
export class ConsultaMonitorHorasComponent implements OnInit {
  usuarios: ConsultaScrinUsuario[] = [];
  seleccionados = new Set<number>();
  filtroUsuario = '';
  usuarioParaAgregar?: number;

  from = '';
  to = '';

  actividades: ConsultaActividad[] = [];
  resultados: ConsultaFetchResultado[] = [];

  loadingUsuarios = false;
  loadingConsulta = false;
  consultado = false;
  modo: 'actual' | 'procesadas' | 'todas' = 'todas';

  /** Precio por hora en divisa (USD/h) usado para valorizar la exportación. */
  readonly precioHoraUsd = 4;

  constructor(
    private readonly service: MonitorHorasService,
    private readonly swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.rangoMes();
    this.cargarUsuarios();
  }

  private rangoMes(): void {
    const hoy = new Date();
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.from = iso(ini);
    this.to = iso(hoy);
  }

  cargarUsuarios(): void {
    this.loadingUsuarios = true;
    this.service.consultaUsuarios().subscribe({
      next: (u) => {
        this.usuarios = u;
        this.loadingUsuarios = false;
      },
      error: (err) => {
        this.loadingUsuarios = false;
        this.swal.error('Error', err?.error?.message || 'No se pudieron cargar los usuarios');
      },
    });
  }

  /** Usuarios que aun no estan agregados (opciones del desplegable), con filtro de texto. */
  get usuariosDisponibles(): ConsultaScrinUsuario[] {
    const t = this.filtroUsuario.trim().toLowerCase();
    return this.usuarios.filter(
      (u) =>
        !this.seleccionados.has(u.idUser) &&
        (!t ||
          (u.nameUser || '').toLowerCase().includes(t) ||
          (u.login || '').toLowerCase().includes(t)),
    );
  }

  /** Usuarios agregados a la lista de consulta. */
  get usuariosSeleccionados(): ConsultaScrinUsuario[] {
    return this.usuarios.filter((u) => this.seleccionados.has(u.idUser));
  }

  get totalSeleccionados(): number {
    return this.seleccionados.size;
  }

  agregarUsuario(): void {
    const id = Number(this.usuarioParaAgregar);
    if (!id || this.seleccionados.has(id)) return;
    this.seleccionados.add(id);
    this.usuarioParaAgregar = undefined;
  }

  quitarUsuario(u: ConsultaScrinUsuario): void {
    this.seleccionados.delete(u.idUser);
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
  }

  consultar(): void {
    const ids = [...this.seleccionados];
    if (!ids.length) {
      this.swal.advertencia('Selección', 'Seleccione al menos un usuario.');
      return;
    }
    if (!this.from || !this.to) {
      this.swal.advertencia('Rango de fechas', 'Indique la fecha Desde y Hasta.');
      return;
    }
    if (this.from > this.to) {
      this.swal.advertencia('Rango de fechas', 'La fecha Desde no puede ser mayor a Hasta.');
      return;
    }

    // Vista "Procesadas": consulta directa a la BD (sin llamar a Scrin).
    if (this.modo === 'procesadas') {
      this.loadingConsulta = true;
      this.service.consultaActividades(ids, this.from, this.to, 1).subscribe({
        next: (rows) => {
          this.actividades = rows;
          this.consultado = true;
          this.loadingConsulta = false;
          this.swal.info('Horas procesadas', `${rows.length} registro(s) en el rango.`);
        },
        error: (e) => {
          this.loadingConsulta = false;
          this.swal.error('Error', e?.error?.message || 'No se pudieron listar los registros');
        },
      });
      return;
    }

    // Vista "Todas": lee lo almacenado (pendientes y procesadas) en el rango.
    if (this.modo === 'todas') {
      this.loadingConsulta = true;
      this.service.consultaActividades(ids, this.from, this.to).subscribe({
        next: (rows) => {
          this.actividades = rows;
          this.consultado = true;
          this.loadingConsulta = false;
          this.swal.info('Horas (todas)', `${rows.length} registro(s) en el rango.`);
        },
        error: (e) => {
          this.loadingConsulta = false;
          this.swal.error('Error', e?.error?.message || 'No se pudieron listar los registros');
        },
      });
      return;
    }

    // Vista "Actual": trae en vivo desde Scrin y guarda en staging (sync_status=0).
    this.loadingConsulta = true;
    this.service.consultaFetch(ids, this.from, this.to).subscribe({
      next: (r) => {
        this.resultados = r.resultados ?? [];
        this.service.consultaActividades(ids, this.from, this.to, 0).subscribe({
          next: (rows) => {
            this.actividades = rows;
            this.consultado = true;
            this.loadingConsulta = false;
            const ok = this.resultados.filter((x) => x.ok).length;
            const err = this.resultados.filter((x) => !x.ok).length;
            this.swal.info(
              'Consulta Scrin',
              `${ok} usuario(s) consultado(s)${err ? ` · ${err} con error` : ''} · ${rows.length} registro(s).`,
            );
          },
          error: (e) => {
            this.loadingConsulta = false;
            this.swal.error('Error', e?.error?.message || 'No se pudieron listar los registros');
          },
        });
      },
      error: (e) => {
        this.loadingConsulta = false;
        this.swal.error('Error al consultar Scrin', e?.error?.message || 'No se pudo consultar');
      },
    });
  }

  /** Limpia resultados al cambiar de modo para evitar datos mezclados. */
  alCambiarModo(): void {
    this.actividades = [];
    this.resultados = [];
    this.consultado = false;
  }

  totalMinutos(): number {
    return this.actividades.reduce((s, a) => s + (a.durationMinutes || 0), 0);
  }

  /** Minutos convertidos a horas decimales (2 decimales). */
  horasDe(min?: number | string | null): number {
    return Math.round(((Number(min) || 0) / 60) * 100) / 100;
  }

  /** Monto en divisa de una fila: horas convertidas × precio. */
  montoDe(min?: number | string | null): number {
    return Math.round(this.horasDe(min) * this.precioHoraUsd * 100) / 100;
  }

  /** Monto total (suma de los montos por fila). */
  totalMonto(): number {
    return (
      Math.round(
        this.actividades.reduce((s, a) => s + this.montoDe(a.durationMinutes), 0) * 100,
      ) / 100
    );
  }

  formatMin(min?: number): string {
    const m = Number(min || 0);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  }

  /**
   * Exporta la tabla a CSV (compatible con Excel) con:
   * - minutos y horas convertidas (decimales),
   * - precio en divisa (USD/h) y monto por fila (horas × precio),
   * - y una fila TOTAL con los acumulados.
   */
  exportar(): void {
    if (!this.actividades.length) {
      this.swal.advertencia('Exportar', 'No hay registros para exportar.');
      return;
    }
    const filas = this.actividades.map((a) => [
      a.userName || a.employeeName || a.idUser || '',
      a.syncStatus === 1 ? 'Procesada' : 'Actual',
      a.scrinProjectName || '',
      a.employeeName || '',
      a.dateActivity || '',
      a.hourIni || '',
      a.hourFin || '',
      a.durationMinutes || 0,
      this.horasDe(a.durationMinutes).toFixed(2),
      this.precioHoraUsd.toFixed(2),
      this.montoDe(a.durationMinutes).toFixed(2),
      a.offline === 1 ? 'Si' : 'No',
      a.proyectoLabel || '',
      a.clienteLabel || '',
      a.note || '',
    ]);

    // Fila de totales.
    const totalMin = this.totalMinutos();
    filas.push([
      'TOTAL', '', '', '', '', '', '',
      totalMin,
      this.horasDe(totalMin).toFixed(2),
      '',
      this.totalMonto().toFixed(2),
      '', '', '', '',
    ]);

    descargarCsv(
      `consulta-monitor-horas_${this.from}_${this.to}.csv`,
      [
        'Usuario', 'Estado', 'Proyecto Scrin', 'Empleado', 'Fecha', 'Inicio', 'Fin',
        'Minutos', 'Horas', 'Precio USD/h', 'Monto USD', 'Offline', 'Proyecto SGH',
        'Cliente SGH', 'Nota',
      ],
      filas,
    );
  }
}
