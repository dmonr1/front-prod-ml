export interface Curso {
  id: number;
  nivelId: number;
  nivelNombre: string;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
}
