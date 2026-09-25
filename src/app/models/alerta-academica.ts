export type TipoAlertaAcademica = 'ASISTENCIA_PENDIENTE' | 'NOTAS_PENDIENTES';
export type EstadoAlertaAcademica = 'PENDIENTE' | 'ATENDIDA';

export interface AlertaAcademica {
  id: number;
  tipo: TipoAlertaAcademica;
  titulo: string;
  curso: string;
  seccion: string;
  grado: string;
  docente: string;
  fechaReferencia: string;
  fechaLimite: string;
  cantidadPendiente: number;
  estado: EstadoAlertaAcademica;
  asignacionId: number;
  horarioId: number | null;
  evaluacionId: number | null;
  periodoEvaluacionId: number | null;
}
