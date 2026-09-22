import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { TipoDocumento } from '../../models/tipo-documento';

@Injectable({ providedIn: 'root' })
export class TipoDocumentoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tipos-documento`;

  listar(): Observable<TipoDocumento[]> {
    return this.http.get<TipoDocumento[]>(this.api);
  }
}
