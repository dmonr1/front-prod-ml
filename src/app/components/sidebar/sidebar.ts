import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BrandMark } from '../brand-mark/brand-mark';
import { AuthService } from '../../services/auth/auth.service';

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
export class Sidebar {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly storageKey = 'academic-analytics-sidebar-open';

  readonly collapsed = signal(localStorage.getItem('academic-analytics-sidebar') === 'collapsed');
  readonly expandedSections = signal(this.obtenerSeccionesIniciales());
  readonly items = input<SidebarItem[]>([]);
  readonly userName = input('Usuario del sistema');
  readonly roleLabel = input('Acceso institucional');

  toggleCollapsed(): void {
    this.collapsed.update((value) => {
      const next = !value;
      localStorage.setItem('academic-analytics-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }

  toggleSection(item: SidebarItem): void {
    if (!item.children?.length) {
      if (item.path) {
        void this.router.navigateByUrl(item.path);
      }
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
    this.authService.cerrarSesion();
    void this.router.navigateByUrl('/login');
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
      ruta.startsWith('/estructura-academica') ||
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
}
