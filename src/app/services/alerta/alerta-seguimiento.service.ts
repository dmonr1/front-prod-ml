import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface AlertaSeguimiento {
  id: number;
  matriculaId: number;
  alumnoId: number;
  codigoAlumno: string;
  alumnoNombreCompleto: string;
  cursoId: number | null;
  curso: string | null;
  tipoAlerta: string;
  nivelRiesgo: string;
  mensaje: string;
  atendida: boolean;
  fechaRegistro: string | null;
}

export interface RecomendacionSeguimiento {
  id: number;
  matriculaId: number;
  alumnoId: number;
  codigoAlumno: string;
  alumnoNombreCompleto: string;
  cursoId: number | null;
  curso: string | null;
  titulo: string;
  descripcion: string;
  fuente: string | null;
  fechaRegistro: string | null;
}

@Injectable({ providedIn: 'root' })
export class AlertaSeguimientoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/alertas`;

  listarAlertas(periodoEvaluacionId: number, seccionId: number): Observable<AlertaSeguimiento[]> {
    return this.http.get<AlertaSeguimiento[]>(this.api, {
      params: { periodoEvaluacionId, seccionId }
    });
  }

  listarRecomendaciones(
    periodoEvaluacionId: number,
    seccionId: number
  ): Observable<RecomendacionSeguimiento[]> {
    return this.http.get<RecomendacionSeguimiento[]>(`${this.api}/recomendaciones`, {
      params: { periodoEvaluacionId, seccionId }
    });
  }
}
