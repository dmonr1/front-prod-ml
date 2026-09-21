import { Component, computed, inject, input, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { Sidebar, SidebarItem } from '../../components/sidebar/sidebar';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { AuthService } from '../../services/auth/auth.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import { UsuarioSesion } from '../../models/auth';

@Component({
  selector: 'app-shell',
  imports: [Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly items = input<SidebarItem[]>([]);
  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly tieneAsignacionesActivas = signal(false);
  readonly tieneTutoriasActivas = signal(false);
  readonly menuItems = computed(() => {
    const customItems = this.items();
    if (customItems.length) {
      return customItems;
    }

    return this.construirMenu(this.usuario());
  });
  readonly nombreUsuario = computed(() => this.usuario()?.username ?? 'Usuario del sistema');
  readonly rolUsuario = computed(() => this.obtenerEtiquetaRol(this.usuario()));

  constructor() {
    this.cargarContextoAcademico();
  }

  private construirMenu(usuario: UsuarioSesion | null): SidebarItem[] {
    const roles = usuario?.roles ?? [];
    const esAdmin = roles.includes('ADMIN');
    const esDocente = roles.includes('DOCENTE');
    const esTutor = roles.includes('DOCENTE_TUTOR') || usuario?.esTutor;
    const dashboardPath = esAdmin ? '/admin' : '/docente';

    const items: SidebarItem[] = [
      { id: 'inicio', label: 'Dashboard', path: dashboardPath, icon: 'fa-solid fa-house' }
    ];

    if (esAdmin) {
      items.push({
        id: 'configuracion-academica',
        label: 'Configuracion academica',
        icon: 'fa-solid fa-sliders',
        children: [
          { label: 'Gestion estudiantil', path: '/gestion-estudiantil', icon: 'fa-solid fa-user-graduate' },
          { label: 'Cursos', path: '/cursos', icon: 'fa-solid fa-book-open-reader' },
          { label: 'Docentes y accesos', path: '/docentes-accesos', icon: 'fa-solid fa-user-gear' },
          { label: 'Asignaciones docentes', path: '/asignaciones-docente', icon: 'fa-solid fa-chalkboard-user' }
        ]
      });
    }

    if (esDocente && this.tieneAsignacionesActivas()) {
      items.push({
        id: 'academico',
        label: 'Gestion academica',
        icon: 'fa-solid fa-graduation-cap',
        children: [
          { label: 'Mis asignaciones', path: '/mis-asignaciones', icon: 'fa-solid fa-chalkboard-user' },
          { label: 'Asistencias', path: '/asistencias', icon: 'fa-solid fa-user-check' }
        ]
      });
    }

    if (
      esAdmin ||
      (esTutor && this.tieneTutoriasActivas()) ||
      (esDocente && this.tieneAsignacionesActivas())
    ) {
      items.push({
        id: 'seguimiento',
        label: 'Seguimiento',
        icon: 'fa-solid fa-shield-heart',
        children: [
          ...(esTutor && this.tieneTutoriasActivas()
            ? [{
                label: 'Seccion tutorada',
                path: '/seccion-tutorada',
                icon: 'fa-solid fa-users',
                activePaths: ['/mis-asignaciones/tutorias']
              }]
            : []),
          {
            label: 'Seguimiento de riesgo',
            path: '/predicciones',
            icon: 'fa-solid fa-wave-square'
          },
          {
            label: 'Hallazgos y recomendaciones',
            path: '/hallazgos',
            icon: 'fa-solid fa-lightbulb'
          }
        ]
      });
    }

    return items;
  }

  private cargarContextoAcademico(): void {
    const usuario = this.authService.obtenerUsuario();
    const docenteId = usuario?.docenteId;
    const roles = usuario?.roles ?? [];
    const puedeTenerAsignaciones = Boolean(docenteId && roles.includes('DOCENTE'));
    const puedeTenerTutorias = Boolean(
      docenteId && (roles.includes('DOCENTE_TUTOR') || usuario?.esTutor)
    );

    if (!docenteId || (!puedeTenerAsignaciones && !puedeTenerTutorias)) {
      return;
    }

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual = this.resolverPeriodoActual(periodos);

        if (!periodoActual) {
          return;
        }

        forkJoin({
          asignaciones: puedeTenerAsignaciones
            ? this.asignacionAcademicaService.listarAsignaciones(docenteId, periodoActual.id)
            : of([]),
          tutorias: puedeTenerTutorias
            ? this.tutoriaService.listarPorDocente(docenteId, periodoActual.id)
            : of([])
        }).subscribe({
          next: ({ asignaciones, tutorias }) => {
            this.tieneAsignacionesActivas.set(
              asignaciones.some((asignacion) => (asignacion.estado ?? 'ACTIVO') === 'ACTIVO')
            );
            this.tieneTutoriasActivas.set(
              tutorias.some((tutoria) => (tutoria.estado ?? 'ACTIVO') === 'ACTIVO')
            );
          },
          error: () => this.limpiarContextoAcademico()
        });
      },
      error: () => this.limpiarContextoAcademico()
    });
  }

  private resolverPeriodoActual(periodos: PeriodoAcademico[]): PeriodoAcademico | null {
    const activo = periodos.find((periodo) => (periodo.estado ?? '').toUpperCase() === 'ACTIVO');
    if (activo) {
      return activo;
    }

    const anioActual = new Date().getFullYear();
    return periodos.find((periodo) => periodo.anio === anioActual) ?? null;
  }

  private limpiarContextoAcademico(): void {
    this.tieneAsignacionesActivas.set(false);
    this.tieneTutoriasActivas.set(false);
  }

  private obtenerEtiquetaRol(usuario: UsuarioSesion | null): string {
    if (!usuario?.roles?.length) {
      return 'Acceso institucional';
    }

    const etiquetas: string[] = [];

    if (usuario.roles.includes('ADMIN')) {
      etiquetas.push('Administrador');
    }
    if (usuario.roles.includes('DOCENTE')) {
      etiquetas.push('Docente');
    }
    if (usuario.roles.includes('DOCENTE_TUTOR') || usuario.esTutor) {
      etiquetas.push('Tutor');
    }

    return etiquetas.join(' / ');
  }
}
