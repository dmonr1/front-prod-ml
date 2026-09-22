export interface Docente {
  id: number;
  usuarioId: number | null;
  username: string | null;
  correo: string | null;
  tipoDocumentoId: number;
  tipoDocumentoCodigo: string;
  tipoDocumentoNombre: string;
  numeroDocumento: string | null;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  especialidad: string | null;
  estado: string | null;
}
