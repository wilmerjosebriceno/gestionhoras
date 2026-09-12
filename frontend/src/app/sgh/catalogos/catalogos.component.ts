import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { SghService } from '../services/sgh.service';
import { SwalService } from '../../core/services/swal.service';

interface Campo {
  key: string;
  label: string;
  tipo?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  opciones?: Array<{ value: any; label: string }>;
  required?: boolean;
  maxlength?: number;
  readonly?: boolean;
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
    for (const c of this.config.campos) {
      if (c.key === 'active') {
        const v = this.form['active'] === undefined ? 1 : this.form['active'];
        dto['active'] = Number(v);
        continue;
      }
      dto[c.key] = c.tipo === 'number' ? Number(this.form[c.key]) : this.form[c.key];
    }
    return dto;
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

  setError(err: any): void {
    const msg = err?.error?.message;
    this.error = Array.isArray(msg) ? msg.join('. ') : msg || 'Error en la operación';
  }

  val(fila: any, key: string): string {
    const v = fila[key];
    return v === undefined || v === null ? '' : String(v);
  }
}
