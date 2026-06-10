import { Component, HostListener, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, of } from 'rxjs';
import { BrandMark } from '../brand-mark/brand-mark';
import { AuthService } from '../../services/auth/auth.service';
import { DocenteService } from '../../services/academico/docente.service';
import { Docente } from '../../models/docente';
import { ThemeService } from '../../services/ui/theme.service';

export interface SidebarChildItem {
  label: string;
  path: string;
  icon: string;
  activePaths?: string[];
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: SidebarChildItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, BrandMark],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly docenteService = inject(DocenteService);
  private readonly themeService = inject(ThemeService);
  private readonly storageKey = 'academic-analytics-sidebar-open';

  readonly collapsed = signal(localStorage.getItem('academic-analytics-sidebar') === 'collapsed');
  readonly expandedSections = signal(this.obtenerSeccionesIniciales());
  readonly userFlyoutOpen = signal(false);
  readonly docenteVinculado = signal<Docente | null>(null);
  readonly isDarkMode = this.themeService.isDark;
  readonly items = input<SidebarItem[]>([]);
  readonly userName = input('Usuario del sistema');
  readonly roleLabel = input('Acceso institucional');

  ngOnInit(): void {
    this.cargarDocenteVinculado();
  }

  toggleCollapsed(): void {
    this.collapsed.update((value) => {
      const next = !value;
      localStorage.setItem('academic-analytics-sidebar', next ? 'collapsed' : 'expanded');
      if (!next) {
        this.userFlyoutOpen.set(false);
      }
      return next;
    });
  }

  toggleUserFlyout(event: MouseEvent): void {
    event.stopPropagation();
    this.userFlyoutOpen.update((value) => !value);
  }

  cerrarUserFlyout(): void {
    this.userFlyoutOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSection(item: SidebarItem): void {
    if (!item.children?.length) {
      if (item.path) {
        void this.router.navigateByUrl(item.path);
      }
      return;
    }

    if (this.collapsed()) {
      return;
    }

    this.expandedSections.update((current) => {
      const next = current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id];
      localStorage.setItem(this.storageKey, JSON.stringify(next));
      return next;
    });
  }

  isExpanded(item: SidebarItem): boolean {
    if (!item.children?.length) {
      return false;
    }

    return this.expandedSections().includes(item.id);
  }

  mantenerSeccionAbierta(event: MouseEvent, itemId: string): void {
    event.stopPropagation();
    this.expandedSections.update((current) => {
      if (current.includes(itemId)) {
        return current;
      }

      const next = [...current, itemId];
      localStorage.setItem(this.storageKey, JSON.stringify(next));
      return next;
    });
  }

  isParentActive(item: SidebarItem): boolean {
    if (item.path && this.isRouteActive(item.path)) {
      return true;
    }

    return item.children?.some((child) => this.isChildActive(child)) ?? false;
  }

  isRouteActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(`${path}/`);
  }

  isChildActive(child: SidebarChildItem): boolean {
    const coincideRutaBase =
      this.router.url === child.path || this.router.url.startsWith(`${child.path}?`);

    if (coincideRutaBase) {
      return true;
    }

    return (child.activePaths ?? []).some((ruta) => this.isRouteActive(ruta));
  }

  cerrarSesion(): void {
    this.userFlyoutOpen.set(false);
    this.authService.cerrarSesion();
    void this.router.navigateByUrl('/login');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.userFlyoutOpen.set(false);
  }

  private obtenerSeccionesIniciales(): string[] {
    const guardada = localStorage.getItem(this.storageKey);
    if (guardada !== null) {
      try {
        const parsed = JSON.parse(guardada);
        if (Array.isArray(parsed)) {
          return parsed.filter((value): value is string => typeof value === 'string');
        }
      } catch {
        if (guardada.trim()) {
          return [guardada];
        }
      }
    }

    const ruta = this.router.url;

    if (
      ruta.startsWith('/configuracion-academica') ||
      ruta.startsWith('/periodos-academicos') ||
      ruta.startsWith('/periodos-evaluacion') ||
      ruta.startsWith('/cursos') ||
      ruta.startsWith('/gestion-estudiantil') ||
      ruta.startsWith('/alumnos') ||
      ruta.startsWith('/matriculas-periodo') ||
      ruta.startsWith('/docentes-accesos') ||
      ruta.startsWith('/asignaciones-tutorias') ||
      ruta.startsWith('/asignaciones-docente')
    ) {
      return ['configuracion-academica'];
    }

    if (
      ruta.startsWith('/mis-asignaciones/tutorias') ||
      ruta.startsWith('/seccion-tutorada') ||
      ruta.startsWith('/alumno') ||
      ruta.startsWith('/predicciones') ||
      ruta.startsWith('/hallazgos')
    ) {
      return ['seguimiento'];
    }

    if (ruta.startsWith('/mis-asignaciones') || ruta.startsWith('/asistencias')) {
      return ['academico'];
    }

    return [];
  }

  private cargarDocenteVinculado(): void {
    const usuario = this.authService.obtenerUsuario();
    if (!usuario || (!usuario.docenteId && !usuario.usuarioId)) {
      this.docenteVinculado.set(null);
      return;
    }

    this.docenteService
      .listar()
      .pipe(catchError(() => of([])))
      .subscribe((docentes) => {
        const docente =
          docentes.find((item) => usuario.docenteId !== null && item.id === usuario.docenteId) ??
          docentes.find((item) => item.usuarioId !== null && item.usuarioId === usuario.usuarioId) ??
          null;

        this.docenteVinculado.set(docente);
      });
  }
}
