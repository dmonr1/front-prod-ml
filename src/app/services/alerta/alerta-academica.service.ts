import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { AlertaAcademica } from '../../models/alerta-academica';

@Injectable({ providedIn: 'root' })
export class AlertaAcademicaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/alertas-academicas`;

  listar(estado = 'PENDIENTE'): Observable<AlertaAcademica[]> {
    return this.http.get<AlertaAcademica[]>(this.api, { params: new HttpParams().set('estado', estado) });
  }

  contarPendientes(): Observable<number> {
    return this.http.get<number>(`${this.api}/contador`);
  }
}
