import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Curso } from '../../models/curso';
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

export interface ConfiguracionEvaluacionDefaultPayload {
  tipoEvaluacionId: number;
  cantidadEvaluaciones: number;
  calcularEnPromedio: boolean;
}

export interface PeriodoAcademicoConPeriodosPayload extends PeriodoAcademicoPayload {
  periodosEvaluacion: PeriodoEvaluacionInicialPayload[];
  configuracionesEvaluacionDefault: ConfiguracionEvaluacionDefaultPayload[];
  cursosIds?: number[];
  copiarCursosPeriodoAnterior?: boolean;
}

export interface CursoPeriodoAcademicoResponse {
  id: number;
  periodoAcademicoId: number;
  periodoAcademicoNombre: string;
  anioAcademico: number;
  cursoId: number;
  cursoNombre: string;
  cursoDescripcion: string | null;
  nivelId: number;
  nivelNombre: string;
  estado: string | null;
}

export interface PeriodoAcademicoConPeriodosResponse {
  periodoAcademico: PeriodoAcademico;
  periodosEvaluacion: PeriodoEvaluacion[];
  configuracionesEvaluacionDefault: ConfiguracionEvaluacionDefaultPayload[];
  cursosPeriodoAcademico: CursoPeriodoAcademicoResponse[];
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

  obtenerDetalle(periodoAcademicoId: number): Observable<PeriodoAcademicoConPeriodosResponse> {
    return this.http.get<PeriodoAcademicoConPeriodosResponse>(`${this.api}/${periodoAcademicoId}/detalle`);
  }

  actualizarConPeriodosEvaluacion(
    periodoAcademicoId: number,
    payload: PeriodoAcademicoConPeriodosPayload
  ): Observable<PeriodoAcademicoConPeriodosResponse> {
    return this.http.put<PeriodoAcademicoConPeriodosResponse>(
      `${this.api}/${periodoAcademicoId}/con-periodos-evaluacion`,
      payload
    );
  }
}
