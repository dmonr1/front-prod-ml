import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { BloqueHorario, BloqueHorarioPayload, HorarioSemanal, HorarioSemanalPayload } from '../../models/horario';

@Injectable({ providedIn: 'root' })
export class HorarioService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/horarios`;

  listarBloques(periodoAcademicoId: number, nivelId: number): Observable<BloqueHorario[]> {
    return this.http.get<BloqueHorario[]>(`${this.api}/bloques`, { params: { periodoAcademicoId, nivelId } });
  }

  crearBloque(payload: BloqueHorarioPayload): Observable<BloqueHorario> {
    return this.http.post<BloqueHorario>(`${this.api}/bloques`, payload);
  }

  actualizarBloque(id: number, payload: BloqueHorarioPayload): Observable<BloqueHorario> {
    return this.http.put<BloqueHorario>(`${this.api}/bloques/${id}`, payload);
  }

  cambiarEstadoBloque(id: number, activo: boolean): Observable<void> {
    return this.http.patch<void>(`${this.api}/bloques/${id}/estado`, null, { params: { activo } });
  }

  listar(periodoAcademicoId: number): Observable<HorarioSemanal[]> {
    return this.http.get<HorarioSemanal[]>(this.api, { params: { periodoAcademicoId } });
  }

  listarMios(periodoAcademicoId: number): Observable<HorarioSemanal[]> {
    return this.http.get<HorarioSemanal[]>(`${this.api}/mios`, { params: { periodoAcademicoId } });
  }

  crear(payload: HorarioSemanalPayload): Observable<HorarioSemanal> {
    return this.http.post<HorarioSemanal>(this.api, payload);
  }

  cambiarEstado(id: number, activo: boolean): Observable<void> {
    return this.http.patch<void>(`${this.api}/${id}/estado`, null, { params: { activo } });
  }
}
