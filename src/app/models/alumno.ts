export interface Alumno {
  id: number;
  codigo: string;
  dni: string | null;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  sexo: string | null;
  direccion: string | null;
  nombreApoderado: string | null;
  telefonoApoderado: string | null;
  estado: string | null;
}
