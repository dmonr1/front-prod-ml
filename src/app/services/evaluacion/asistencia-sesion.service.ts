import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { AsistenciaSesion, RegistroAsistenciaSesionPayload } from '../../models/asistencia-sesion';

@Injectable({ providedIn: 'root' })
export class AsistenciaSesionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/asistencias-sesiones`;

  listar(asignacionId: number, periodoEvaluacionId: number, fecha: string, horarioSemanalId?: number | null): Observable<AsistenciaSesion[]> {
    let params = new HttpParams()
      .set('docenteCursoSeccionId', asignacionId)
      .set('periodoEvaluacionId', periodoEvaluacionId)
      .set('fecha', fecha);
    if (horarioSemanalId) params = params.set('horarioSemanalId', horarioSemanalId);
    return this.http.get<AsistenciaSesion[]>(this.api, { params });
  }

  guardar(payload: RegistroAsistenciaSesionPayload): Observable<AsistenciaSesion[]> {
    return this.http.post<AsistenciaSesion[]>(this.api, payload);
  }
}
