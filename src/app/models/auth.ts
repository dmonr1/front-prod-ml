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
  debeCambiarPassword: boolean;
  permisos: string[];
}

export interface LoginResponse {
  token: string;
  tipoToken: string;
  expiracionSegundos: number;
  usuario: UsuarioSesion;
}

export interface MensajeRespuesta {
  mensaje: string;
}

export interface RecuperacionSolicitarRequest {
  identificador: string;
  correo: string;
}

export interface RecuperacionVerificarRequest {
  identificador: string;
  codigo: string;
}

export interface RecuperacionCambiarPasswordRequest {
  tokenRecuperacion: string;
  nuevaPassword: string;
  confirmarPassword: string;
}

export interface RecuperacionTokenRespuesta {
  mensaje: string;
  tokenRecuperacion: string;
}
