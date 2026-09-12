import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CotizacionesService } from '../services/cotizaciones.service';
import { CotClient, CotRegion, CotTemplate, CotEmpresa, CotTasaIva } from '../models/cotizacion.model';
import { SwalService } from '../../core/services/swal.service';

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

  // Modelos de formulario
  nuevoCliente: Partial<CotClient> = {};
  nuevaRegion: Partial<CotRegion> = {};
  nuevaPlantilla: Partial<CotTemplate> = {};
  nuevaEmpresa: Partial<CotEmpresa> = {};
  nuevaTasa: Partial<CotTasaIva> = {};

  editandoId?: number; // id del registro en edición (si aplica)
  mostrarForm = false;
  loading = false;
  error = '';

  constructor(
    private service: CotizacionesService,
    private route: ActivatedRoute,
    private swal: SwalService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((p) => {
      this.tipo = p['tipo'] || 'clientes';
      if (!['clientes', 'regiones', 'plantillas', 'empresas', 'tasas-iva'].includes(this.tipo)) this.tipo = 'clientes';
      this.mostrarForm = false;
      this.resetForm();
      this.cargar();
    });
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    if (this.tipo === 'clientes') {
      this.service.listarClientes().subscribe({ next: (r) => { this.clientes = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'regiones') {
      this.service.listarRegiones().subscribe({ next: (r) => { this.regiones = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'empresas') {
      this.service.listarEmpresas().subscribe({ next: (r) => { this.empresas = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else if (this.tipo === 'tasas-iva') {
      // Muestra también inactivas para poder editarlas/activarlas
      this.service.listarTasas(true).subscribe({ next: (r) => { this.tasas = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    } else {
      this.service.listarPlantillas().subscribe({ next: (r) => { this.plantillas = r; this.loading = false; }, error: () => { this.loading = false; this.error = 'Error al cargar'; } });
    }
  }

  /** Abre el formulario vacío (crear). */
  toggleForm(): void {
    this.mostrarForm = !this.mostrarForm;
    if (!this.mostrarForm) this.resetForm();
  }

  /** Carga un registro en el formulario para editar. */
  editar(registro: any): void {
    this.resetForm();
    this.editandoId = registro.idClient ?? registro.idRegion ?? registro.idTemplate ?? registro.idEmpresa ?? registro.idTasaIva;
    if (this.tipo === 'clientes') this.nuevoCliente = { ...registro };
    else if (this.tipo === 'regiones') this.nuevaRegion = { ...registro };
    else if (this.tipo === 'plantillas') this.nuevaPlantilla = { ...registro };
    else if (this.tipo === 'tasas-iva') this.nuevaTasa = { ...registro };
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
    } else {
      if (!this.nuevaPlantilla.name) { this.swal.advertencia('Plantilla', 'Indique el nombre de la plantilla'); return; }
      const payload = this.quitarPK(this.nuevaPlantilla, 'idTemplate');
      const req = this.editandoId ? this.service.actualizarPlantilla(this.editandoId, payload) : this.service.crearPlantilla(payload);
      req.subscribe({ next: () => { this.resetForm(); this.mostrarForm = false; this.cargar(); this.swal.exito('Plantilla guardada'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo guardar') });
    }
  }

  /** Limpia el payload: quita la PK y propiedades de relación/OBJETO que el DTO rechaza (forbidNonWhitelisted). */
  private quitarPK(obj: any, key: string): any {
    const { [key]: _pk, client: _cli, region: _reg, template: _tpl, empresa: _emp, tasaIva: _tasa, ...rest } = obj;
    return rest;
  }

  async eliminar(item: any): Promise<void> {
    if (this.tipo === 'tasas-iva') { this.swal.advertencia('Tasa de IVA', 'Las tasas de IVA no se eliminan, solo se editan o desactivan'); return; }
    const id = item.idClient ?? item.idRegion ?? item.idTemplate ?? item.idEmpresa;
    const nombre = item.nameClient ?? item.name ?? item.company ?? item.name;
    const ok = await this.swal.confirmar({ titulo: `¿Eliminar ${nombre}?`, textoConfirmar: 'Sí, eliminar' });
    if (!ok) return;
    const req =
      this.tipo === 'clientes' ? this.service.eliminarCliente(id) :
      this.tipo === 'regiones' ? this.service.eliminarRegion(id) :
      this.tipo === 'empresas' ? this.service.eliminarEmpresa(id) :
      this.service.eliminarPlantilla(id);
    req.subscribe({ next: () => { this.cargar(); this.swal.exito('Eliminado'); }, error: (e) => this.swal.error('Error', e.error?.message || 'No se pudo eliminar') });
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

  titulo(): string {
    return this.tipo === 'clientes' ? 'Clientes' : this.tipo === 'regiones' ? 'Regiones' : this.tipo === 'plantillas' ? 'Plantillas' : this.tipo === 'tasas-iva' ? 'Tasas de IVA' : 'Empresas';
  }

  resetForm(): void {
    this.nuevoCliente = {};
    this.nuevaRegion = {};
    this.nuevaPlantilla = {};
    this.nuevaEmpresa = {};
    this.nuevaTasa = {};
    this.editandoId = undefined;
  }
}