import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Curso } from '../../models/curso';

@Injectable({ providedIn: 'root' })
export class CursoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/cursos`;

  listar(): Observable<Curso[]> {
    return this.http.get<Curso[]>(this.api);
  }
}
