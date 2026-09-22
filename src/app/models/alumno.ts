export interface Alumno {
  id: number;
  codigo: string;
  tipoDocumentoId: number;
  tipoDocumentoCodigo: string;
  tipoDocumentoNombre: string;
  numeroDocumento: string | null;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  sexo: string | null;
  direccion: string | null;
  nombreApoderado: string | null;
  telefonoApoderado: string | null;
  estado: string | null;
}
