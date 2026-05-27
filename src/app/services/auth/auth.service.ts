import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environments';
import {
  LoginRequest,
  LoginResponse,
  MensajeRespuesta,
  RecuperacionCambiarPasswordRequest,
  RecuperacionSolicitarRequest,
  RecuperacionTokenRespuesta,
  RecuperacionVerificarRequest,
  UsuarioSesion
} from '../../models/auth';

export interface CambiarPasswordInicialPayload {
  nuevaPassword: string;
  confirmarPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/auth`;
  private readonly tokenKey = 'auth_token';
  private readonly sessionKey = 'auth_user';
  readonly usuarioSesion = signal<UsuarioSesion | null>(this.leerUsuarioLocal());

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/login`, payload)
      .pipe(tap((response) => this.guardarSesion(response)));
  }

  cambiarPasswordInicial(payload: CambiarPasswordInicialPayload): Observable<UsuarioSesion> {
    return this.http
      .post<UsuarioSesion>(`${this.api}/cambiar-password-inicial`, payload)
      .pipe(tap((usuario) => this.actualizarUsuario(usuario)));
  }

  solicitarRecuperacion(payload: RecuperacionSolicitarRequest): Observable<MensajeRespuesta> {
    return this.http.post<MensajeRespuesta>(`${this.api}/recuperacion/solicitar`, payload);
  }

  verificarRecuperacion(payload: RecuperacionVerificarRequest): Observable<RecuperacionTokenRespuesta> {
    return this.http.post<RecuperacionTokenRespuesta>(`${this.api}/recuperacion/verificar`, payload);
  }

  cambiarPasswordRecuperacion(
    payload: RecuperacionCambiarPasswordRequest
  ): Observable<MensajeRespuesta> {
    return this.http.post<MensajeRespuesta>(`${this.api}/recuperacion/cambiar-password`, payload);
  }

  obtenerToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  obtenerUsuario(): UsuarioSesion | null {
    return this.usuarioSesion();
  }

  cerrarSesion(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.sessionKey);
    this.usuarioSesion.set(null);
  }

  actualizarUsuario(usuario: UsuarioSesion): void {
    localStorage.setItem(this.sessionKey, JSON.stringify(usuario));
    this.usuarioSesion.set(usuario);
  }

  private guardarSesion(response: LoginResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    this.actualizarUsuario(response.usuario);
  }

  private leerUsuarioLocal(): UsuarioSesion | null {
    const raw = localStorage.getItem(this.sessionKey);
    return raw ? (JSON.parse(raw) as UsuarioSesion) : null;
  }
}
