import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CorteSeguimiento, EvaluacionPendienteFecha, PreparacionCorte } from '../../models/corte-seguimiento';

@Injectable({ providedIn: 'root' })
export class CorteSeguimientoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/cortes-seguimiento`;

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
}
