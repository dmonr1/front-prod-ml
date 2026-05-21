import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Curso } from '../../models/curso';

export interface CursoPayload {
  nombre: string;
  descripcion: string | null;
  portadaColor: string | null;
  portadaIcono: string | null;
  portadaImagen: string | null;
  nivelId: number;
}

@Injectable({ providedIn: 'root' })
export class CursoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/cursos`;

  listar(): Observable<Curso[]> {
    return this.http.get<Curso[]>(this.api);
  }

  crear(payload: CursoPayload): Observable<Curso> {
    return this.http.post<Curso>(this.api, payload);
  }

  actualizarEstado(cursoId: number, activo: boolean): Observable<Curso> {
    return this.http.patch<Curso>(`${this.api}/${cursoId}/estado`, null, {
      params: { activa: String(activo) }
    });
  }
}
