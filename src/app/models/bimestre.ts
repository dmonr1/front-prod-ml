export interface Bimestre {
  id: number;
  nombre: string;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string | null;
  periodoAcademicoId: number | null;
  periodoAcademicoNombre: string | null;
  anioAcademico: number | null;
}
