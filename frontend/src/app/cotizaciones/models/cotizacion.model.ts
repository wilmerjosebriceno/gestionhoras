export interface CotClient {
  idClient: number;
  idSghClient?: number | null;
  rif?: string | null;
  nameClient?: string | null;
  adressClient?: string | null;
  active?: number;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface CotRegion {
  idRegion: number;
  idClient?: number | null;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  price?: number;
  priceOnline?: number;
  active?: number;
  client?: CotClient | null;
}

export interface CotTemplate {
  idTemplate: number;
  code?: string | null;
  name?: string | null;
  price?: number;
  hours?: number;
}

export interface CotEmpresa {
  idEmpresa: number;
  company?: string | null;
  telephone?: string | null;
  email?: string | null;
  web?: string | null;
  logo?: string | null;
  prefix?: string | null;
}

export interface CotTasaIva {
  idTasaIva: number;
  nombre?: string | null;
  porcentaje?: number;
  activo?: number | null;
  orden?: number | null;
}

/** Rango de usuarios (desde/hasta). */
export interface CotRangoUsuario {
  idRango: number;
  desde: number;
  hasta: number;
  descripcion?: string | null;
  activo?: number | null;
}

/** Tarifa por región + rango de usuarios + modalidad. */
export interface CotTarifa {
  idTarifa: number;
  idRegion: number;
  idRango: number;
  modalidad: string;
  tarifa: number;
  activo?: number | null;
  region?: CotRegion | null;
  rango?: CotRangoUsuario | null;
}

export interface BudgetDetail {
  idTemplate: number;
  secuencia?: number | null;
  description?: string | null;
  quantity?: number;
  price?: number;
  tax?: number;
  idTasaIva?: number | null;
  amountTax?: number | null;
  total?: number;
  idRegion?: number | null;
  modalidad?: string | null;
  idTarifa?: number | null;
  tarifaAplicada?: number | null;
  /** Marcado en runtime cuando no existe tarifa para la combinación. */
  sinTarifa?: boolean;
  template?: CotTemplate | null;
  region?: CotRegion | null;
  tasaIva?: CotTasaIva | null;
}

export interface Budget {
  idBudget: number;
  codeBudget?: string | null;
  dateBudget?: string | null;
  vencimiento?: string | null;
  hourBudget?: string | null;
  usuario?: string | null;
  note?: string | null;
  soporte?: string | null;
  modalidad?: string | null;
  idClient?: number | null;
  idEmpresa?: number;
  nroUser?: number | null;
  idRango?: number | null;
  status?: number;
  emailSent?: number;
  totalUsd?: number;
  ivaUsd?: number;
  tasaBcv?: number;
  montoSubtotal?: number;
  montoExento?: number;
  montoBaseImponible?: number;
  montoIva?: number;
  montoTotal?: number;
  client?: CotClient | null;
  empresa?: CotEmpresa | null;
  detalles?: BudgetDetail[];
  historial?: BudgetHistory[];
}

export interface BudgetHistory {
  idHistory: number;
  idBudget: number;
  dateChange?: string | null;
  usuario?: string | null;
  note?: string | null;
}

export const ESTADOS_BUDGET: Record<number, string> = {
  0: 'BORRADOR',
  1: 'ENVIADA',
  2: 'ACEPTADA',
  3: 'RECHAZADA',
  4: 'ELIMINADA',
};

export interface CotVencidas {
  hoy: string;
  vencidas: Budget[];
  porVencer: Budget[];
  totalVencidas: number;
  totalPorVencer: number;
}