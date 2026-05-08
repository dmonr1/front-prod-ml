import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Grado } from '../../models/grado';

export interface GradoPayload {
  nombre: string;
  orden: number;
  nivelId: number;
}

@Injectable({ providedIn: 'root' })
export class GradoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/grados`;

  listar(): Observable<Grado[]> {
    return this.http.get<Grado[]>(this.api);
  }

  crear(payload: GradoPayload): Observable<Grado> {
    return this.http.post<Grado>(this.api, payload);
  }
}
