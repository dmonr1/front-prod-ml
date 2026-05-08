export interface Grado {
  id: number;
  nombre: string;
  orden: number;
  estado: string | null;
  nivelId: number | null;
  nivelNombre: string | null;
  totalSecciones: number;
}
