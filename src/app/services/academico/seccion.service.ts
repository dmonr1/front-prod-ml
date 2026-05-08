import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Seccion } from '../../models/seccion';

export interface SeccionPayload {
  gradoId: number;
  nombre: string;
  capacidad: number | null;
}

@Injectable({ providedIn: 'root' })
export class SeccionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/secciones`;

  listar(): Observable<Seccion[]> {
    return this.http.get<Seccion[]>(this.api);
  }

  crear(payload: SeccionPayload): Observable<Seccion> {
    return this.http.post<Seccion>(this.api, payload);
  }
}
