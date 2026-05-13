import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Seccion } from '../../models/seccion';

export interface SeccionPayload {
  gradoId: number;
  periodoAcademicoId?: number | null;
  nombre: string;
  capacidad: number | null;
}

export interface SeccionPeriodoAnteriorPayload {
  gradoId: number;
  periodoAcademicoId: number;
}

@Injectable({ providedIn: 'root' })
export class SeccionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/secciones`;

  listar(periodoAcademicoId?: number | null): Observable<Seccion[]> {
    const params = periodoAcademicoId ? { periodoAcademicoId } : undefined;
    return this.http.get<Seccion[]>(this.api, { params });
  }

  crear(payload: SeccionPayload): Observable<Seccion> {
    return this.http.post<Seccion>(this.api, payload);
  }

  copiarPeriodoAnterior(payload: SeccionPeriodoAnteriorPayload): Observable<Seccion[]> {
    return this.http.post<Seccion[]>(`${this.api}/copiar-periodo-anterior`, payload);
  }

  actualizarEstado(seccionId: number, activa: boolean): Observable<Seccion> {
    return this.http.patch<Seccion>(`${this.api}/${seccionId}/estado`, null, {
      params: { activa }
    });
  }
}
