import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BrandMark } from '../../../components/brand-mark/brand-mark';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, BrandMark],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    identificador: ['', Validators.required],
    password: ['', Validators.required]
  });

  iniciarSesion(): void {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    this.authService.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.cargando.set(false);
        this.router.navigateByUrl(this.obtenerRutaInicial(response.usuario.roles));
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo iniciar sesión. Verifica tus credenciales.'
        );
      }
    });
  }

  campoInvalido(nombre: 'identificador' | 'password'): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }

  private obtenerRutaInicial(roles: string[]): string {
    if (roles.includes('ADMIN')) {
      return '/admin';
    }

    if (roles.includes('DOCENTE') || roles.includes('DOCENTE_TUTOR')) {
      return '/docente';
    }

    return '/login';
  }
}
