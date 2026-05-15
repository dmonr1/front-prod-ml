export interface AsignacionDocente {
  id: number;
  docenteId: number;
  docenteNombreCompleto: string;
  cursoId: number;
  curso: string;
  seccionId: number;
  seccion: string;
  grado: string;
  nivel: string;
  periodoAcademicoId: number;
  periodoAcademico: string;
  anioAcademico: number;
  estado?: string;
}
