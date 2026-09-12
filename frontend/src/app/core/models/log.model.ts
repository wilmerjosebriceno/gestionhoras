export interface LogEntry {
  id: string;
  idEvento?: string;
  evento?: string;
  idAcceso?: string;
  fecha: string;
  hora: string;
  nota: string;
  tcpip: string;
  estblk: number;
}

export interface QueryLog {
  nota?: string;
  fechaInicio?: string;
  fechaFin?: string;
  page?: number;
  limit?: number;
}

export interface LogResponse {
  data: LogEntry[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface Evento {
  idEvento: string;
  evento: string;
  denominacion: string;
}

export interface ResumenAuditoria {
  totalLogs: number;
  logsHoy: number;
  eventos: { evento: string; count: number }[];
}
