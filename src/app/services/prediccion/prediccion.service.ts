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
  puntajeRiesgo: number;
  nivelRiesgo: string;
  modeloVersion: string | null;
  variablesEntrada: string | null;
  fechaPrediccion: string | null;
}

export interface ResumenPrediccion {
  periodoEvaluacionId: number;
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

@Injectable({ providedIn: 'root' })
export class PrediccionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/predicciones`;

  listarGlobales(periodoEvaluacionId: number, seccionId: number): Observable<PrediccionRiesgo[]> {
    return this.http.get<PrediccionRiesgo[]>(`${this.api}/globales`, {
      params: { periodoEvaluacionId, seccionId }
    });
  }

  listarCursos(periodoEvaluacionId: number, seccionId: number): Observable<PrediccionRiesgo[]> {
    return this.http.get<PrediccionRiesgo[]>(`${this.api}/cursos`, {
      params: { periodoEvaluacionId, seccionId }
    });
  }

  obtenerResumen(periodoEvaluacionId: number, seccionId: number): Observable<ResumenPrediccion> {
    return this.http.get<ResumenPrediccion>(`${this.api}/resumen`, {
      params: { periodoEvaluacionId, seccionId }
    });
  }
}
