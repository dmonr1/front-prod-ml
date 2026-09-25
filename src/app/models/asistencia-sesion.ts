export type EstadoAsistenciaSesion = 'PRESENTE' | 'AUSENTE' | 'TARDANZA' | 'JUSTIFICADO';

export interface AsistenciaSesion {
  id: number;
  matriculaId: number;
  periodoEvaluacionId: number;
  horarioSemanalId?: number | null;
  fechaClase: string;
  estado: EstadoAsistenciaSesion;
  observacion: string | null;
}

export interface EstadoAsistenciaSesionResumen {
  asignacionId: number;
  horarioSemanalId: number;
  fechaClase: string;
  registradas: number;
  total: number;
}

export interface AsistenciaSesionItemPayload {
  matriculaId: number;
  estado: EstadoAsistenciaSesion;
  observacion?: string | null;
}

export interface RegistroAsistenciaSesionPayload {
  docenteCursoSeccionId: number;
  horarioSemanalId: number;
  periodoEvaluacionId: number;
  fechaClase: string;
  asistencias: AsistenciaSesionItemPayload[];
}
