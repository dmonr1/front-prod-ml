import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Tutoria } from '../../models/tutoria';

export interface TutoriaPayload {
  docenteId: number;
  seccionId: number;
  periodoAcademicoId: number;
}

@Injectable({ providedIn: 'root' })
export class TutoriaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tutorias`;

  listarPorPeriodo(periodoAcademicoId: number): Observable<Tutoria[]> {
    return this.http.get<Tutoria[]>(this.api, {
      params: {
        periodoAcademicoId
      }
    });
  }

  crear(payload: TutoriaPayload): Observable<Tutoria> {
    return this.http.post<Tutoria>(this.api, payload);
  }
}
