import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'academic-analytics-theme';
  private readonly theme = signal<AppTheme>(this.leerTemaInicial());

  readonly currentTheme = computed(() => this.theme());
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.aplicarTema(this.theme());
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    localStorage.setItem(this.storageKey, nextTheme);
    this.aplicarTema(nextTheme);
  }

  private leerTemaInicial(): AppTheme {
    const stored = localStorage.getItem(this.storageKey);
    return stored === 'dark' ? 'dark' : 'light';
  }

  private aplicarTema(theme: AppTheme): void {
    this.document.body.classList.toggle('dark-mode', theme === 'dark');
  }
}
