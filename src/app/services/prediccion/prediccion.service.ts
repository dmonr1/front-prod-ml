import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface PrediccionRiesgo {
  id: number;
  matriculaId: number;
  alumnoId: number;
  codigoAlumno: string;
  alumnoNombreCompleto: string;
  cursoId: number | null;
  curso: string | null;
  nivel: string | null;
  grado: string | null;
  seccion: string | null;
  periodoAcademicoId: number | null;
  anioAcademico: number | null;
  periodoEvaluacionId: number | null;
  numeroPeriodoEvaluacion: number | null;
  nombrePeriodoEvaluacion: string | null;
  corteSeguimientoId?: number | null;
  semanaCorte?: number | null;
  fechaCorte?: string | null;
  puntajeRiesgo: number;
  nivelRiesgo: string;
  modeloVersion: string | null;
  variablesEntrada: string | null;
  fechaPrediccion: string | null;
}

export interface ResumenPrediccion {
  periodoEvaluacionId?: number | null;
  corteSeguimientoId?: number | null;
  semanaCorte?: number | null;
  fechaCorte?: string | null;
  seccionId: number;
  nivel: string | null;
  grado: string | null;
  seccion: string | null;
  totalPredicciones: number;
  totalRiesgoAlto: number;
  totalRiesgoMedio: number;
  totalRiesgoBajo: number;
  promedioPuntajeRiesgo: number | null;
}

export interface RecalculoPrediccionesRespuesta {
  mensaje: string;
  periodoEvaluacionId?: number | null;
  corteSeguimientoId?: number | null;
  semanaCorte?: number | null;
  seccionId: number;
  matriculasProcesadas: number;
  modeloVersion: string;
}

@Injectable({ providedIn: 'root' })
export class PrediccionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/predicciones`;

  listarGlobales(corteSeguimientoId: number, seccionId: number): Observable<PrediccionRiesgo[]> {
    return this.http.get<PrediccionRiesgo[]>(`${this.api}/globales`, {
      params: { corteSeguimientoId, seccionId }
    });
  }

  listarCursos(corteSeguimientoId: number, seccionId: number): Observable<PrediccionRiesgo[]> {
    return this.http.get<PrediccionRiesgo[]>(`${this.api}/cursos`, {
      params: { corteSeguimientoId, seccionId }
    });
  }

  listarPorAlumno(alumnoId: number): Observable<PrediccionRiesgo[]> {
    return this.http.get<PrediccionRiesgo[]>(`${this.api}/alumno/${alumnoId}`);
  }

  obtenerResumen(corteSeguimientoId: number, seccionId: number): Observable<ResumenPrediccion> {
    return this.http.get<ResumenPrediccion>(`${this.api}/resumen`, {
      params: { corteSeguimientoId, seccionId }
    });
  }

  recalcular(corteSeguimientoId: number, seccionId: number): Observable<RecalculoPrediccionesRespuesta> {
    return this.http.post<RecalculoPrediccionesRespuesta>(`${this.api}/recalcular`, null, {
      params: { corteSeguimientoId, seccionId }
    });
  }
}
