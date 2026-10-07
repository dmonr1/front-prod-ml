export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';
export type TipoBloqueHorario = 'CLASE' | 'RECREO' | 'TUTORIA';

export interface BloqueHorario {
  id: number;
  periodoAcademicoId: number;
  nivelId: number;
  nivel: string;
  nombre: string;
  orden: number;
  horaInicio: string;
  horaFin: string;
  esRecreo: boolean;
  tipoBloque: TipoBloqueHorario;
}

export interface HorarioSemanal {
  id: number;
  asignacionId: number;
  docenteId: number;
  docente: string;
  cursoId: number;
  curso: string;
  seccionId: number;
  seccion: string;
  grado: string;
  nivel: string;
  periodoAcademicoId: number;
  bloqueHorarioId: number;
  bloque: string;
  ordenBloque: number;
  horaInicio: string;
  horaFin: string;
  diaSemana: DiaSemana;
}

export interface BloqueHorarioPayload {
  periodoAcademicoId: number;
  nivelId: number;
  nombre: string;
  orden: number;
  horaInicio: string;
  horaFin: string;
  esRecreo: boolean;
  tipoBloque: TipoBloqueHorario;
}

export interface HorarioSemanalPayload {
  asignacionId: number;
  bloqueHorarioId: number;
  diaSemana: DiaSemana;
  horarioPendienteId?: number;
}
