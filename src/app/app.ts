import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);

  readonly usuario = computed(() => this.authService.usuarioSesion());
  readonly mostrarCambioPassword = computed(
    () => !!this.usuario() && this.usuario()?.debeCambiarPassword === true
  );
  readonly nuevaPassword = signal('');
  readonly confirmarPassword = signal('');
  readonly guardandoPassword = signal(false);
  readonly errorPassword = signal('');

  cambiarPasswordInicial(): void {
    const nuevaPassword = this.nuevaPassword().trim();
    const confirmarPassword = this.confirmarPassword().trim();

    if (nuevaPassword.length < 8) {
      this.errorPassword.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      this.errorPassword.set('La confirmacion de contraseña no coincide.');
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
          error?.error?.mensaje ?? 'No se pudo actualizar la contraseña inicial.'
        );
      }
    });
  }
}
