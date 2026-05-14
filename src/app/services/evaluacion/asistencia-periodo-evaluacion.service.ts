import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import {
  AsistenciaPeriodoEvaluacion,
  AsistenciaPeriodoEvaluacionPayload,
  ConfiguracionAsistenciaPeriodo
} from '../../models/asistencia-periodo-evaluacion';

@Injectable({ providedIn: 'root' })
export class AsistenciaPeriodoEvaluacionService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listar(
    seccionId: number,
    periodoAcademicoId: number,
    periodoEvaluacionId: number
  ): Observable<AsistenciaPeriodoEvaluacion[]> {
    return this.http.get<AsistenciaPeriodoEvaluacion[]>(
      `${this.api}/asistencias-periodo-evaluacion`,
      {
        params: { seccionId, periodoAcademicoId, periodoEvaluacionId }
      }
    );
  }

  registrar(
    periodoEvaluacionId: number,
    docenteCursoSeccionId: number,
    asistencias: AsistenciaPeriodoEvaluacionPayload[]
  ): Observable<AsistenciaPeriodoEvaluacion[]> {
    return this.http.post<AsistenciaPeriodoEvaluacion[]>(
      `${this.api}/asistencias-periodo-evaluacion/${periodoEvaluacionId}`,
      { docenteCursoSeccionId, asistencias }
    );
  }

  obtenerConfiguracion(
    docenteCursoSeccionId: number,
    periodoEvaluacionId: number
  ): Observable<ConfiguracionAsistenciaPeriodo | null> {
    return this.http.get<ConfiguracionAsistenciaPeriodo | null>(
      `${this.api}/asistencias-periodo-evaluacion/configuracion`,
      {
        params: { docenteCursoSeccionId, periodoEvaluacionId }
      }
    );
  }

  guardarConfiguracion(
    periodoEvaluacionId: number,
    docenteCursoSeccionId: number,
    clasesProgramadas: number
  ): Observable<ConfiguracionAsistenciaPeriodo> {
    return this.http.post<ConfiguracionAsistenciaPeriodo>(
      `${this.api}/asistencias-periodo-evaluacion/${periodoEvaluacionId}/configuracion`,
      { docenteCursoSeccionId, clasesProgramadas }
    );
  }
}
