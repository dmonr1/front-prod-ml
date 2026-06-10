import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

export const authGuard: CanActivateChildFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.obtenerToken() ? true : router.createUrlTree(['/login']);
};
