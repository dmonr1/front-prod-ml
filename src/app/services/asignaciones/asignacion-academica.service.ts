import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { AsignacionDocente } from '../../models/asignacion';

export interface AsignacionDocentePayload {
  docenteId: number;
  cursoId: number;
  seccionId: number;
  periodoAcademicoId: number;
}

@Injectable({ providedIn: 'root' })
export class AsignacionAcademicaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  crear(payload: AsignacionDocentePayload): Observable<AsignacionDocente> {
    return this.http.post<AsignacionDocente>(`${this.api}/asignaciones-docente`, payload);
  }

  listarPorPeriodo(periodoAcademicoId: number): Observable<AsignacionDocente[]> {
    return this.http.get<AsignacionDocente[]>(`${this.api}/asignaciones-docente`, {
      params: {
        periodoAcademicoId
      }
    });
  }

  listarAsignaciones(docenteId: number, periodoAcademicoId: number): Observable<AsignacionDocente[]> {
    return this.http.get<AsignacionDocente[]>(
      `${this.api}/docentes/${docenteId}/asignaciones`,
      {
        params: {
          periodoAcademicoId
        }
      }
    );
  }
}
