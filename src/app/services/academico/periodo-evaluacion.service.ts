import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';

export interface PeriodoEvaluacionPayload {
  periodoAcademicoId: number;
  nombre: string;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
}

@Injectable({ providedIn: 'root' })
export class PeriodoEvaluacionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/periodos-evaluacion`;

  listar(): Observable<PeriodoEvaluacion[]> {
    return this.http.get<PeriodoEvaluacion[]>(this.api);
  }

  crear(payload: PeriodoEvaluacionPayload): Observable<PeriodoEvaluacion> {
    return this.http.post<PeriodoEvaluacion>(this.api, payload);
  }
}
