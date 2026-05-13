export interface ConfiguracionEvaluacion {
  id: number;
  periodoAcademicoId: number;
  periodoEvaluacionId: number;
  nombrePeriodoEvaluacion: string;
  cursoId: number;
  nombreCurso: string;
  gradoId: number | null;
  nombreGrado: string | null;
  tipoEvaluacionId: number;
  nombreTipoEvaluacion: string;
  cantidadEvaluaciones: number;
  calcularEnPromedio: boolean;
  estado: string;
}

export interface Evaluacion {
  id: number;
  configuracionEvaluacionId: number;
  docenteCursoSeccionId: number;
  periodoEvaluacionId: number;
  nombrePeriodoEvaluacion: string;
  tipoEvaluacionId: number;
  tipoEvaluacion: string;
  numeroEvaluacion: number;
  nombre: string;
  fechaEvaluacion: string | null;
  curso: string;
  seccion: string;
  grado: string;
  nivel: string;
  estado: string;
}

export interface EvaluacionPayload {
  configuracionEvaluacionId: number;
  docenteCursoSeccionId: number;
  periodoEvaluacionId: number;
  tipoEvaluacionId: number;
  numeroEvaluacion: number;
  nombre: string;
  fechaEvaluacion?: string | null;
}

export interface DetalleNotaEvaluacion {
  id: number;
  matriculaId: number;
  alumnoId: number;
  codigoAlumno: string;
  alumnoNombreCompleto: string;
  nota: number;
  observacion: string | null;
}

export interface NotaEvaluacionPayload {
  matriculaId: number;
  nota: number;
  observacion?: string | null;
}
