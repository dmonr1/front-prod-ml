import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { PeriodoAcademico } from '../../models/periodo-academico';

@Injectable({ providedIn: 'root' })
export class PeriodoAcademicoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/periodos-academicos`;

  listar(): Observable<PeriodoAcademico[]> {
    return this.http.get<PeriodoAcademico[]>(this.api);
  }
}
