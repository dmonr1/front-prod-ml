import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const esRutaPublicaDeAutenticacion =
    req.url.includes('/api/auth/login') || req.url.includes('/api/auth/recuperacion/');

  if (esRutaPublicaDeAutenticacion) {
    return next(req);
  }

  const token = authService.obtenerToken();

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};
