import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Matricula } from '../../models/matricula';

export interface MatriculaPayload {
  alumnoId: number;
  seccionId: number;
  periodoAcademicoId: number;
  fechaMatricula?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MatriculaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/matriculas`;

  listar(periodoAcademicoId: number, seccionId?: number | null): Observable<Matricula[]> {
    const params: Record<string, string | number> = { periodoAcademicoId };
    if (seccionId) {
      params['seccionId'] = seccionId;
    }

    return this.http.get<Matricula[]>(this.api, { params });
  }

  crear(payload: MatriculaPayload): Observable<Matricula> {
    return this.http.post<Matricula>(this.api, payload);
  }
}
