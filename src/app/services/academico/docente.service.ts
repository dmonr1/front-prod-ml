import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Docente } from '../../models/docente';

@Injectable({ providedIn: 'root' })
export class DocenteService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/docentes`;

  listar(): Observable<Docente[]> {
    return this.http.get<Docente[]>(this.api);
  }
}
