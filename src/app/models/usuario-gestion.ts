export interface UsuarioGestion {
  id: number;
  username: string;
  correo: string;
  estado: string;
  debeCambiarPassword: boolean;
  docenteId: number | null;
  docenteNombreCompleto: string | null;
  roles: string[];
}
