import { Component, HostListener, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { DocenteService } from '../../services/academico/docente.service';
import { Docente } from '../../models/docente';
import { ThemeService } from '../../services/ui/theme.service';
import { AlertaAcademicaService } from '../../services/alerta/alerta-academica.service';
import { AlertaAcademica } from '../../models/alerta-academica';

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
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly docenteService = inject(DocenteService);
  private readonly alertaAcademicaService = inject(AlertaAcademicaService);
  readonly themeService = inject(ThemeService);
  private static docenteCache: { usuarioId: number; docente: Docente | null } | null = null;
  private readonly storageKey = 'academic-analytics-sidebar-open';

  readonly collapsed = signal(localStorage.getItem('academic-analytics-sidebar') === 'collapsed');
  readonly expandedSections = signal(this.obtenerSeccionesIniciales());
  readonly userFlyoutOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly notifications = signal<AlertaAcademica[]>([]);
  readonly notificationCount = signal(0);
  private notificationTimer: ReturnType<typeof setInterval> | null = null;
  readonly docenteVinculado = signal<Docente | null>(
    Sidebar.docenteCache?.usuarioId === this.authService.obtenerUsuario()?.usuarioId
      ? Sidebar.docenteCache?.docente ?? null
      : null
  );
  readonly items = input<SidebarItem[]>([]);
  readonly userName = input('Usuario del sistema');
  readonly roleLabel = input('Acceso institucional');

  ngOnInit(): void {
    this.cargarDocenteVinculado();
    this.cargarNotificaciones();
    this.notificationTimer = setInterval(() => this.cargarNotificaciones(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.notificationTimer) clearInterval(this.notificationTimer);
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationsOpen.update((open) => !open);
    if (this.notificationsOpen()) this.cargarNotificaciones();
  }

  abrirAlerta(alerta: AlertaAcademica): void {
    this.notificationsOpen.set(false);
    if (alerta.tipo === 'ASISTENCIA_PENDIENTE') {
      void this.router.navigate(['/asistencias'], {
        queryParams: { asignacionId: alerta.asignacionId, fecha: this.fechaIso(alerta.fechaReferencia), horarioId: alerta.horarioId }
      });
    } else if (alerta.evaluacionId) {
      void this.router.navigate(['/mis-asignaciones', alerta.asignacionId, 'notas'], {
        queryParams: { periodoEvaluacionId: alerta.periodoEvaluacionId, evaluacionId: alerta.evaluacionId }
      });
    }
  }

  verCentroAlertas(): void {
    this.notificationsOpen.set(false);
    void this.router.navigateByUrl('/alertas-academicas');
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

  alternarTema(): void {
    this.themeService.toggleTheme();
  }

  alternarModoDaltonismo(): void {
    this.themeService.toggleColorblind();
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
    this.notificationsOpen.set(false);
  }

  private cargarNotificaciones(): void {
    this.alertaAcademicaService.listar('PENDIENTE').pipe(catchError(() => of([]))).subscribe((alertas) => {
      this.notifications.set(alertas);
      this.notificationCount.set(alertas.length);
    });
  }

  private fechaIso(fecha: string): string {
    if (Array.isArray(fecha)) {
      const [anio, mes, dia] = fecha as unknown as number[];
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
    return String(fecha).slice(0, 10);
  }

  private obtenerSeccionesIniciales(): string[] {
    const secciones = new Set<string>();

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
      ruta.startsWith('/asignaciones-docente') ||
      ruta.startsWith('/horarios')
    ) {
      secciones.add('configuracion-academica');
    }

    if (
      ruta.startsWith('/alumno') ||
      ruta.startsWith('/predicciones') ||
      ruta.startsWith('/hallazgos')
    ) {
      secciones.add('seguimiento');
    }

    if (
      ruta.startsWith('/mis-asignaciones/tutorias') ||
      ruta.startsWith('/seccion-tutorada') ||
      ruta.startsWith('/mis-asignaciones') ||
      ruta.startsWith('/asistencias') ||
      ruta.startsWith('/mi-horario')
    ) {
      secciones.add('academico');
    }

    const guardada = localStorage.getItem(this.storageKey);
    if (guardada !== null) {
      try {
        const parsed = JSON.parse(guardada);
        if (Array.isArray(parsed)) {
          parsed.forEach((val) => {
            if (typeof val === 'string') secciones.add(val);
          });
        }
      } catch {
        if (guardada.trim()) {
          secciones.add(guardada);
        }
      }
    }

    return Array.from(secciones);
  }

  private cargarDocenteVinculado(): void {
    const usuario = this.authService.obtenerUsuario();
    if (!usuario || (!usuario.docenteId && !usuario.usuarioId)) {
      Sidebar.docenteCache = null;
      this.docenteVinculado.set(null);
      return;
    }

    if (Sidebar.docenteCache?.usuarioId === usuario.usuarioId) {
      return;
    }

    this.docenteService
      .listar()
      .pipe(catchError(() => of([])))
      .subscribe((docentes) => {
        if (this.authService.obtenerUsuario()?.usuarioId !== usuario.usuarioId) {
          return;
        }
        const docente =
          docentes.find((item) => usuario.docenteId !== null && item.id === usuario.docenteId) ??
          docentes.find((item) => item.usuarioId !== null && item.usuarioId === usuario.usuarioId) ??
          null;

        Sidebar.docenteCache = { usuarioId: usuario.usuarioId, docente };
        this.docenteVinculado.set(docente);
      });
  }
}
