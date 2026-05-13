import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import {
  ConfiguracionEvaluacion,
  DetalleNotaEvaluacion,
  Evaluacion,
  EvaluacionPayload,
  NotaEvaluacionPayload
} from '../../models/evaluacion';

@Injectable({ providedIn: 'root' })
export class EvaluacionService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listarConfiguraciones(periodoEvaluacionId: number, cursoId: number): Observable<ConfiguracionEvaluacion[]> {
    return this.http.get<ConfiguracionEvaluacion[]>(`${this.api}/configuraciones-evaluacion`, {
      params: { periodoEvaluacionId, cursoId }
    });
  }

  listarEvaluaciones(docenteCursoSeccionId: number, periodoEvaluacionId: number): Observable<Evaluacion[]> {
    return this.http.get<Evaluacion[]>(`${this.api}/evaluaciones`, {
      params: { docenteCursoSeccionId, periodoEvaluacionId }
    });
  }

  crearEvaluacion(payload: EvaluacionPayload): Observable<Evaluacion> {
    return this.http.post<Evaluacion>(`${this.api}/evaluaciones`, payload);
  }

  listarNotas(evaluacionId: number): Observable<DetalleNotaEvaluacion[]> {
    return this.http.get<DetalleNotaEvaluacion[]>(`${this.api}/evaluaciones/${evaluacionId}/notas`);
  }

  registrarNotas(
    evaluacionId: number,
    notas: NotaEvaluacionPayload[]
  ): Observable<DetalleNotaEvaluacion[]> {
    return this.http.post<DetalleNotaEvaluacion[]>(
      `${this.api}/evaluaciones/${evaluacionId}/notas`,
      { notas }
    );
  }
}
