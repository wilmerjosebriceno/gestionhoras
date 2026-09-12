export interface Grupo {
  idGrupo: string;
  grupo: string;
  denominacion: string;
}

export interface CreateGrupo {
  grupo: string;
  denominacion: string;
}

export interface UpdateGrupo {
  denominacion?: string;
}
