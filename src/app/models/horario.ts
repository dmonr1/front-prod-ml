export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';

export interface BloqueHorario {
  id: number;
  periodoAcademicoId: number;
  nivelId: number;
  nivel: string;
  nombre: string;
  orden: number;
  horaInicio: string;
  horaFin: string;
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
}

export interface HorarioSemanalPayload {
  asignacionId: number;
  bloqueHorarioId: number;
  diaSemana: DiaSemana;
}
