import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CotizacionesService } from '../services/cotizaciones.service';
import { CotClient, CotRegion, CotTemplate, CotEmpresa, CotTasaIva, Budget, ESTADOS_BUDGET } from '../models/cotizacion.model';
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
    }).subscribe(({ clientes, regiones, plantillas, empresas, tasas }) => {
      this.clientes = clientes;
      this.regiones = regiones;
      this.plantillas = plantillas;
      this.empresas = empresas;
      this.tasas = tasas;

      if (this.id) {
        this.service.getBudget(this.id).subscribe((b) => {
          this.budget = b;
          this.budget.detalles = b.detalles?.map((d) => ({ ...d }));
          // En una cotización existente el vencimiento ya está definido: no se recalcula solo.
          this.vencimientoAuto = false;
          const cli = this.clientes.find((c) => c.idClient === b.idClient) || null;
          if (cli) { this.clienteSeleccionado = cli; this.filtroCliente = cli.nameClient || ''; }
        });
      } else {
        // Nueva cotización: siempre inicia en estado BORRADOR
        this.budget.status = 0;
        this.agregarLinea();
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

  /** Tasa por defecto: ALÍCUOTA REDUCIDA (8%) o la primera activa distinta de 0%. */  tasaPorDefecto(): number | undefined {
    const def = this.tasas.find((t) => Number(t.porcentaje) === 8 && t.activo === 1)
      || this.tasas.find((t) => Number(t.porcentaje) > 0 && t.activo === 1)
      || this.tasas.find((t) => t.activo === 1);
    const defaultTax = this.tasas.find((t) => Number(t.porcentaje) === 8);
    return (def?.idTasaIva ?? defaultTax?.idTasaIva);
  }

  /** Región por defecto: CENTRAL (si existe y está activa). */
  regionCentral(): number | undefined {
    const r = this.regiones.find((x) => (x.name || '').toUpperCase().includes('CENTRAL')) || this.regiones[0];
    return r?.idRegion;
  }

  agregarLinea(): void {
    const idRegion = this.regionCentral();
    const d = {
      idTemplate: undefined as any,
      idRegion: idRegion ?? (undefined as any),
      modalidad: 'PRESENCIAL',
      quantity: 0,
      price: 0,
      tax: 8,
      idTasaIva: this.tasaPorDefecto(),
      description: '',
    };
    if (!this.budget.detalles) this.budget.detalles = [];
    this.budget.detalles.push(d as any);
    this.calcularTotales();
  }

  quitarLinea(i: number): void {
    this.budget.detalles?.splice(i, 1);
    this.calcularTotales();
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
    // Valores por defecto: alícuota reducida (8%) y región CENTRAL
    if (!d.idTasaIva) d.idTasaIva = this.tasaPorDefecto();
    if (!d.idRegion) d.idRegion = this.regionCentral();
    this.calcularTotales();
  }
  onRegionCambia(d: any): void {
    const reg = this.regiones.find((r) => r.idRegion === d.idRegion);
    if (reg) {
      const esOnline = String(d.modalidad || '').toUpperCase() === 'ONLINE';
      d.price = esOnline ? (reg.priceOnline ?? reg.price) : reg.price;
    }
    this.calcularTotales();
  }

  onModalidadCambia(d: any): void {
    // Al cambiar la modalidad, aplica el precio de la region correspondiente
    const reg = this.regiones.find((r) => r.idRegion === d.idRegion);
    if (reg) {
      const esOnline = String(d.modalidad || '').toUpperCase() === 'ONLINE';
      d.price = esOnline ? (reg.priceOnline ?? reg.price) : reg.price;
    }
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
    this.budget.montoSubtotal = subtotal;
    this.budget.montoExento = subtotal - base;
    this.budget.montoBaseImponible = base;
    this.budget.montoIva = iva;
    this.budget.montoTotal = base + iva;
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
        quantity: Number(d.quantity) || 0,
        price: Number(d.price) || 0,
        tax: Number(d.tax) || 0,
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