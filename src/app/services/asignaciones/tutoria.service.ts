import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Tutoria } from '../../models/tutoria';

export interface TutoriaPayload {
  docenteId: number;
  seccionId: number;
  periodoAcademicoId: number;
}

export interface CursoTutoriaResumen {
  asignacionId: number;
  cursoId: number;
  curso: string;
  docenteId: number;
  docenteNombreCompleto: string;
}

export interface CursoAlumnoTutoriaResumen {
  asignacionId: number;
  cursoId: number;
  curso: string;
  docenteId: number;
  docenteNombreCompleto: string;
  evaluacionesRegistradas: number;
  promedio: number | null;
  notas: number[];
  detalleNotas?: Array<{
    etiqueta: string;
    nota: number;
  }>;
}

export interface AlumnoTutoriaResumen {
  matriculaId: number;
  alumnoId: number;
  codigoAlumno: string;
  alumnoNombreCompleto: string;
  clasesProgramadas: number;
  clasesAsistidas: number;
  porcentajeAsistencia: number | null;
  promedioGeneral: number | null;
  cursos: CursoAlumnoTutoriaResumen[];
}

export interface TutoriaResumenAcademico {
  tutoriaId: number;
  docenteTutorId: number;
  docenteTutorNombreCompleto: string;
  seccionId: number;
  seccion: string;
  grado: string;
  nivel: string;
  periodoAcademicoId: number;
  periodoAcademico: string;
  anioAcademico: number;
  periodoEvaluacionId: number;
  periodoEvaluacion: string;
  periodoEvaluacionFechaInicio: string;
  periodoEvaluacionFechaFin: string;
  cursos: CursoTutoriaResumen[];
  alumnos: AlumnoTutoriaResumen[];
}

@Injectable({ providedIn: 'root' })
export class TutoriaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tutorias`;

  listarPorPeriodo(periodoAcademicoId: number): Observable<Tutoria[]> {
    return this.http.get<Tutoria[]>(this.api, {
      params: {
        periodoAcademicoId
      }
    });
  }

  listarPorDocente(docenteId: number, periodoAcademicoId: number): Observable<Tutoria[]> {
    return this.http.get<Tutoria[]>(`${environment.apiUrl}/docentes/${docenteId}/tutorias`, {
      params: {
        periodoAcademicoId
      }
    });
  }

  crear(payload: TutoriaPayload): Observable<Tutoria> {
    return this.http.post<Tutoria>(this.api, payload);
  }

  actualizarEstado(tutoriaId: number, activo: boolean): Observable<Tutoria> {
    return this.http.patch<Tutoria>(`${this.api}/${tutoriaId}/estado`, null, {
      params: {
        activo
      }
    });
  }

  obtenerResumenAcademico(
    tutoriaId: number,
    periodoEvaluacionId: number
  ): Observable<TutoriaResumenAcademico> {
    return this.http.get<TutoriaResumenAcademico>(`${this.api}/${tutoriaId}/resumen-academico`, {
      params: {
        periodoEvaluacionId
      }
    });
  }
}
