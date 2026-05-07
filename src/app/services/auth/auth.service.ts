import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environments';
import { LoginRequest, LoginResponse, UsuarioSesion } from '../../models/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/auth`;
  private readonly tokenKey = 'auth_token';
  private readonly sessionKey = 'auth_user';

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/login`, payload)
      .pipe(tap((response) => this.guardarSesion(response)));
  }

  obtenerToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  obtenerUsuario(): UsuarioSesion | null {
    const raw = localStorage.getItem(this.sessionKey);
    return raw ? (JSON.parse(raw) as UsuarioSesion) : null;
  }

  cerrarSesion(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.sessionKey);
  }

  private guardarSesion(response: LoginResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.sessionKey, JSON.stringify(response.usuario));
  }
}
