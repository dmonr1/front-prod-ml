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
