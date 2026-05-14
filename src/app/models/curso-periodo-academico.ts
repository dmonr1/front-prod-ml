export interface CursoPeriodoAcademico {
  id: number;
  periodoAcademicoId: number;
  periodoAcademicoNombre: string;
  anioAcademico: number;
  cursoId: number;
  cursoNombre: string;
  cursoDescripcion: string | null;
  nivelId: number;
  nivelNombre: string;
  estado: string | null;
}
