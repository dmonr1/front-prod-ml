import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CorteSeguimiento, EvaluacionPendienteFecha, PreparacionCorte } from '../../models/corte-seguimiento';

@Injectable({ providedIn: 'root' })
export class CorteSeguimientoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/cortes-seguimiento`;
  private readonly verificacionesCompletadas = new Set<string>();
  private readonly verificacionesEnCurso = new Set<string>();

  iniciarVerificacionFaltantes(clave: string): boolean {
    if (this.verificacionesCompletadas.has(clave) || this.verificacionesEnCurso.has(clave)) return false;
    this.verificacionesEnCurso.add(clave);
    return true;
  }

  marcarFaltantesVerificados(clave: string): void {
    this.verificacionesEnCurso.delete(clave);
    this.verificacionesCompletadas.add(clave);
  }

  liberarVerificacionFaltantes(clave: string): void {
    this.verificacionesEnCurso.delete(clave);
  }

  listar(periodoAcademicoId: number): Observable<CorteSeguimiento[]> {
    return this.http.get<CorteSeguimiento[]>(this.api, { params: { periodoAcademicoId } });
  }

  evaluacionesPendientes(corteId: number, seccionId: number): Observable<EvaluacionPendienteFecha[]> {
    return this.http.get<EvaluacionPendienteFecha[]>(`${this.api}/${corteId}/evaluaciones-pendientes`, {
      params: { seccionId }
    });
  }

  preparacion(corteId: number, seccionId: number): Observable<PreparacionCorte> {
    return this.http.get<PreparacionCorte>(`${this.api}/${corteId}/preparacion`, { params: { seccionId } });
  }

  recalcularFaltantes(periodoAcademicoId: number): Observable<RecalculoFaltantesRespuesta> {
    return this.http.post<RecalculoFaltantesRespuesta>(`${this.api}/recalcular-faltantes`, null, {
      params: { periodoAcademicoId }
    });
  }

  recalcularFaltantesCorte(corteId: number, seccionId: number, trabajoId: string): Observable<RecalculoFaltantesSeccionRespuesta> {
    return this.http.post<RecalculoFaltantesSeccionRespuesta>(
      `${this.api}/${corteId}/secciones/${seccionId}/recalcular-faltantes`,
      null,
      { params: { trabajoId } }
    );
  }

  progresoRecalculoFaltantes(corteId: number, seccionId: number, trabajoId: string): Observable<ProgresoRecalculoFaltantes> {
    return this.http.get<ProgresoRecalculoFaltantes>(
      `${this.api}/${corteId}/secciones/${seccionId}/recalcular-faltantes/progreso`,
      { params: { trabajoId } }
    );
  }
}

export interface RecalculoFaltantesRespuesta {
  periodoAcademicoId: number;
  cortesEvaluados: number;
  cortesConNuevasPredicciones: number;
  matriculasProcesadas: number;
  errores: number;
  detallesError: string[];
}

export interface RecalculoFaltantesSeccionRespuesta {
  corteSeguimientoId: number;
  seccionId: number;
  matriculasProcesadas: number;
  erroresPrediccion: number;
}

export interface ProgresoRecalculoFaltantes {
  procesados: number;
  total: number;
  alumnoEnCurso: number;
  porcentaje: number;
  finalizado: boolean;
  error: boolean;
}
