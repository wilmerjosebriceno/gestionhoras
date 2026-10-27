import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  MonitorActivity,
  MonitorHorasService,
  MonitorSummary,
  ScrinConfig,
  VerificacionScrin,
} from '../services/monitor-horas.service';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import { Proyecto, TipoActividad, Proceso, ItemActividad } from '../models/sgh.models';

@Component({
  selector: 'app-monitor-horas',
  standalone: false,
  templateUrl: './monitor-horas.component.html',
})
export class MonitorHorasComponent implements OnInit {
  config: ScrinConfig | null = null;
  editandoConfig = false;
  verificacion: VerificacionScrin | null = null;
  verificando = false;
  form = { scrinCompanyId: undefined as number | undefined, scrinEmploymentId: undefined as number | undefined, scrinToken: '' };

  from = '';
  to = '';

  activities: MonitorActivity[] = [];
  summaries: MonitorSummary[] = [];

  proyectos: Proyecto[] = [];
  tipos: TipoActividad[] = [];
  procesos: Proceso[] = [];
  items: ItemActividad[] = [];

  loadingConfig = false;
  loadingFetch = false;
  loadingSummary = false;
  loadingProcess = false;
  loadingCheckAll = false;
  consultado = false;

  constructor(
    private readonly service: MonitorHorasService,
    private readonly sgh: SghService,
    private readonly swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.rangoSemana();
    this.cargarConfig();
    this.cargarCatalogos();
  }

  private rangoSemana(): void {
    const hoy = new Date();
    const lunes = new Date(hoy);
    const dia = (hoy.getDay() + 6) % 7;
    lunes.setDate(hoy.getDate() - dia);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.from = iso(lunes);
    this.to = iso(hoy);
  }

  cargarConfig(): void {
    this.loadingConfig = true;
    this.service.getConfig().subscribe({
      next: (c) => {
        this.config = c;
        this.form.scrinCompanyId = c.scrinCompanyId ?? undefined;
        this.form.scrinEmploymentId = c.scrinEmploymentId ?? undefined;
        this.loadingConfig = false;
      },
      error: (err) => {
        this.loadingConfig = false;
        this.swal.error('Error', err?.error?.message || 'No se pudo cargar la configuración');
      },
    });
  }

  private cargarCatalogos(): void {
    forkJoin({
      proyectos: this.sgh.listProyectos(),
      tipos: this.sgh.listTipos(1),
      procesos: this.sgh.listProcesos(1),
      items: this.sgh.listItems(1),
    }).subscribe({
      next: (c) => {
        this.proyectos = c.proyectos;
        this.tipos = c.tipos;
        this.procesos = c.procesos;
        this.items = c.items;
      },
    });
  }

  guardarConfig(): void {
    this.loadingConfig = true;
    const dto = {
      scrinCompanyId: this.form.scrinCompanyId,
      scrinEmploymentId: this.form.scrinEmploymentId,
      ...(this.form.scrinToken ? { scrinToken: this.form.scrinToken } : {}),
    };
    this.service.saveConfig(dto).subscribe({
      next: (c) => {
        this.config = c;
        this.form.scrinToken = '';
        this.editandoConfig = false;
        this.verificacion = null;
        this.loadingConfig = false;
        this.swal.exito('Configuración guardada', 'Su identidad Scrin quedó asociada.');
      },
      error: (err) => {
        this.loadingConfig = false;
        this.swal.error('Error', err?.error?.message || 'No se pudo guardar la configuración');
      },
    });
  }

  /** Muestra/oculta el formulario de configuración (limpia lo efímero). */
  toggleConfig(): void {
    this.editandoConfig = !this.editandoConfig;
    this.verificacion = null;
    if (!this.editandoConfig) this.form.scrinToken = '';
  }

  /**
   * Prueba la conexión contra Scrin con el token y el ID indicados (o los
   * guardados). Detecta el caso peligroso: el ID no existe en ScreenMonitor
   * (Scrin responde 200 con lista vacía y parece "no hubo horas").
   */
  verificarConexion(): void {
    this.verificando = true;
    this.verificacion = null;
    const dto = {
      ...(this.form.scrinEmploymentId ? { scrinEmploymentId: this.form.scrinEmploymentId } : {}),
      ...(this.form.scrinToken ? { scrinToken: this.form.scrinToken } : {}),
    };
    this.service.verificarConfig(dto).subscribe({
      next: (r) => {
        this.verificacion = r;
        this.verificando = false;
      },
      error: (err) => {
        this.verificando = false;
        this.swal.error('Error', err?.error?.message || 'No se pudo verificar la conexión con Scrin');
      },
    });
  }

  /** Carga en el formulario el ID que Scrin sugiere para este usuario. */
  usarIdSugerido(): void {
    const s = this.verificacion?.sugerido;
    if (!s) return;
    this.form.scrinEmploymentId = s.id;
    this.editandoConfig = true;
    this.verificacion = null;
    this.swal.info(
      'ID sugerido aplicado',
      `Se cargó ${s.id} (${s.name}). Pulse "Guardar configuración" para confirmarlo.`,
    );
  }

  /** Hay sugerencia de ID pendiente de aplicar. */
  get haySugerencia(): boolean {
    return !!this.verificacion?.sugerido;
  }

  consultar(): void {
    if (!this.config?.configurado) {
      this.swal.advertencia('Configuración', 'Primero configure su token e ID de Scrin.');
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
    this.loadingFetch = true;
    this.service.fetch(this.from, this.to).subscribe({
      next: (r) => {
        this.loadingFetch = false;
        this.consultado = true;
        this.swal.info(
          'Consulta Scrin',
          `${r.fetched} registros obtenidos · ${r.inserted} nuevos · ${r.duplicates} duplicados.`,
        );
        this.cargarActividades();
      },
      error: (err) => {
        this.loadingFetch = false;
        this.swal.error('Error al consultar Scrin', err?.error?.message || 'No se pudo obtener la información');
      },
    });
  }

  cargarActividades(): void {
    this.service.listActivities({ from: this.from, to: this.to }).subscribe({
      next: (rows) => (this.activities = rows),
      error: (err) => this.swal.error('Error', err?.error?.message || 'No se pudieron listar los registros'),
    });
  }

  toggle(a: MonitorActivity): void {
    const nuevo = a.selected ? 0 : 1;
    a.selected = nuevo;
    this.service.check(a.idScrinActivity, nuevo === 1).subscribe({
      error: (err) => {
        a.selected = nuevo ? 0 : 1;
        this.swal.error('Error', err?.error?.message || 'No se pudo actualizar la selección');
      },
    });
  }

  marcarTodos(valor: boolean): void {
    if (this.loadingCheckAll) return;
    const pendientes = this.activities.filter((a) => a.syncStatus === 0);
    if (pendientes.length === 0) {
      this.swal.advertencia('Sin registros', 'No hay registros pendientes por marcar.');
      return;
    }
    // Una sola peticion al backend (evita el limite de peticiones del servidor,
    // que antes se alcanzaba al marcar fila por fila).
    this.loadingCheckAll = true;
    this.service.checkAll(valor, this.from, this.to).subscribe({
      next: (r) => {
        this.loadingCheckAll = false;
        pendientes.forEach((a) => (a.selected = valor ? 1 : 0));
        this.swal.info(
          'Selección',
          `${r.updated} registro(s) ${valor ? 'marcados como válidos' : 'desmarcados'}.`,
        );
      },
      error: (err) => {
        this.loadingCheckAll = false;
        this.swal.error('Error', err?.error?.message || 'No se pudo actualizar la selección');
      },
    });
  }

  /** (Checklist) Todos los pendientes estan marcados. */
  todosSeleccionados(): boolean {
    const pendientes = this.activities.filter((a) => a.syncStatus === 0);
    return pendientes.length > 0 && pendientes.every((a) => a.selected === 1);
  }

  /** (Checklist) Hay una seleccion parcial -> estado indeterminado. */
  seleccionParcial(): boolean {
    const pendientes = this.activities.filter((a) => a.syncStatus === 0);
    return pendientes.some((a) => a.selected === 1) && !this.todosSeleccionados();
  }

  totalMinutosSeleccionados(): number {
    return this.activities
      .filter((a) => a.selected === 1 && a.syncStatus === 0)
      .reduce((s, a) => s + (a.durationMinutes || 0), 0);
  }

  generarResumen(): void {
    if (this.totalMinutosSeleccionados() === 0) {
      this.swal.advertencia('Sin selección', 'Marque al menos un registro válido antes de generar el resumen.');
      return;
    }
    this.loadingSummary = true;
    this.service.buildSummary(this.from, this.to).subscribe({
      next: (rows) => {
        this.loadingSummary = false;
        this.summaries = rows;
        this.swal.exito('Resumen generado', `${rows.length} grupo(s) por proyecto + nota.`);
        this.cargarResumen();
      },
      error: (err) => {
        this.loadingSummary = false;
        this.swal.error('Error al generar el resumen', err?.error?.message || 'No se pudo agrupar');
      },
    });
  }

  cargarResumen(): void {
    this.service.listSummary(this.from, this.to).subscribe({
      next: (rows) => {
        this.summaries = rows.map((r) => ({ ...r, idProyect: r.idProyect ?? undefined }));
      },
      error: (err) => this.swal.error('Error', err?.error?.message || 'No se pudo listar el resumen'),
    });
  }

  guardarAsignacion(s: MonitorSummary): void {
    if (!s.idProyect) {
      this.swal.advertencia('Proyecto requerido', 'Seleccione el proyecto SGH correspondiente.');
      return;
    }
    this.service
      .assignSummary(s.idScrinSummary, {
        idProyect: Number(s.idProyect),
        idType: s.idType ? Number(s.idType) : undefined,
        idProcess: s.idProcess ? Number(s.idProcess) : undefined,
        idItemActivity: s.idItemActivity ? Number(s.idItemActivity) : undefined,
        note: s.note,
      })
      .subscribe({
        next: (r) => {
          Object.assign(s, r);
          this.swal.exito(
            'Asignación guardada',
            `Proyecto vinculado · Cliente: ${this.clienteProyecto(s.idProyect)}.`,
          );
        },
        error: (err) =>
          this.swal.error('Error', err?.error?.message || 'No se pudo guardar la asignación'),
      });
  }

  procesar(s: MonitorSummary): void {
    if (!s.idProyect) {
      this.swal.advertencia('Proyecto requerido', 'Seleccione el proyecto SGH antes de procesar.');
      return;
    }
    const horas = (s.totalMinutes / 60).toFixed(2);
    const cliente = this.clienteProyecto(s.idProyect);
    this.swal
      .confirmar({
        titulo: 'Procesar resumen',
        texto: `Se registrará 1 actividad en el sistema de horas por ${horas} h en "${this.nombreProyecto(
          s.idProyect,
        )}" · Cliente: ${cliente}. ¿Continuar?`,
      })
      .then((ok) => {
        if (!ok) return;
        this.loadingProcess = true;
        // Guardar la asignación primero (idempotente) y luego procesar, para que
        // el backend siempre reciba el proyecto aunque no se haya pulsado "Guardar".
        this.service
          .assignSummary(s.idScrinSummary, {
            idProyect: Number(s.idProyect),
            idType: s.idType ? Number(s.idType) : undefined,
            idProcess: s.idProcess ? Number(s.idProcess) : undefined,
            idItemActivity: s.idItemActivity ? Number(s.idItemActivity) : undefined,
            note: s.note,
          })
          .subscribe({
            next: (asignado) => {
              Object.assign(s, asignado);
              this.service.processSummary(s.idScrinSummary).subscribe({
                next: () => {
                  this.loadingProcess = false;
                  this.swal.exito('Procesado', 'La actividad fue creada en el sistema de horas.');
                  this.cargarResumen();
                  this.cargarActividades();
                },
                error: (err) => {
                  this.loadingProcess = false;
                  this.swal.error('Error al procesar', err?.error?.message || 'No se pudo procesar');
                },
              });
            },
            error: (err) => {
              this.loadingProcess = false;
              this.swal.error('Error al guardar la asignación', err?.error?.message || 'No se pudo asignar');
            },
          });
      });
  }

  formatMin(min?: number): string {
    const m = Number(min || 0);
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h ${String(r).padStart(2, '0')}m`;
  }

  nombreProyecto(idProyect?: number): string {
    if (!idProyect) return '—';
    const p = this.proyectos.find((x) => x.idProyect === Number(idProyect));
    if (!p) return `#${idProyect}`;
    return `${p.numdoc ?? '#' + p.idProyect} — ${p.responsable ?? ''}`;
  }

  /** Cliente asociado al proyecto SGH; se muestra/usa automáticamente al seleccionar el proyecto. */
  clienteProyecto(idProyect?: number): string {
    if (!idProyect) return '—';
    const p = this.proyectos.find((x) => x.idProyect === Number(idProyect));
    if (!p) return `#${idProyect}`;
    return p.nameClient || '—';
  }

  idClienteProyecto(idProyect?: number): number | undefined {
    if (!idProyect) return undefined;
    return this.proyectos.find((x) => x.idProyect === Number(idProyect))?.idClient;
  }
}
