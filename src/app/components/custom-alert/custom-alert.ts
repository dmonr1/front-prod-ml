import { Component, effect, input, output, signal } from '@angular/core';

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
  readonly confirmText = input<string | null>('Aceptar');
  readonly cancelText = input<string | null>(null);
  readonly autoCloseMs = input<number | null>(null);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
  readonly dismiss = output<void>();

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private exitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  readonly rendered = signal(false);
  readonly closing = signal(false);

  constructor() {
    effect(() => {
      const open = this.open();
      const autoCloseMs = this.autoCloseMs();

      this.clearTimeout();
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

      if (open && autoCloseMs && autoCloseMs > 0) {
        this.timeoutId = setTimeout(() => {
          this.dismiss.emit();
        }, autoCloseMs);
      }
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
    return Boolean(this.cancelText() || this.confirmText());
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private clearExitTimeout(): void {
    if (this.exitTimeoutId) {
      clearTimeout(this.exitTimeoutId);
      this.exitTimeoutId = null;
    }
  }
}
