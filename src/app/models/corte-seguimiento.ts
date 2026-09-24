export interface CorteSeguimiento {
  id: number;
  periodoAcademicoId: number;
  semana: number;
  fechaCorte: string;
}

export interface CorteSeguimientoPayload {
  semana: number;
  fechaCorte: string;
}

export interface EvaluacionPendienteFecha {
  evaluacionId: number;
  asignacionId: number;
  periodoEvaluacionId: number;
  periodoEvaluacion: string;
  curso: string;
  tipoEvaluacion: string;
  nombre: string;
  numeroEvaluacion: number;
  fechaEvaluacion: string | null;
}

export interface PreparacionCorte {
  periodoAcademico: string;
  periodoEvaluacion: string | null;
  fechaCorte: string;
  corteDisponible: boolean;
  alumnosMatriculados: number;
  alumnosConDatos: number;
  alumnosConAsistencia: number;
  evaluacionesSinFecha: number;
  evaluacionesAlCorte: number;
  notasEsperadas: number;
  notasRegistradas: number;
  bloquesSemanales: number;
  asistenciasRegistradas: number;
}
