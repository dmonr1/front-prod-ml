import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import {
  ConfiguracionEvaluacionCursoDetalle,
  ConfiguracionEvaluacionCursoGuardarPayload,
  ConfiguracionEvaluacionCursoResumen
} from '../../models/configuracion-evaluacion-curso';

@Injectable({ providedIn: 'root' })
export class ConfiguracionEvaluacionCursoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/configuraciones-evaluacion/cursos-periodo`;

  listarCursos(periodoAcademicoId: number): Observable<ConfiguracionEvaluacionCursoResumen[]> {
    return this.http.get<ConfiguracionEvaluacionCursoResumen[]>(`${this.api}?periodoAcademicoId=${periodoAcademicoId}`);
  }

  obtenerDetalle(periodoAcademicoId: number, cursoId: number): Observable<ConfiguracionEvaluacionCursoDetalle> {
    return this.http.get<ConfiguracionEvaluacionCursoDetalle>(
      `${this.api}/detalle?periodoAcademicoId=${periodoAcademicoId}&cursoId=${cursoId}`
    );
  }

  guardar(payload: ConfiguracionEvaluacionCursoGuardarPayload): Observable<ConfiguracionEvaluacionCursoDetalle> {
    return this.http.post<ConfiguracionEvaluacionCursoDetalle>(this.api, payload);
  }
}
