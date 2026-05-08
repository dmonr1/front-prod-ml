import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { AsignacionDocente } from '../../models/asignacion';

@Injectable({ providedIn: 'root' })
export class AsignacionAcademicaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

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
