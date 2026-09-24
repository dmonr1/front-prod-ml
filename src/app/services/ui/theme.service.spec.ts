import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let documentRef: Document;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
    documentRef = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    localStorage.clear();
    documentRef.body.classList.remove(
      'dark-mode',
      'theme-dark',
      'theme-light',
      'colorblind-mode',
      'theme-colorblind'
    );
  });

  it('debe crearse correctamente con modo claro por defecto', () => {
    expect(service).toBeTruthy();
    expect(service.currentTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(service.isColorblind()).toBe(false);
    expect(documentRef.body.classList.contains('theme-light')).toBe(true);
    expect(documentRef.body.classList.contains('theme-dark')).toBe(false);
  });

  it('debe cambiar a modo oscuro y aplicar clases correspondientes', () => {
    service.setTheme('dark');
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('academic-analytics-theme')).toBe('dark');
    expect(documentRef.body.classList.contains('dark-mode')).toBe(true);
    expect(documentRef.body.classList.contains('theme-dark')).toBe(true);
    expect(documentRef.body.classList.contains('theme-light')).toBe(false);
  });

  it('debe alternar tema con toggleTheme', () => {
    expect(service.currentTheme()).toBe('light');
    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    service.toggleTheme();
    expect(service.currentTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('debe activar y desactivar el modo daltonismo', () => {
    service.setColorblind(true);
    expect(service.isColorblind()).toBe(true);
    expect(localStorage.getItem('academic-analytics-colorblind')).toBe('true');
    expect(documentRef.body.classList.contains('colorblind-mode')).toBe(true);
    expect(documentRef.body.classList.contains('theme-colorblind')).toBe(true);

    service.toggleColorblind();
    expect(service.isColorblind()).toBe(false);
    expect(localStorage.getItem('academic-analytics-colorblind')).toBe('false');
    expect(documentRef.body.classList.contains('colorblind-mode')).toBe(false);
    expect(documentRef.body.classList.contains('theme-colorblind')).toBe(false);
  });

  it('debe mantener simultáneamente modo oscuro y daltonismo si ambos están activos', () => {
    service.setTheme('dark');
    service.setColorblind(true);

    expect(documentRef.body.classList.contains('theme-dark')).toBe(true);
    expect(documentRef.body.classList.contains('theme-colorblind')).toBe(true);
    expect(service.isDark()).toBe(true);
    expect(service.isColorblind()).toBe(true);
  });
});
