export interface AsistenciaPeriodoEvaluacion {
  id: number;
  matriculaId: number;
  alumnoId: number;
  codigoAlumno: string;
  alumnoNombreCompleto: string;
  periodoEvaluacionId: number;
  clasesProgramadas: number;
  clasesAsistidas: number;
  porcentajeAsistencia: number;
  observacion: string | null;
}

export interface AsistenciaPeriodoEvaluacionPayload {
  matriculaId: number;
  clasesAsistidas: number;
  observacion: string | null;
}

export interface ConfiguracionAsistenciaPeriodo {
  id: number;
  docenteCursoSeccionId: number;
  periodoEvaluacionId: number;
  clasesProgramadas: number;
}
