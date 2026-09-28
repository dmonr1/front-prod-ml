export interface PeriodoAcademico {
  id: number;
  nombre: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  tipoPeriodoEvaluacion: string | null;
  estado: string | null;
  duracionHoraPrimariaMinutos: number;
  duracionRecreoPrimariaMinutos: number;
  duracionHoraSecundariaMinutos: number;
  duracionRecreoSecundariaMinutos: number;
}
