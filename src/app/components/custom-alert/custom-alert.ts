import { Component, computed, effect, input, output, signal } from '@angular/core';
import { sanitizarMensajeAlerta } from '../../utils/error-formatter';

export type CustomAlertType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-custom-alert',
  standalone: true,
  templateUrl: './custom-alert.html',
  styleUrl: './custom-alert.scss'
})
export class CustomAlertComponent {
  private static readonly EXIT_MS = 180;

  readonly open = input(false);
  readonly type = input<CustomAlertType>('info');
  readonly title = input('');
  readonly message = input('');
  readonly confirmText = input<string | null>('Entendido');
  readonly cancelText = input<string | null>(null);
  readonly autoCloseMs = input<number | null>(null);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
  readonly dismiss = output<void>();

  private exitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  readonly rendered = signal(false);
  readonly closing = signal(false);

  /**
   * Sanitiza el mensaje antes de mostrarlo, asegurando que cadenas técnicas
   * como "400 BAD_REQUEST", excepciones SQL o errores HTTP crudos sean
   * reemplazados por explicaciones comprensibles para el usuario.
   */
  readonly displayMessage = computed(() => sanitizarMensajeAlerta(this.message()));

  /**
   * Garantiza que siempre exista una acción de confirmación por defecto ('Entendido'),
   * evitando que el pop-up quede sin botón para cerrarlo.
   */
  readonly effectiveConfirmText = computed<string>(() => {
    const custom = this.confirmText();
    if (custom !== undefined && custom !== null && custom.trim() !== '') {
      return custom;
    }
    return 'Entendido';
  });

  constructor() {
    effect(() => {
      const open = this.open();

      this.clearExitTimeout();

      if (open) {
        this.rendered.set(true);
        this.closing.set(false);
      } else if (this.rendered()) {
        this.closing.set(true);
        this.exitTimeoutId = setTimeout(() => {
          this.rendered.set(false);
          this.closing.set(false);
        }, CustomAlertComponent.EXIT_MS);
      }
      // Nota: El temporizador de auto-cierre fue eliminado deliberadamente
      // para que el pop-up nunca desaparezca solo; debe cerrarse mediante 'Entendido' o 'X'.
    });
  }

  iconClass(): string {
    switch (this.type()) {
      case 'success':
        return 'fa-solid fa-circle-check';
      case 'error':
        return 'fa-solid fa-circle-xmark';
      case 'warning':
        return 'fa-solid fa-triangle-exclamation';
      default:
        return 'fa-solid fa-circle-info';
    }
  }

  hasActions(): boolean {
    return Boolean(this.cancelText() || this.effectiveConfirmText());
  }

  onConfirm(): void {
    this.confirm.emit();
    if (!this.cancelText()) {
      this.dismiss.emit();
    }
  }

  onClose(): void {
    this.dismiss.emit();
    if (this.cancelText()) {
      this.cancel.emit();
    }
  }

  private clearExitTimeout(): void {
    if (this.exitTimeoutId) {
      clearTimeout(this.exitTimeoutId);
      this.exitTimeoutId = null;
    }
  }
}
