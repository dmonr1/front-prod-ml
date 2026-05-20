import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { UsuarioGestion } from '../../models/usuario-gestion';

export interface UsuarioActualizacionPayload {
  username: string;
  correo: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/usuarios`;

  listar(): Observable<UsuarioGestion[]> {
    return this.http.get<UsuarioGestion[]>(this.api);
  }

  actualizar(usuarioId: number, payload: UsuarioActualizacionPayload): Observable<UsuarioGestion> {
    return this.http.put<UsuarioGestion>(`${this.api}/${usuarioId}`, payload);
  }

  actualizarEstado(usuarioId: number, activo: boolean): Observable<UsuarioGestion> {
    return this.http.patch<UsuarioGestion>(`${this.api}/${usuarioId}/estado`, null, {
      params: { activo }
    });
  }
}
