import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface PredictorFeature {
  key: string;
  label: string;
  tipo: 'GLOBAL' | 'CURSO';
  categoria: 'ACADEMICO' | 'ASISTENCIA' | 'EVALUATIVO';
  descripcion: string;
  activo: boolean;
  peso: number;
}

export interface ConfiguracionPredictores {
  globalFeatures: PredictorFeature[];
  courseFeatures: PredictorFeature[];
  totalActivos: number;
  ultimaActualizacion?: string;
}

export interface AlgoritmoComparativa {
  id: string;
  nombre: string;
  familia: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  latenciaMs: number;
  estado: 'ACTIVO' | 'CANDIDATO' | 'BASELINE';
  ranking: number;
  hiperparametros: Record<string, unknown>;
}

export interface ComparativaModelos {
  algoritmos: AlgoritmoComparativa[];
  modeloRecomendado: string;
  metricaOptimizada: string;
  fechaEvaluacion: string;
  totalRegistrosEvaluados: number;
  tipoModelo: 'GLOBAL' | 'CURSO';
  origenDatos: string;
  variables: string[];
  registrosEntrenamiento: number;
  alumnosPrueba: number;
  alcanceMetricas: string;
}

export interface PlanificadorReentrenamiento {
  cadencia: string;
  proximaEjecucionProgramada: string;
  ultimoReentrenamiento: string;
  estadoUltimoReentrenamiento: string;
  registrosEntrenamiento: number;
  modeloActualVersion: string;
  modoReentrenamiento: string;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class MlAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/ml`;

  obtenerConfiguracionPredictores(): Observable<ConfiguracionPredictores> {
    return this.http.get<ConfiguracionPredictores>(`${this.api}/configuracion-predictores`);
  }

  actualizarConfiguracionPredictores(config: ConfiguracionPredictores): Observable<ConfiguracionPredictores> {
    return this.http.put<ConfiguracionPredictores>(`${this.api}/configuracion-predictores`, config);
  }

  obtenerComparativaModelos(tipo: 'GLOBAL' | 'CURSO' = 'GLOBAL'): Observable<ComparativaModelos> {
    return this.http.get<ComparativaModelos>(`${this.api}/modelos-comparativa`, { params: { tipo } });
  }

  obtenerPlanificadorReentrenamiento(): Observable<PlanificadorReentrenamiento> {
    return this.http.get<PlanificadorReentrenamiento>(`${this.api}/planificador-reentrenamiento`);
  }

  ejecutarReentrenamiento(): Observable<PlanificadorReentrenamiento> {
    return this.http.post<PlanificadorReentrenamiento>(`${this.api}/reentrenar`, null);
  }
}
