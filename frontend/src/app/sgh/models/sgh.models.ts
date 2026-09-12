export interface Proceso {
  idProcess: number;
  nameProcess: string;
  active: number;
  code?: string;
  orden: number;
}

export interface ItemActividad {
  idItemActivity: number;
  code?: string;
  name?: string;
  orden: number;
  active: number;
}

export interface Categoria {
  idCategory: number;
  nameCategory: string;
  active: number;
}

export interface TipoActividad {
  idType: number;
  nameType: string;
  active: number;
}

export interface Cliente {
  idClient: number;
  rif: string;
  name: string;
  adress: string;
  email?: string;
  contacTel?: string;
  contacName?: string;
  creation: Date | string;
  active: number;
}

export interface UsuarioSgh {
  idUser: number;
  idCategory?: number;
  login: string;
  nameUser: string;
  email: string;
  creation: Date | string;
  active: number;
  rol?: string;
}

export interface EstructuraFila {
  idEp?: number;
  idItemActivity: number;
  idProcess: number;
  nameProcess?: string;
  nameItem?: string;
  note?: string;
  hours: number;
  active: number;
  orden?: number;
}

export interface ProyectoActividadRow {
  idProyectActivity?: number;
  idProyect?: number;
  idEp?: number;
  hour?: number;
  hourE?: number;
  active?: number;
  name?: string;
  nameProcess?: string;
  idProcess?: number;
  idItemActivity?: number;
  orden?: number;
}

export interface Proyecto {
  idProyect: number;
  numdoc?: string;
  dateProyect?: Date | string;
  dateIni?: Date | string;
  dateFin?: Date | string;
  hours: number;
  responsable?: string;
  idClient?: number;
  status: number;
  enterprise?: number;
  nameClient?: string;
  rif?: string;
  cliente?: Cliente;
}

export interface DetalleActividadRow {
  idDetail?: number;
  idActivity?: number;
  idItemActivity?: number;
  idProcess?: number;
  nameProcess?: string;
  situation?: string;
  hours: number;
  note?: string;
  mantis?: string;
}

export interface Actividad {
  idActivity: number;
  idProyect?: number;
  idType?: number;
  idClient?: number;
  idUser?: number;
  numdoc: string;
  responsible: string;
  dateDocument: Date | string;
  hourDocument: string;
  note?: string;
  status: number;
  visit: number;
  name?: string;
  nameUser?: string;
  nameType?: string;
  file?: string;
  cliente?: Cliente;
  detalles?: DetalleActividadRow[];
  metadata?: Array<{ id: number; idActivity: number; file: string }>;
}

export interface Fase {
  idCron: number;
  idProyect: number;
  idProcess: number;
  nombreOrden?: string;
  fechaIniPlan?: string;
  fechaFinPlan?: string;
  fechaIniReal?: string;
  fechaFinReal?: string;
  idUserResponsable?: number;
  status: number;
  avance: number;
  avanceModelo: number;
  orden: number;
  nameProcess: string;
  nameUser?: string;
  hoursPlan: number;
  hoursEjec: number;
  avanceFinal: number;
}

export interface Seguimiento {
  idSeguimiento: number;
  idCron: number;
  idProyect: number;
  idUser: number;
  fecha?: string;
  horasPlan?: number;
  horasEjec?: number;
  avanceOld?: number;
  avanceNew?: number;
  statusOld?: number;
  statusNew?: number;
  comentario?: string;
  nameUser?: string;
}

export interface Hito {
  idHito: number;
  idCron: number;
  idProyect: number;
  nombre: string;
  fechaPlan?: string;
  fechaReal?: string;
  status: number;
  peso: number;
  comentario?: string;
}

export interface EstructuraProceso {
  idProcess: number;
  nameProcess: string;
  code?: string;
  orden: number;
  hours: number;
  active: number;
}

export interface ProyectoCliente {
  idProyect: number;
  numdoc?: string;
  dateProyect?: Date | string;
  idClient?: number;
  rif?: string;
  name?: string;
}

export interface PaginadoActividades {
  data: Actividad[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActividadHeader {
  idActivity?: number;
  numdoc: string;
  idClient?: number;
  idType?: number;
  idUser?: number;
  idProyect?: number;
  responsible: string;
  dateDocument: string;
  note: string;
  visit: number;
  file?: string;
}
