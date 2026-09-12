export interface PermisoItem {
  pagina: string;
  denPagina?: string;
  acceso?: number;
  seleccionar?: number;
  insertar?: number;
  actualizar?: number;
  eliminar?: number;
  ejecutar?: number;
  imprimir?: number;
  anular?: number;
}

export interface Sistema {
  idSistema: string;
  sistema: string;
  denominacion: string;
}

export interface UpdatePermisosUsuario {
  login: string;
  sistema: string;
  permisos: PermisoItem[];
}

export interface UpdatePermisosGrupo {
  grupo: string;
  sistema: string;
  permisos: PermisoItem[];
}
