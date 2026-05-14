import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CursoPeriodoAcademico } from '../../models/curso-periodo-academico';

@Injectable({ providedIn: 'root' })
export class CursoPeriodoAcademicoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/cursos-periodo-academico`;

  listar(periodoAcademicoId?: number | null): Observable<CursoPeriodoAcademico[]> {
    const query = periodoAcademicoId ? `?periodoAcademicoId=${periodoAcademicoId}` : '';
    return this.http.get<CursoPeriodoAcademico[]>(`${this.api}${query}`);
  }
}
