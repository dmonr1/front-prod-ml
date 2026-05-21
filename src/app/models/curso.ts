export interface Curso {
  id: number;
  nivelId: number;
  nivelNombre: string;
  nombre: string;
  descripcion: string | null;
  portadaColor?: string | null;
  portadaIcono?: string | null;
  portadaImagen?: string | null;
  estado: string | null;
}
