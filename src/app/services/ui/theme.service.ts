import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly themeStorageKey = 'academic-analytics-theme';
  private readonly colorblindStorageKey = 'academic-analytics-colorblind';

  private readonly theme = signal<AppTheme>(this.leerTemaInicial());
  private readonly colorblind = signal<boolean>(this.leerModoDaltonismoInicial());

  readonly currentTheme = computed(() => this.theme());
  readonly isDark = computed(() => this.theme() === 'dark');
  readonly isColorblind = computed(() => this.colorblind());

  constructor() {
    this.aplicarClases(this.theme(), this.colorblind());
  }

  setTheme(nextTheme: AppTheme): void {
    this.theme.set(nextTheme);
    try {
      localStorage.setItem(this.themeStorageKey, nextTheme);
    } catch {
      // Manejo silencioso en entornos restringidos
    }
    this.aplicarClases(nextTheme, this.colorblind());
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setColorblind(enabled: boolean): void {
    this.colorblind.set(enabled);
    try {
      localStorage.setItem(this.colorblindStorageKey, enabled ? 'true' : 'false');
    } catch {
      // Manejo silencioso
    }
    this.aplicarClases(this.theme(), enabled);
  }

  toggleColorblind(): void {
    this.setColorblind(!this.colorblind());
  }

  private leerTemaInicial(): AppTheme {
    try {
      const stored = localStorage.getItem(this.themeStorageKey);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Fallback a modo claro
    }
    return 'light';
  }

  private leerModoDaltonismoInicial(): boolean {
    try {
      return localStorage.getItem(this.colorblindStorageKey) === 'true';
    } catch {
      return false;
    }
  }

  private aplicarClases(theme: AppTheme, isColorblind: boolean): void {
    const body = this.document.body;
    const esOscuro = theme === 'dark';

    body.classList.toggle('dark-mode', esOscuro);
    body.classList.toggle('theme-dark', esOscuro);
    body.classList.toggle('theme-light', !esOscuro);

    body.classList.toggle('colorblind-mode', isColorblind);
    body.classList.toggle('theme-colorblind', isColorblind);
  }
}
