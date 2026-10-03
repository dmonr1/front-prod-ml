import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { TipoEvaluacion } from '../../models/tipo-evaluacion';

@Injectable({ providedIn: 'root' })
export class PlanificacionEvaluacionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/evaluaciones/planificacion`;

  listarTipos(asignacionId: number): Observable<TipoEvaluacion[]> {
    return this.http.get<TipoEvaluacion[]>(`${this.api}/tipos`, { params: { asignacionId } });
  }

  crearTipo(payload: {
    asignacionId: number;
    periodoEvaluacionId: number;
    nombre: string;
    descripcion: string | null;
    fechas: string[];
  }): Observable<TipoEvaluacion> {
    return this.http.post<TipoEvaluacion>(`${this.api}/tipos`, payload);
  }

  agregar(payload: {
    asignacionId: number;
    periodoEvaluacionId: number;
    tipoEvaluacionId: number;
    fecha: string;
  }): Observable<void> {
    return this.http.post<void>(`${this.api}/agregar`, payload);
  }

  cambiarCantidad(payload: {
    asignacionId: number;
    periodoEvaluacionId: number;
    tipoEvaluacionId: number;
    cantidad: number;
  }): Observable<void> {
    return this.http.put<void>(`${this.api}/cantidad`, payload);
  }

  quitar(evaluacionId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${evaluacionId}`);
  }
}
