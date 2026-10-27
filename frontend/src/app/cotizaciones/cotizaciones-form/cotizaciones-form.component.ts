import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CotizacionesService } from '../services/cotizaciones.service';
import { CotClient, CotRegion, CotTemplate, CotEmpresa, CotTasaIva, Budget, ESTADOS_BUDGET, CotRangoUsuario, CotTarifa } from '../models/cotizacion.model';
import { SwalService } from '../../core/services/swal.service';

@Component({
  selector: 'app-cotizaciones-form',
  standalone: false,
  templateUrl: './cotizaciones-form.component.html',
})
export class CotizacionesFormComponent implements OnInit {
  id?: number;
  budget: Partial<Budget> = {
    status: 0,
    tasaBcv: 1,
    dateBudget: this.hoy(),
    vencimiento: this.hoyMas30(),
    soporte: 'INCLUYE UN (1) MES DE MANTENIMIENTO SOPORTE ONLINE.',
    modalidad: 'FORMA DE PAGO: El 20 % con la instalación del comité de implantación y el SIGESP ERP en el servidor de INVEVAL, 30% con la configuración y migración de datos de maestros básicos, adecuación de formatos básicos, y el 50% con la capacitación simulada y en vivo.',
    detalles: [],
  };
  clientes: CotClient[] = [];
  regiones: CotRegion[] = [];
  plantillas: CotTemplate[] = [];
  empresas: CotEmpresa[] = [];
  tasas: CotTasaIva[] = [];
  rangos: CotRangoUsuario[] = [];
  tarifas: CotTarifa[] = [];
  rangoActual: CotRangoUsuario | null = null;
  ivaLabel = 'IVA (0%)';
  estados = ESTADOS_BUDGET;
  loadingCatalogos = false;
  cargando = false;
  /** true mientras el vencimiento se calcula automáticamente (fecha cotización + 30 días). */
  vencimientoAuto = true;

  // Combobox de Cliente (buscar + seleccionar)
  filtroCliente = '';
  clientesFiltrados: CotClient[] = [];
  mostrarListaCliente = false;
  clienteSeleccionado: CotClient | null = null;

  constructor(
    private service: CotizacionesService,
    private route: ActivatedRoute,
    private router: Router,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    const idPara = this.route.snapshot.paramMap.get('id');
    this.id = idPara && idPara !== 'nuevo' ? Number(idPara) : undefined;

    // Cargar catálogos primero para poder aplicar los valores por defecto
    // (IVA 8% y Región CENTRAL) al crear la primera línea.
    forkJoin({
      clientes: this.service.listarClientes(),
      regiones: this.service.listarRegiones(),
      plantillas: this.service.listarPlantillas(),
      empresas: this.service.listarEmpresas(),
      tasas: this.service.listarTasas(),
      rangos: this.service.listarRangos(),
      tarifas: this.service.listarTarifas(),
    }).subscribe(({ clientes, regiones, plantillas, empresas, tasas, rangos, tarifas }) => {
      this.clientes = clientes;
      this.regiones = regiones;
      this.plantillas = plantillas;
      this.empresas = empresas;
      this.tasas = tasas;
      this.rangos = rangos;
      this.tarifas = tarifas;

      if (this.id) {
        this.service.getBudget(this.id).subscribe((b) => {
          this.budget = b;
          this.budget.detalles = b.detalles?.map((d) => ({ ...d }));
          // En una cotización existente el vencimiento ya está definido: no se recalcula solo.
          this.vencimientoAuto = false;
          this.rangoActual = this.resolverRangoLocal(this.budget.nroUser);
          const cli = this.clientes.find((c) => c.idClient === b.idClient) || null;
          if (cli) { this.clienteSeleccionado = cli; this.filtroCliente = cli.nameClient || ''; }
        });
      } else {
        // Nueva cotización: siempre inicia en estado BORRADOR
        this.budget.status = 0;
        // Carga automática en el detalle de las plantillas INI y ADM (en ese orden)
        const iniciales = this.plantillas
          .filter((t) => ['INI', 'ADM'].includes((t.code || '').trim().toUpperCase()))
          .sort((a, b) => {
            const orden: Record<string, number> = { INI: 0, ADM: 1 };
            return (orden[(a.code || '').trim().toUpperCase()] ?? 9) - (orden[(b.code || '').trim().toUpperCase()] ?? 9);
          });
        if (iniciales.length) {
          iniciales.forEach((t) => this.agregarLineaPlantilla(t.idTemplate));
        } else {
          this.agregarLinea();
        }
      }
    });
  }

  /* ===== Combobox Cliente ===== */
  abrirListaCliente(): void {
    this.mostrarListaCliente = true;
    this.filtrarClientes();
  }

  filtrarClientes(): void {
    const q = (this.filtroCliente || '').trim().toLowerCase();
    if (!q) {
      this.clientesFiltrados = this.clientes;
      return;
    }
    this.clientesFiltrados = this.clientes.filter((c) =>
      (c.nameClient || '').toLowerCase().includes(q) || (c.rif || '').toLowerCase().includes(q),
    );
  }

  onFiltroClienteCambia(): void {
    // Si el usuario borra el texto, se limpia la selección
    if (!this.filtroCliente) {
      this.budget.idClient = undefined;
      this.clienteSeleccionado = null;
    }
    this.filtrarClientes();
  }

  seleccionarCliente(c: CotClient): void {
    this.clienteSeleccionado = c;
    this.filtroCliente = c.nameClient || '';
    this.budget.idClient = c.idClient;
    this.mostrarListaCliente = false;
  }

  limpiarCliente(): void {
    this.clienteSeleccionado = null;
    this.filtroCliente = '';
    this.budget.idClient = undefined;
    this.filtrarClientes();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const el = document.querySelector('#cliente-combo');
    if (el && !el.contains(event.target as Node)) {
      this.mostrarListaCliente = false;
    }
  }

  /** Fecha de hoy (yyyy-mm-dd) en hora local, sin desfase de zona horaria. */
  private hoy(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Suma días a una fecha yyyy-mm-dd usando componentes locales. */
  private sumarDias(fecha: string | null | undefined, dias: number): string {
    const d = fecha ? new Date(`${String(fecha).slice(0, 10)}T00:00:00`) : new Date();
    d.setDate(d.getDate() + dias);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Fecha de hoy + 30 días (yyyy-mm-dd) para el vencimiento por defecto. */
  private hoyMas30(): string {
    return this.sumarDias(this.hoy(), 30);
  }

  /** Al cambiar la fecha de la cotización, recalcula el vencimiento si sigue siendo automático. */
  onFechaCotizacionCambia(): void {
    if (this.vencimientoAuto) {
      this.budget.vencimiento = this.sumarDias(this.budget.dateBudget, 30);
    }
  }

  /** Si el usuario edita el vencimiento manualmente, deja de recalcularse solo. */
  onVencimientoCambia(): void {
    this.vencimientoAuto = false;
  }

  /** Tasa por defecto: la alícuota más alta activa (IVA 16%). */
  tasaPorDefecto(): number | undefined {
    const activas = this.tasas.filter((t) => t.activo === 1);
    const pool = activas.length ? activas : this.tasas;
    if (!pool.length) return undefined;
    const mayor = pool.reduce((max, t) => (Number(t.porcentaje) > Number(max.porcentaje) ? t : max));
    return mayor?.idTasaIva;
  }

  /** % de IVA asociado a una tasa del catálogo. */
  porcentajeTasa(idTasaIva?: number): number {
    const t = this.tasas.find((x) => x.idTasaIva === idTasaIva);
    return Number(t?.porcentaje ?? 0) || 0;
  }

  /** Región por defecto: CENTRAL (si existe y está activa). */
  regionCentral(): number | undefined {
    const norm = (s?: string | null) => (s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const r = this.regiones.find((x) => norm(x.name).includes('CENTRAL')) || this.regiones[0];
    return r?.idRegion;
  }

  agregarLinea(): void {
    const idRegion = this.regionCentral();
    const idTasaIva = this.tasaPorDefecto();
    const d = {
      idTemplate: undefined as any,
      idRegion: idRegion ?? (undefined as any),
      modalidad: 'PRESENCIAL',
      quantity: 0,
      price: 0,
      tax: this.porcentajeTasa(idTasaIva) || 16,
      idTasaIva,
      description: '',
    };
    if (!this.budget.detalles) this.budget.detalles = [];
    this.budget.detalles.push(d as any);
    this.aplicarTarifa(d as any);
  }

  quitarLinea(i: number): void {
    this.budget.detalles?.splice(i, 1);
    this.calcularTotales();
  }

  /** Agrega una línea al detalle a partir de una plantilla (precio/horas/descripción, IVA 16% y región CENTRAL). */
  agregarLineaPlantilla(idTemplate: number): void {
    this.agregarLinea();
    const d = this.budget.detalles?.[this.budget.detalles.length - 1];
    if (!d) return;
    d.idTemplate = idTemplate;
    this.onPlantillaCambia(d);
  }

  /** Auto-precio por plantilla o región al cambiar plantilla. */
  onPlantillaCambia(d: any): void {
    const tpl = this.plantillas.find((t) => t.idTemplate === d.idTemplate);
    if (tpl) {
      if (tpl.price && !d.price) d.price = tpl.price;
      // Cantidad (horas) por defecto desde la plantilla
      if (tpl.hours) d.quantity = tpl.hours;
      // Copia el texto del concepto (multilinea) de la plantilla a la descripcion del detalle
      if (tpl.name) d.description = tpl.name;
    }
    // Obligatorio al elegir plantilla: IVA 16% (alícuota más alta) y región CENTRAL
    const idTasaIva = this.tasaPorDefecto();
    if (idTasaIva != null) {
      d.idTasaIva = idTasaIva;
      d.tax = this.porcentajeTasa(idTasaIva);
    }
    const idRegion = this.regionCentral();
    if (idRegion != null) d.idRegion = idRegion;
    this.aplicarTarifa(d);
  }
  onRegionCambia(d: any): void {
    this.aplicarTarifa(d);
  }

  onModalidadCambia(d: any): void {
    this.aplicarTarifa(d);
  }

  /** Rango local (desde/hasta) que contiene el nro de usuarios. */
  private resolverRangoLocal(nroUser?: number | null): CotRangoUsuario | null {
    const n = Number(nroUser);
    if (!n) return null;
    return this.rangos.find((r) => r.desde <= n && n <= r.hasta) ?? null;
  }

  /**
   * Resuelve la tarifa de una línea con: nro_user (cabecera) + región + modalidad.
   * Si la cotización no tiene nro_user, cae al precio de la región (legacy).
   */
  aplicarTarifa(d: any): void {
    const nroUser = Number(this.budget.nroUser) || null;
    const rango = this.resolverRangoLocal(nroUser);
    d.sinTarifa = false;
    if (nroUser) {
      // Con N° de usuarios debe existir tarifa (región + rango + modalidad)
      if (rango && d.idRegion && d.modalidad) {
        const tar = this.tarifas.find(
          (t) =>
            Number(t.idRegion) === Number(d.idRegion) &&
            Number(t.idRango) === Number(rango.idRango) &&
            String(t.modalidad).toUpperCase() === String(d.modalidad).toUpperCase(),
        );
        if (tar) {
          d.idTarifa = tar.idTarifa;
          d.tarifaAplicada = Number(tar.tarifa);
          d.price = Number(tar.tarifa);
          this.calcularTotales();
          return;
        }
      }
      d.sinTarifa = true; // no hay rango o no hay tarifa para la combinación
    }
    // Respaldo (legacy / sin tarifa): precio de la región (presencial/online)
    const reg = this.regiones.find((r) => Number(r.idRegion) === Number(d.idRegion));
    if (reg) {
      const esOnline = String(d.modalidad || '').toUpperCase() === 'ONLINE';
      d.price = esOnline ? (reg.priceOnline ?? reg.price) : reg.price;
    }
    this.calcularTotales();
  }

  /** true si alguna línea no tiene tarifa definida para su combinación. */
  hayLineasSinTarifa(): boolean {
    return (this.budget.detalles || []).some((d: any) => d.sinTarifa === true);
  }

  /** Al cambiar el N° de usuarios: resuelve el rango y reaplica la tarifa a todas las líneas. */
  onNroUserCambia(): void {
    this.rangoActual = this.resolverRangoLocal(this.budget.nroUser);
    this.budget.idRango = this.rangoActual?.idRango ?? null;
    (this.budget.detalles || []).forEach((d) => this.aplicarTarifa(d));
    this.calcularTotales();
  }

  /** Al cambiar la tasa de IVA seleccionada, sincroniza el % de la línea. */
  onTasaCambia(d: any): void {
    const t = this.tasas.find((x) => x.idTasaIva === d.idTasaIva);
    if (t) d.tax = Number(t.porcentaje) || 0;
    this.calcularTotales();
  }

  /** % de IVA efectivo de una línea (desde la tasa asociada o el % legacy). */
  resolverPct(d: any): number {
    if (d?.idTasaIva != null) {
      const t = this.tasas.find((x) => x.idTasaIva === d.idTasaIva);
      if (t) return Number(t.porcentaje) || 0;
    }
    return Number(d?.tax ?? 0) || 0;
  }

  /** Calcula los totalizadores en vivo a partir de los detalles (exento separado). */
  calcularTotales(): void {
    let subtotal = 0;
    let base = 0;
    let iva = 0;
    const tasasAplicadas = new Set<number>();
    for (const d of (this.budget.detalles || [])) {
      const sub = Number(d.quantity || 0) * Number(d.price || 0);
      const porc = this.resolverPct(d);
      subtotal += sub;
      if (porc === 0) {
        // Exento: no genera IVA
      } else {
        base += sub;
        iva += sub * (porc / 100);
        tasasAplicadas.add(porc);
      }
    }
    const rates = [...tasasAplicadas].sort((a, b) => a - b);
    this.ivaLabel = rates.length === 0 ? 'IVA (0%)'
      : rates.length === 1 ? `IVA (${rates[0]}%)`
      : `IVA (${rates.map((r) => `${r}%`).join(' + ')})`;
    const r4 = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;
    this.budget.montoSubtotal = r4(subtotal);
    this.budget.montoExento = r4(subtotal - base);
    this.budget.montoBaseImponible = r4(base);
    this.budget.montoIva = r4(iva);
    this.budget.montoTotal = r4(base + iva);
  }

  guardar(): void {
    this.cargando = true;
    this.calcularTotales();
    const dto = {
      codeBudget: this.budget.codeBudget,
      dateBudget: this.budget.dateBudget,
      vencimiento: this.budget.vencimiento,
      idClient: this.budget.idClient,
      idEmpresa: this.budget.idEmpresa,
      nroUser: this.budget.nroUser ?? undefined,
      idRango: this.budget.idRango ?? undefined,
      note: this.budget.note,
      soporte: this.budget.soporte,
      modalidad: this.budget.modalidad,
      status: this.budget.status,
      tasaBcv: this.budget.tasaBcv,
      montoSubtotal: this.budget.montoSubtotal,
      montoExento: this.budget.montoExento,
      montoBaseImponible: this.budget.montoBaseImponible,
      montoIva: this.budget.montoIva,
      montoTotal: this.budget.montoTotal,
      detalles: this.budget.detalles?.map((d, i) => ({
        idTemplate: Number(d.idTemplate),
        secuencia: d.secuencia ?? i,
        idRegion: d.idRegion ? Number(d.idRegion) : undefined,
        modalidad: d.modalidad,
        quantity: Math.round((Number(d.quantity) || 0) * 100) / 100,
        price: Math.round((Number(d.price) || 0) * 10000) / 10000,
        tax: Math.round(Number(d.tax) || 0),
        idTasaIva: d.idTasaIva != null ? Number(d.idTasaIva) : undefined,
        description: d.description,
      })),
    };
    const req = this.id ? this.service.actualizarBudget(this.id, dto) : this.service.crearBudget(dto);
    req.subscribe({
      next: () => {
        this.cargando = false;
        this.swal.exito('Cotización guardada');
        this.router.navigate(['/cot']);
      },
      error: (err) => {
        this.cargando = false;
        const msg = err.error?.message;
        this.swal.error('Error', Array.isArray(msg) ? msg.join(' · ') : (msg || 'No se pudo guardar'));
      },
    });
  }

  /** Duplica la cotización guardada actual como una nueva (BORRADOR). */
  async duplicar(): Promise<void> {
    if (!this.id) return;
    const ok = await this.swal.confirmar({
      titulo: 'Duplicar cotización',
      texto: 'Se creará una copia de la cotización guardada como nueva (BORRADOR), con un nuevo número y fecha de hoy.',
      textoConfirmar: 'Sí, duplicar',
      icono: 'question',
    });
    if (!ok) return;
    this.cargando = true;
    this.service.duplicarBudget(this.id).subscribe({
      next: (nueva) => {
        this.cargando = false;
        this.swal.exito('Cotización duplicada', `Nueva: ${nueva.codeBudget}`);
        this.router.navigate(['/cot/editar', nueva.idBudget]);
      },
      error: (err) => {
        this.cargando = false;
        const msg = err.error?.message;
        this.swal.error('Error al duplicar', Array.isArray(msg) ? msg.join(' · ') : (msg || 'No se pudo duplicar'));
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/cot']);
  }
}