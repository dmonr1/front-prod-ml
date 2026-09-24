import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth/auth.service';
import { ThemeService } from './services/ui/theme.service';
import { formatearMensajeError } from './utils/error-formatter';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly usuario = computed(() => this.authService.usuarioSesion());
  readonly mostrarCambioPassword = computed(
    () => !!this.usuario() && this.usuario()?.debeCambiarPassword === true
  );
  readonly nuevaPassword = signal('');
  readonly confirmarPassword = signal('');
  readonly guardandoPassword = signal(false);
  readonly errorPassword = signal('');

  requisitosPasswordInicial(): Array<{ texto: string; cumplido: boolean }> {
    const password = this.nuevaPassword();
    return [
      { texto: 'Al menos 8 caracteres', cumplido: password.length >= 8 },
      { texto: 'Una mayúscula', cumplido: /[A-Z]/.test(password) },
      { texto: 'Una minúscula', cumplido: /[a-z]/.test(password) },
      { texto: 'Un número', cumplido: /\d/.test(password) },
      { texto: 'Un carácter especial', cumplido: /[^A-Za-z0-9]/.test(password) }
    ];
  }

  passwordInicialSegura(): boolean {
    return this.requisitosPasswordInicial().every((requisito) => requisito.cumplido);
  }

  mostrarRequisitosPasswordInicial(): boolean {
    return this.nuevaPassword().length > 0 && !this.passwordInicialSegura();
  }

  cambiarPasswordInicial(): void {
    const nuevaPassword = this.nuevaPassword().trim();
    const confirmarPassword = this.confirmarPassword().trim();

    if (!this.passwordInicialSegura()) {
      this.errorPassword.set('Completa todos los requisitos de seguridad para continuar.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      this.errorPassword.set('La confirmación de contraseña no coincide.');
      return;
    }

    this.guardandoPassword.set(true);
    this.errorPassword.set('');

    this.authService.cambiarPasswordInicial({ nuevaPassword, confirmarPassword }).subscribe({
      next: () => {
        this.guardandoPassword.set(false);
        this.nuevaPassword.set('');
        this.confirmarPassword.set('');
      },
      error: (error) => {
        this.guardandoPassword.set(false);
        this.errorPassword.set(
          formatearMensajeError(error, 'No se pudo actualizar la contraseña inicial.')
        );
      }
    });
  }
}
