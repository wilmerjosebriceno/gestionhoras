export interface Usuario {
  idUser: string;
  login: string;
  cedula?: string;
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  email?: string;
  estatus: number;
  adminUser: number;
  nivelGeneral?: number;
  cargo?: string;
  firma?: string;
  idGrupo?: string;
  grupo?: string;
  ultimoLogin?: Date;
  bloqueadoHasta?: Date | null;
  intentosFallidos?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUsuario {
  login: string;
  password: string;
  cedula?: string;
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  observacion?: string;
  email?: string;
  estatus?: number;
  nivelGeneral?: number;
  cargo?: string;
  idGrupo?: string;
}

export interface UpdateUsuario {
  cedula?: string;
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  observacion?: string;
  email?: string;
  estatus?: number;
  nivelGeneral?: number;
  cargo?: string;
  idGrupo?: string;
}

export interface QueryUsuario {
  login?: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  estatus?: number;
  grupo?: string;
  page?: number;
  limit?: number;
}

export interface UsuarioResponse {
  data: Usuario[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
