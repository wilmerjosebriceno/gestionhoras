export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
  usuario: {
    idUser: string;
    login: string;
    nombres: string;
    apellidos: string;
    email: string;
    adminUser: number;
  };
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface CambioPassword {
  passwordActual: string;
  passwordNuevo: string;
  passwordConfirmacion: string;
}
