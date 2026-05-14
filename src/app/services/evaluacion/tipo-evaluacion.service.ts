import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { TipoEvaluacion } from '../../models/tipo-evaluacion';

@Injectable({ providedIn: 'root' })
export class TipoEvaluacionService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tipos-evaluacion`;

  listar(): Observable<TipoEvaluacion[]> {
    return this.http.get<TipoEvaluacion[]>(this.api);
  }
}
