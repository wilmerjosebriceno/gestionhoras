import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';
import type { VerificacionScrin, ExploracionScrin, EmpleadoScrin } from '../services/monitor-horas.service';
import { UsuarioSgh } from '../models/sgh.models';

interface Campo {
  key: string;
  label: string;
  tipo?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'password' | 'checkbox';
  opciones?: Array<{ value: any; label: string }>;
  required?: boolean;
  maxlength?: number;
  readonly?: boolean;
  soloTabla?: boolean;
  soloFormulario?: boolean;
}

const CONFIG: Record<string, { titulo: string; campos: Campo[] }> = {
  clientes: {
    titulo: 'Clientes',
    campos: [
      { key: 'rif', label: 'RIF', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'adress', label: 'Dirección' },
      { key: 'email', label: 'Email' },
      { key: 'contacTel', label: 'Teléfono' },
      { key: 'contacName', label: 'Contacto' },
      {
        key: 'active',
        label: 'Activo',
        tipo: 'select',
        opciones: [
          { value: 1, label: 'Sí' },
          { value: 0, label: 'No' },
        ],
      },
      {
        key: 'mantenimiento',
        label: 'Mantenimiento',
        tipo: 'checkbox',
      },
      {
        key: 'idMantisProyect',
        label: 'ID Mantis Proyecto',
        tipo: 'number',
      },
    ],
  },
  procesos: {
    titulo: 'Procesos / Módulos',
    campos: [
      { key: 'code', label: 'Código', maxlength: 3 },
      { key: 'nameProcess', label: 'Proceso', required: true },
      { key: 'orden', label: 'Orden', tipo: 'number' },
      {
        key: 'active',
        label: 'Activo',
        tipo: 'select',
        opciones: [
          { value: 1, label: 'Sí' },
          { value: 0, label: 'No' },
        ],
      },
    ],
  },
  items: {
    titulo: 'Ítems de Actividad',
    campos: [
      { key: 'code', label: 'Código', maxlength: 6 },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'orden', label: 'Orden', tipo: 'number' },
      {
        key: 'active',
        label: 'Activo',
        tipo: 'select',
        opciones: [
          { value: 1, label: 'Sí' },
          { value: 0, label: 'No' },
        ],
      },
    ],
  },
  categorias: {
    titulo: 'Categorías',
    campos: [
      { key: 'nameCategory', label: 'Categoría', required: true },
      {
        key: 'active',
        label: 'Activo',
        tipo: 'select',
        opciones: [
          { value: 1, label: 'Sí' },
          { value: 0, label: 'No' },
        ],
      },
    ],
  },
  tipos: {
    titulo: 'Tipos de Actividad',
    campos: [
      { key: 'nameType', label: 'Tipo', required: true },
      {
        key: 'active',
        label: 'Activo',
        tipo: 'select',
        opciones: [
          { value: 1, label: 'Sí' },
          { value: 0, label: 'No' },
        ],
      },
    ],
  },
  usuarios: {
    titulo: 'Usuarios SGH',
    campos: [
      { key: 'login', label: 'Login', required: true },
      { key: 'nameUser', label: 'Nombre', required: true },
      { key: 'email', label: 'Email', required: true },
      {
        key: 'rol',
        label: 'Rol',
        tipo: 'select',
        opciones: [
          { value: 'A', label: 'Admin' },
          { value: 'S', label: 'Supervisor' },
          { value: 'U', label: 'Usuario' },
        ],
      },
      {
        key: 'active',
        label: 'Activo',
        tipo: 'select',
        opciones: [
          { value: 1, label: 'Sí' },
          { value: 0, label: 'No' },
        ],
      },
      { key: 'scrinEmploymentId', label: 'ID Scrin (employment)', tipo: 'number' },
      { key: 'scrinCompanyId', label: 'Empresa Scrin', tipo: 'number' },
      { key: 'tokenPreview', label: 'Token Scrin', readonly: true, soloTabla: true },
      {
        key: 'scrinToken',
        label: 'Token API Scrin',
        tipo: 'password',
        maxlength: 200,
        soloFormulario: true,
      },
    ],
  },
};

@Component({
  selector: 'app-catalogos',
  standalone: false,
  templateUrl: './catalogos.component.html',
})
export class CatalogosComponent implements OnInit {
  tipo = 'clientes';
  config = CONFIG['clientes'];
  filas: any[] = [];
  loading = false;
  error = '';
  filtro = '';
  editandoId: number | null = null;
  form: Record<string, any> = {};
  mostrandoFormulario = false;

  /* ==== "Probar conexión" de Scrin (pantalla Usuarios SGH) ==== */
  scrinAbierto = false;
  scrinFila: any = null;
  scrinVerif: VerificacionScrin | null = null;
  scrinCargando = false;
  scrinAplicando = false;

  /* ==== "Consultar token" de Scrin: obtiene los IDs que expone un token ==== */
  tokenAbierto = false;
  tokenTexto = '';
  tokenFiltro = '';
  tokenCargando = false;
  tokenResultado: ExploracionScrin | null = null;
  tokenAsignando: number | null = null;
  asignacion: Record<number, number | undefined> = {};

  /* ==== Enviar el formato de habilitación por correo (solo Clientes) ==== */
  formatoAbierto = false;
  formatoFila: any = null;
  formatoDestinatario = '';
  formatoMensaje = '';
  formatoEnviando = false;

  constructor(private route: ActivatedRoute, private service: SghService, private swal: SwalService) {}

  ngOnInit(): void {
    this.route.params.subscribe((p) => {
      this.tipo = p['tipo'] ?? 'clientes';
      this.config = CONFIG[this.tipo] ?? CONFIG['clientes'];
      this.mostrandoFormulario = false;
      this.editandoId = null;
      this.error = '';
      this.filtro = '';
      this.cargar();
    });
  }

  cargar(): void {
    this.loading = true;
    this.error = '';
    const obs: Observable<any> =
      this.tipo === 'clientes'
        ? this.service.listClientes(undefined, this.filtro || undefined)
        : this.service[this.listMetodo()](undefined);
    obs.subscribe({
      next: (d) => {
        this.filas = d;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.setError(err);
      },
    });
  }

  private listMetodo(): 'listProcesos' | 'listItems' | 'listCategorias' | 'listTipos' | 'listUsuariosSgh' {
    switch (this.tipo) {
      case 'procesos': return 'listProcesos';
      case 'items': return 'listItems';
      case 'categorias': return 'listCategorias';
      case 'tipos': return 'listTipos';
      default: return 'listUsuariosSgh';
    }
  }

  nuevo(): void {
    this.editandoId = null;
    this.form = {};
    this.mostrandoFormulario = true;
  }

  editar(fila: any): void {
    this.editandoId = this.idDe(fila);
    this.form = { ...fila };
    this.mostrandoFormulario = true;
  }

  private idDe(fila: any): number {
    switch (this.tipo) {
      case 'procesos': return fila.idProcess;
      case 'items': return fila.idItemActivity;
      case 'categorias': return fila.idCategory;
      case 'tipos': return fila.idType;
      case 'clientes': return fila.idClient;
      default: return fila.idUser;
    }
  }

  guardar(): void {
    this.error = '';
    const dto = this.construirDto();

    const obs: Observable<any> = this.editandoId !== null
      ? this.service[this.updateMetodo()](this.editandoId, dto)
      : this.service[this.createMetodo()](dto);
    obs.subscribe({
      next: () => {
        this.swal.exito(this.editandoId !== null ? 'Registro actualizado' : 'Registro creado');
        this.mostrandoFormulario = false;
        this.cargar();
      },
      error: (err) => {
        this.setError(err);
        this.swal.error('Error al guardar', this.mensajeError(err));
      },
    });
  }

  private mensajeError(err: any): string {
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo completar la operación');
  }

  private construirDto(): Record<string, any> {
    const dto: Record<string, any> = {};
    for (const c of this.camposForm()) {
      if (c.tipo === 'checkbox') {
        dto[c.key] = this.form[c.key] ? 1 : 0;
        continue;
      }
      if (c.key === 'active') {
        const v = this.form['active'] === undefined ? 1 : this.form['active'];
        dto['active'] = Number(v);
        continue;
      }
      const v = this.form[c.key];
      if (c.tipo === 'password') {
        if (v) dto[c.key] = v;
        continue;
      }
      if (c.tipo === 'number') {
        const n = Number(v);
        dto[c.key] = Number.isNaN(n) ? undefined : n;
        continue;
      }
      dto[c.key] = v;
    }
    return dto;
  }

  camposTabla(): Campo[] {
    return this.config.campos.filter((c) => !c.soloFormulario);
  }

  camposForm(): Campo[] {
    return this.config.campos.filter((c) => !c.soloTabla);
  }

  private createMetodo():
    | 'createProceso'
    | 'createItem'
    | 'createCategoria'
    | 'createTipo'
    | 'createCliente'
    | 'createUsuarioSgh' {
    switch (this.tipo) {
      case 'procesos': return 'createProceso';
      case 'items': return 'createItem';
      case 'categorias': return 'createCategoria';
      case 'tipos': return 'createTipo';
      case 'clientes': return 'createCliente';
      default: return 'createUsuarioSgh';
    }
  }

  private updateMetodo():
    | 'updateProceso'
    | 'updateItem'
    | 'updateCategoria'
    | 'updateTipo'
    | 'updateCliente'
    | 'updateUsuarioSgh' {
    switch (this.tipo) {
      case 'procesos': return 'updateProceso';
      case 'items': return 'updateItem';
      case 'categorias': return 'updateCategoria';
      case 'tipos': return 'updateTipo';
      case 'clientes': return 'updateCliente';
      default: return 'updateUsuarioSgh';
    }
  }

  async eliminar(fila: any): Promise<void> {
    const id = this.idDe(fila);
    const ok = await this.swal.confirmar({
      titulo: '¿Eliminar registro?',
      textoConfirmar: 'Sí, eliminar',
    });
    if (!ok) return;
    this.service[this.removeMetodo()](id).subscribe({
      next: () => {
        this.swal.exito('Registro eliminado');
        this.cargar();
      },
      error: (err) => {
        this.setError(err);
        this.swal.error('Error al eliminar', this.mensajeError(err));
      },
    });
  }

  private removeMetodo():
    | 'removeProceso'
    | 'removeItem'
    | 'removeCategoria'
    | 'removeTipo'
    | 'removeCliente'
    | 'removeUsuarioSgh' {
    switch (this.tipo) {
      case 'procesos': return 'removeProceso';
      case 'items': return 'removeItem';
      case 'categorias': return 'removeCategoria';
      case 'tipos': return 'removeTipo';
      case 'clientes': return 'removeCliente';
      default: return 'removeUsuarioSgh';
    }
  }

  /* ==================== SCRIN: "Probar conexión" (Usuarios SGH) ==================== */

  /** Abre el diagnóstico de Scrin del usuario y lo valida en vivo contra Scrin. */
  abrirScrin(fila: any): void {
    this.scrinAbierto = true;
    this.scrinFila = fila;
    this.scrinVerif = null;
    this.verificarScrin();
  }

  cerrarScrin(): void {
    this.scrinAbierto = false;
    this.scrinFila = null;
    this.scrinVerif = null;
  }

  /** Valida el token y el ID del usuario contra Scrin (en vivo). */
  verificarScrin(): void {
    if (!this.scrinFila) return;
    this.scrinCargando = true;
    this.service.verificarScrinUsuario(this.idDe(this.scrinFila)).subscribe({
      next: (r) => {
        this.scrinVerif = r;
        this.scrinCargando = false;
      },
      error: (err) => {
        this.scrinCargando = false;
        this.swal.error('Error', this.mensajeError(err));
      },
    });
  }

  /** Guarda en el usuario el ID de Scrin sugerido (o el indicado). */
  aplicarIdScrin(id: number): void {
    if (!this.scrinFila) return;
    this.scrinAplicando = true;
    this.service.updateUsuarioSgh(this.idDe(this.scrinFila), { scrinEmploymentId: id }).subscribe({
      next: () => {
        this.scrinAplicando = false;
        this.scrinFila.scrinEmploymentId = id;
        this.swal.exito('ID de Scrin actualizado', `Se guardó el ID ${id} en ${this.scrinFila?.nameUser ?? 'el usuario'}.`);
        this.cargar();
        this.verificarScrin();
      },
      error: (err) => {
        this.scrinAplicando = false;
        this.swal.error('Error al guardar', this.mensajeError(err));
      },
    });
  }

  /* ==================== SCRIN: consultar token (obtener los IDs) ==================== */

  abrirToken(): void {
    this.tokenAbierto = true;
    this.tokenTexto = '';
    this.tokenFiltro = '';
    this.tokenResultado = null;
    this.asignacion = {};
  }

  cerrarToken(): void {
    this.tokenAbierto = false;
    this.tokenResultado = null;
    this.asignacion = {};
  }

  /** Consulta el token en Scrin y lista todos los IDs de empleado que expone. */
  consultarToken(): void {
    const t = (this.tokenTexto || '').trim();
    if (!t) {
      this.swal.advertencia('Token de Scrin', 'Pegue el token que desea consultar.');
      return;
    }
    this.tokenCargando = true;
    this.tokenResultado = null;
    this.service.explorarTokenScrin(t).subscribe({
      next: (r) => {
        this.tokenResultado = r;
        this.tokenCargando = false;
        // Preselecciona el usuario SGH que coincide por nombre con cada empleado.
        this.asignacion = {};
        for (const e of r.empleados) {
          const u = this.usuarioQueCoincide(e.name);
          if (u) this.asignacion[e.id] = u.idUser;
        }
      },
      error: (err) => {
        this.tokenCargando = false;
        this.swal.error('Token de Scrin', this.mensajeError(err));
      },
    });
  }

  private normTexto(s: string): string {
    return (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Usuario SGH cuyo nombre coincide con el del empleado de Scrin. */
  usuarioQueCoincide(nombreEmpleado: string): UsuarioSgh | null {
    const palabras = this.normTexto(nombreEmpleado)
      .split(' ')
      .filter((w) => w.length > 2);
    if (!palabras.length) return null;
    return (
      (this.filas as UsuarioSgh[]).find((u) => {
        const n = this.normTexto(u.nameUser);
        return palabras.some((w) => n.includes(w));
      }) ?? null
    );
  }

  /** Empleados del token, filtrados por el buscador. */
  get empleadosToken(): EmpleadoScrin[] {
    const todos = this.tokenResultado?.empleados ?? [];
    const q = this.normTexto(this.tokenFiltro);
    if (!q) return todos;
    return todos.filter(
      (e) => this.normTexto(e.name).includes(q) || String(e.id).includes(this.tokenFiltro.trim()),
    );
  }

  /** Guarda el ID (y la empresa) del empleado en el usuario SGH seleccionado. */
  asignarId(empleado: EmpleadoScrin): void {
    const idUser = this.asignacion[empleado.id];
    if (!idUser) {
      this.swal.advertencia('Asignar ID', 'Seleccione a qué usuario SGH corresponde.');
      return;
    }
    const u = (this.filas as UsuarioSgh[]).find((x) => x.idUser === idUser);
    this.tokenAsignando = empleado.id;
    this.service
      .updateUsuarioSgh(idUser, {
        scrinEmploymentId: empleado.id,
        scrinCompanyId: empleado.companyId,
      })
      .subscribe({
        next: () => {
          this.tokenAsignando = null;
          this.swal.exito(
            'ID asignado',
            `${u?.nameUser ?? 'Usuario'} → ${empleado.id} (${empleado.name})`,
          );
          this.cargar();
        },
        error: (err) => {
          this.tokenAsignando = null;
          this.swal.error('Error al asignar', this.mensajeError(err));
        },
      });
  }

  setError(err: any): void {    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error en la operación';
  }

  /** Genera e imprime el formato de habilitación de tickets (solo Clientes). */
  imprimirFormato(fila: any): void {
    if (this.tipo !== 'clientes') return;
    this.service.pdfFormatoHabilitacionCliente(fila.idClient).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: (err) => this.swal.error('No se pudo generar el formato', this.mensajeError(err)),
    });
  }

  /** Abre el modal para enviar por correo el formato de habilitación. */
  abrirEnviarFormato(fila: any): void {
    if (this.tipo !== 'clientes') return;
    this.formatoFila = fila;
    this.formatoDestinatario = fila?.email ?? '';
    this.formatoMensaje = '';
    this.formatoAbierto = true;
  }

  cerrarEnviarFormato(): void {
    this.formatoAbierto = false;
    this.formatoFila = null;
  }

  usarCalidad(): void {
    this.formatoDestinatario = 'calidad@sigesp.com.ve';
  }

  enviarFormato(): void {
    if (!this.formatoFila) return;
    const payload: any = {};
    if (this.formatoDestinatario.trim()) payload.destinatario = this.formatoDestinatario.trim();
    if (this.formatoMensaje.trim()) payload.mensaje = this.formatoMensaje.trim();

    this.formatoEnviando = true;
    this.service.enviarFormatoHabilitacionCliente(this.formatoFila.idClient, payload).subscribe({
      next: (r) => {
        this.formatoEnviando = false;
        const nota = r?.simulado ? ' (SMTP no configurado: el correo no se envió realmente)' : '';
        this.swal.exito(
          'Correo enviado',
          `Formato enviado a ${r?.destinatario ?? 'el destinatario'}${nota}.`,
        );
        this.formatoAbierto = false;
      },
      error: (err) => {
        this.formatoEnviando = false;
        this.swal.error('No se pudo enviar el formato', this.mensajeError(err));
      },
    });
  }

  val(fila: any, key: string): string {
    const campo = this.config.campos.find((c) => c.key === key);
    if (campo?.tipo === 'checkbox') return fila[key] ? 'Sí' : 'No';
    const v = fila[key];
    return v === undefined || v === null ? '' : String(v);
  }
}
