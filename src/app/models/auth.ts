export interface LoginRequest {
  identificador: string;
  password: string;
}

export interface UsuarioSesion {
  usuarioId: number;
  docenteId: number | null;
  username: string;
  correo: string;
  roles: string[];
  esTutor: boolean;
  permisos: string[];
}

export interface LoginResponse {
  token: string;
  tipoToken: string;
  expiracionSegundos: number;
  usuario: UsuarioSesion;
}
