import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';

export interface PeriodoAcademicoPayload {
  nombre: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  tipoPeriodoEvaluacion: string;
}

export interface PeriodoEvaluacionInicialPayload {
  nombre: string;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
}

export interface PeriodoAcademicoConPeriodosPayload extends PeriodoAcademicoPayload {
  periodosEvaluacion: PeriodoEvaluacionInicialPayload[];
}

export interface PeriodoAcademicoConPeriodosResponse {
  periodoAcademico: PeriodoAcademico;
  periodosEvaluacion: PeriodoEvaluacion[];
}

@Injectable({ providedIn: 'root' })
export class PeriodoAcademicoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/periodos-academicos`;

  listar(): Observable<PeriodoAcademico[]> {
    return this.http.get<PeriodoAcademico[]>(this.api);
  }

  crear(payload: PeriodoAcademicoPayload): Observable<PeriodoAcademico> {
    return this.http.post<PeriodoAcademico>(this.api, payload);
  }

  crearConPeriodosEvaluacion(payload: PeriodoAcademicoConPeriodosPayload): Observable<PeriodoAcademicoConPeriodosResponse> {
    return this.http.post<PeriodoAcademicoConPeriodosResponse>(`${this.api}/con-periodos-evaluacion`, payload);
  }
}
