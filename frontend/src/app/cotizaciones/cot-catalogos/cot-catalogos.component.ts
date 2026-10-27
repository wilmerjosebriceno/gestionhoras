import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CotizacionesService } from '../services/cotizaciones.service';
import { CotClient, CotRegion, CotTemplate, CotEmpresa, CotTasaIva, CotRangoUsuario, CotTarifa } from '../models/cotizacion.model';
import { SwalService } from '../../core/services/swal.service';
import { descargarCsv } from '../../core/utils/csv.util';

@Component({
  selector: 'app-cot-catalogos',
  standalone: false,
  templateUrl: './cot-catalogos.component.html',
})
export class CotCatalogosComponent implements OnInit {
  tipo: string = 'clientes';
  clientes: CotClient[] = [];
  regiones: CotRegion[] = [];
  plantillas: CotTemplate[] = [];
  empresas: CotEmpresa[] = [];
  tasas: CotTasaIva[] = [];
  rangos: CotRangoUsuario[] = [];
  tarifas: CotTarifa[] = [];

  // Modelos de formulario
  nuevoCliente: Partial<CotClient> = {};
  nuevaRegion: Partial<CotRegion> = {};
  nuevaPlantilla: Partial<CotTemplate> = {};
  nuevaEmpresa: Partial<CotEmpresa> = {};
  nuevaTasa: Partial<CotTasaIva> = {};
  nuevoRango: Partial<CotRangoUsuario> = {};
  nuevaTarifa: Partial<CotTarifa> = {};

  editandoId?: number; // id del registro en edición (si aplica)
  mostrarForm = false;
  loading = false;
  error = '';

  /* ==== Búsqueda de clientes (nombre o RIF) ==== */
  busquedaCliente = '';
  clienteSeleccionado: CotClient | null = null;
  private debounceBusqueda?: ReturnType<typeof setTimeout>;

  constructor(
    private service: CotizacionesService,
    private route: ActivatedRoute,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((p) => {
      this.tipo = p['tipo'] || 'clientes';
      if (!['clientes', 'regiones', 'plantillas', 'empresas', 'tasas-iva', 'rangos', 'tarifas'].includes(this.tipo)) this.tipo = 'clientes';
      this.mostrarForm = false;
      this.resetForm();
      // Al cambiar de catalogo se limpia la busqueda de clientes.
      if (this.debounceBusqueda) clearTimeout(this.debounceBusqueda);
      this.busquedaCliente = '';
      this.clienteSeleccionado = null;
      this.cargar();
    });
  }

  cargar(): void {
    this.error = '';
    if (this.tipo === 'clientes') {
      this.cargarClientes();
      return;
    }
    this.loading = true;
    if (this.tipo === 'regiones') {
      this.service.listarRegiones(true).subscribe({ next: (r) => { this.regiones = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'empresas') {
      this.service.listarEmpresas().subscribe({ next: (r) => { this.empresas = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'tasas-iva') {
      // Muestra también inactivas para poder editarlas/activarlas
      this.service.listarTasas(true).subscribe({ next: (r) => { this.tasas = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'rangos') {
      this.service.listarRangos().subscribe({ next: (r) => { this.rangos = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'tarifas') {
      forkJoin({
        tarifas: this.service.listarTarifas(true),
        regiones: this.service.listarRegiones(),
        rangos: this.service.listarRangos(),
      }).subscribe({
        next: (r) => { this.tarifas = r.tarifas; this.regiones = r.regiones; this.rangos = r.rangos; this.loading = false; },
        error: () => { this.loading = false; this.error = 'Error al cargar'; },
      });
    } else {
      this.service.listarPlantillas().subscribe({ next: (r) => { this.plantillas = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    }
  }

  /* ============ Búsqueda de clientes ============ */

  /** Carga los clientes aplicando el filtro de búsqueda actual (nombre o RIF). */
  cargarClientes(): void {
    this.loading = true;
    this.error = '';
    const q = this.busquedaCliente.trim();
    this.service.listarClientes(q || undefined).subscribe({
      next: (r) => {
        this.clientes = r;
        this.loading = false;
        // Si el cliente seleccionado ya no está en los resultados, se quita la selección.
        if (this.clienteSeleccionado && !r.some((c) => c.idClient === this.clienteSeleccionado?.idClient)) {
          this.clienteSeleccionado = null;
        }
      },
      error: () => { this.loading = false; this.error = 'Error al cargar'; },
    });
  }

  /** Se ejecuta al escribir en el buscador (con retardo para no saturar el servidor). */
  onBuscarCliente(): void {
    if (this.debounceBusqueda) clearTimeout(this.debounceBusqueda);
    this.debounceBusqueda = setTimeout(() => this.cargarClientes(), 300);
  }

  /** Limpia la búsqueda y vuelve a mostrar todos los clientes. */
  limpiarBusqueda(): void {
    if (this.debounceBusqueda) clearTimeout(this.debounceBusqueda);
    this.busquedaCliente = '';
    this.clienteSeleccionado = null;
    this.cargarClientes();
  }

  /** Click en una fila: marca el cliente como seleccionado y lo abre para editar. */
  seleccionarCliente(c: CotClient): void {
    this.clienteSeleccionado = c;
    this.editar(c);
  }

  /** Abre el formulario vacío (crear). */
  toggleForm(): void {
    this.mostrarForm = !this.mostrarForm;
    if (!this.mostrarForm) {
      this.resetForm();
      this.clienteSeleccionado = null;
    }
  }

  /** Carga un registro en el formulario para editar. */
  editar(registro: any): void {
    this.resetForm();
    this.editandoId =
      this.tipo === 'tarifas' ? registro.idTarifa
      : this.tipo === 'rangos' ? registro.idRango
      : registro.idClient ?? registro.idRegion ?? registro.idTemplate ?? registro.idEmpresa ?? registro.idTasaIva;
    if (this.tipo === 'clientes') this.nuevoCliente = { ...registro };
    else if (this.tipo === 'regiones') this.nuevaRegion = { ...registro };
    else if (this.tipo === 'plantillas') this.nuevaPlantilla = { ...registro };
    else if (this.tipo === 'tasas-iva') this.nuevaTasa = { ...registro };
    else if (this.tipo === 'rangos') this.nuevoRango = { ...registro };
    else if (this.tipo === 'tarifas') this.nuevaTarifa = { ...registro };
    else this.nuevaEmpresa = { ...registro };
    this.mostrarForm = true;
  }

  guardar(): void {
    if (this.tipo === 'clientes') {
      if (!this.nuevoCliente.nameClient) { this.swal.advertencia('Cliente', 'Indique el nombre del cliente'); return; }
      const payload = this.quitarPK(this.nuevoCliente, 'idClient');
      const req = this.editandoId ? this.service.actualizarCliente(this.editandoId, payload) : this.service.crearCliente(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Cliente guardado'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    } else if (this.tipo === 'regiones') {
      if (!this.nuevaRegion.name) { this.swal.advertencia('Región', 'Indique el nombre de la región'); return; }
      const payload = this.quitarPK(this.nuevaRegion, 'idRegion');
      const req = this.editandoId ? this.service.actualizarRegion(this.editandoId, payload) : this.service.crearRegion(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Región guardada'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    } else if (this.tipo === 'empresas') {
      if (!this.nuevaEmpresa.company) { this.swal.advertencia('Empresa', 'Indique el nombre de la empresa'); return; }
      const payload = this.quitarPK(this.nuevaEmpresa, 'idEmpresa');
      const req = this.editandoId ? this.service.actualizarEmpresa(this.editandoId, payload) : this.service.crearEmpresa(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Empresa guardada'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    } else if (this.tipo === 'tasas-iva') {
      if (!this.editandoId) { this.swal.advertencia('Tasa de IVA', 'Solo se puede editar una tasa existente'); return; }
      const payload = this.quitarPK(this.nuevaTasa, 'idTasaIva');
      this.service.actualizarTasa(this.editandoId, payload).subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Tasa de IVA actualizada'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    } else if (this.tipo === 'rangos') {
      if (this.nuevoRango.desde == null || this.nuevoRango.hasta == null) { this.swal.advertencia('Rango', 'Indique desde y hasta'); return; }
      const payload = this.quitarPK(this.nuevoRango, 'idRango');
      const req = this.editandoId ? this.service.actualizarRango(this.editandoId, payload) : this.service.crearRango(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Rango guardado'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    } else if (this.tipo === 'tarifas') {
      if (this.nuevaTarifa.idRegion == null || this.nuevaTarifa.idRango == null || !this.nuevaTarifa.modalidad) { this.swal.advertencia('Tarifa', 'Indique región, rango y modalidad'); return; }
      const payload = this.quitarPK(this.nuevaTarifa, 'idTarifa');
      const req = this.editandoId ? this.service.actualizarTarifa(this.editandoId, payload) : this.service.crearTarifa(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Tarifa guardada'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    } else {
      if (!this.nuevaPlantilla.name) { this.swal.advertencia('Plantilla', 'Indique el nombre de la plantilla'); return; }
      const payload = this.quitarPK(this.nuevaPlantilla, 'idTemplate');
      const req = this.editandoId ? this.service.actualizarPlantilla(this.editandoId, payload) : this.service.crearPlantilla(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Plantilla guardada'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    }
  }

  /** Limpia el payload: quita la PK y propiedades de relación/OBJETO que el DTO rechaza (forbidNonWhitelisted). */
  private quitarPK(obj: any, key: string): any {
    const { [key]: _pk, client: _cli, region: _reg, template: _tpl, empresa: _emp, tasaIva: _tasa, rango: _rango, ...rest } = obj;
    return rest;
  }

  async eliminar(item: any): Promise<void> {
    if (this.tipo === 'tasas-iva') { this.swal.advertencia('Tasa de IVA', 'Las tasas de IVA no se eliminan, solo se editan o desactivan'); return; }
    const id = this.tipo === 'tarifas' ? item.idTarifa
      : this.tipo === 'rangos' ? item.idRango
      : item.idClient ?? item.idRegion ?? item.idTemplate ?? item.idEmpresa;
    const nombre = this.tipo === 'rangos' ? `${item.desde} – ${item.hasta}`
      : this.tipo === 'tarifas' ? `${item.modalidad} (${item.tarifa})`
      : item.nameClient ?? item.name ?? item.company ?? '';
    const ok = await this.swal.confirmar({ titulo: `¿Eliminar ${nombre}?`, textoConfirmar: 'Sí, eliminar' });
    if (!ok) return;
    const req =
      this.tipo === 'clientes' ? this.service.eliminarCliente(id) :
      this.tipo === 'regiones' ? this.service.eliminarRegion(id) :
      this.tipo === 'empresas' ? this.service.eliminarEmpresa(id) :
      this.tipo === 'rangos' ? this.service.eliminarRango(id) :
      this.tipo === 'tarifas' ? this.service.eliminarTarifa(id) :
      this.service.eliminarPlantilla(id);
    req.subscribe({ next: () => { if (this.clienteSeleccionado?.idClient === id) this.clienteSeleccionado = null; this.cargar(); this.swal.exito('Eliminado'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo eliminar') });
  }

  esEdicion(): boolean {
    return !!this.editandoId;
  }

  /** Sincroniza los clientes formales (sgh_client) hacia cot_client. */
  sincronizar(): void {
    this.swal.cargando('Sincronizando clientes formales...');
    this.service.sincronizarClientes().subscribe({
      next: (r) => {
        this.swal.cerrar();
        this.swal.exito(`Clientes sincronizados (${r.insertados} nuevos, ${r.actualizados} actualizados)`);
        this.cargar();
      },
      error: (e) => {
        this.swal.cerrar();
        this.swal.error('Error', e.error?.message || 'No se pudo sincronizar');
      },
    });
  }

  /* ============ Exportar / Importar tarifas (CSV) ============ */

  /** Exporta el catálogo de tarifas a CSV (región, rango, modalidad, tarifa). */
  exportarTarifas(): void {
    const filas = this.tarifas.map((t) => {
      const reg = t.region ?? this.regiones.find((r) => r.idRegion === t.idRegion);
      const rango = t.rango ?? this.rangos.find((g) => g.idRango === t.idRango);
      return [reg?.code || reg?.name || t.idRegion, rango?.desde ?? '', rango?.hasta ?? '', t.modalidad, t.tarifa];
    });
    descargarCsv('tarifas-cot', ['Region', 'Desde', 'Hasta', 'Modalidad', 'Tarifa'], filas);
  }

  /** Descarga una plantilla de importación con el formato esperado. */
  descargarPlantillaTarifas(): void {
    descargarCsv('plantilla-tarifas', ['Region', 'Desde', 'Hasta', 'Modalidad', 'Tarifa'], [
      ['ORIENTAL', 1, 30, 'PRESENCIAL', 115],
      ['ORIENTAL', 31, 50, 'ONLINE', 55],
    ]);
  }

  /** Importa tarifas desde un CSV. Crea o actualiza según (región, rango, modalidad). */
  importarTarifas(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const filas = this.parseCsv(String(reader.result || ''));
        if (!filas.length) { this.swal.advertencia('Importar', 'El archivo está vacío'); return; }
        let data = filas;
        const encabezado = (filas[0] || []).join(';').toLowerCase();
        if (encabezado.includes('region') && encabezado.includes('modalidad')) data = filas.slice(1);

        let invalidas = 0;
        const pendientes: any[] = [];
        for (const f of data) {
          const regionRef = (f[0] || '').trim().toUpperCase();
          const desde = Number((f[1] || '').trim());
          const hasta = Number((f[2] || '').trim());
          const modalidad = (f[3] || '').trim().toUpperCase();
          const tarifa = Number((f[4] || '').trim());
          const reg = this.regiones.find(
            (r) => String(r.code || '').toUpperCase() === regionRef || (r.name || '').toUpperCase() === regionRef,
          );
          const rango = this.rangos.find((g) => Number(g.desde) === desde && Number(g.hasta) === hasta);
          if (!reg || !rango || !['PRESENCIAL', 'ONLINE'].includes(modalidad) || isNaN(tarifa)) { invalidas++; continue; }
          const existente = this.tarifas.find(
            (t) => Number(t.idRegion) === reg.idRegion && Number(t.idRango) === rango.idRango && String(t.modalidad).toUpperCase() === modalidad,
          );
          const payload = { idRegion: reg.idRegion, idRango: rango.idRango, modalidad, tarifa, activo: 1 };
          pendientes.push(existente ? this.service.actualizarTarifa(existente.idTarifa, payload) : this.service.crearTarifa(payload));
        }
        if (!pendientes.length) { this.swal.advertencia('Importar', `Sin filas válidas${invalidas ? ` (${invalidas} inválidas)` : ''}`); return; }
        forkJoin(pendientes).subscribe({
          next: () => { this.swal.exito(`Tarifas importadas: ${pendientes.length}${invalidas ? `, ${invalidas} inválidas` : ''}`); this.cargar(); },
          error: () => this.swal.error('Error', 'No se pudieron importar todas las tarifas'),
        });
      } catch {
        this.swal.error('Error', 'No se pudo leer el archivo');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /** Parser CSV simple (soporta ; o , y campos entre comillas). */
  private parseCsv(texto: string): string[][] {
    const filas: string[][] = [];
    const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
    for (const linea of lineas) {
      const sep = linea.includes(';') ? ';' : ',';
      const campos: string[] = [];
      let actual = '';
      let enComillas = false;
      for (let i = 0; i < linea.length; i++) {
        const ch = linea[i];
        if (enComillas) {
          if (ch === '"' && linea[i + 1] === '"') { actual += '"'; i++; }
          else if (ch === '"') { enComillas = false; }
          else actual += ch;
        } else if (ch === '"') { enComillas = true; }
        else if (ch === sep) { campos.push(actual); actual = ''; }
        else actual += ch;
      }
      campos.push(actual);
      filas.push(campos);
    }
    return filas;
  }

  titulo(): string {
    return this.tipo === 'clientes' ? 'Clientes'
      : this.tipo === 'regiones' ? 'Regiones'
      : this.tipo === 'plantillas' ? 'Plantillas'
      : this.tipo === 'tasas-iva' ? 'Tasas de IVA'
      : this.tipo === 'rangos' ? 'Rangos de Usuarios'
      : this.tipo === 'tarifas' ? 'Tarifas (Región + Rango + Modalidad)'
      : 'Empresas';
  }

  resetForm(): void {
    this.nuevoCliente = {};
    this.nuevaRegion = {};
    this.nuevaPlantilla = {};
    this.nuevaEmpresa = {};
    this.nuevaTasa = {};
    this.nuevoRango = {};
    this.nuevaTarifa = {};
    this.editandoId = undefined;
  }
}