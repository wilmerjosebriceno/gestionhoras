export interface Sistema {
  idSistema: string;
  sistema: string;
  denominacion: string;
  descripcion?: string | null;
  ruta?: string | null;
  estatus?: number;
}
