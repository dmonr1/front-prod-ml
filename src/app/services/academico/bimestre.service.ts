import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Bimestre } from '../../models/bimestre';

export interface BimestrePayload {
  periodoAcademicoId: number;
  nombre: string;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
}

@Injectable({ providedIn: 'root' })
export class BimestreService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/bimestres`;

  listar(): Observable<Bimestre[]> {
    return this.http.get<Bimestre[]>(this.api);
  }

  crear(payload: BimestrePayload): Observable<Bimestre> {
    return this.http.post<Bimestre>(this.api, payload);
  }
}
