import { Component, computed, inject, input, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { Sidebar, SidebarChildItem, SidebarItem } from '../../components/sidebar/sidebar';
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
  private static readonly contextoCache = {
    asignacionesActivas: true,
    tutoriasActivas: true,
    cargado: false
  };

  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly items = input<SidebarItem[]>([]);
  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly tieneAsignacionesActivas = signal(
    Shell.contextoCache.cargado
      ? Shell.contextoCache.asignacionesActivas
      : (this.authService.obtenerUsuario()?.roles.includes('DOCENTE') ?? false)
  );
  readonly tieneTutoriasActivas = signal(
    Shell.contextoCache.cargado
      ? Shell.contextoCache.tutoriasActivas
      : (this.authService.obtenerUsuario()?.esTutor ?? false)
  );
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
    const esAdmin = roles.includes('ADMIN') || roles.includes('DIRECTOR_ACADEMICO');
    const esDocente = roles.includes('DOCENTE');
    const esTutor = roles.includes('DOCENTE_TUTOR') || usuario?.esTutor;
    const dashboardPath = esAdmin ? '/admin' : '/docente';

    const items: SidebarItem[] = [
      { id: 'inicio', label: 'Panel principal', path: dashboardPath, icon: 'fa-solid fa-house' }
    ];

    if (esAdmin) {
      items.push({
        id: 'configuracion-academica',
        label: 'Configuración académica',
        icon: 'fa-solid fa-sliders',
        children: [
          { label: 'Estudiantes y matrículas', path: '/gestion-estudiantil', icon: 'fa-solid fa-user-graduate' },
          { label: 'Catálogo de cursos', path: '/cursos', icon: 'fa-solid fa-book-open-reader' },
          { label: 'Docentes y accesos', path: '/docentes-accesos', icon: 'fa-solid fa-user-gear' },
          { label: 'Asignaciones y tutorías', path: '/asignaciones-docente', icon: 'fa-solid fa-chalkboard-user' },
          { label: 'Horarios y programación', path: '/horarios', icon: 'fa-regular fa-calendar-days' }
        ]
      });
    }

    const tieneAsig = this.tieneAsignacionesActivas();
    const tieneTut = this.tieneTutoriasActivas();

    if ((esDocente && tieneAsig) || (esTutor && tieneTut) || esAdmin) {
      const hijosAcademicos: SidebarChildItem[] = [];

      if ((esDocente && tieneAsig) || esAdmin) {
        hijosAcademicos.push(
          { label: 'Mi horario', path: '/mi-horario', icon: 'fa-regular fa-calendar-days' },
          { label: 'Mis cursos y notas', path: '/mis-asignaciones', icon: 'fa-solid fa-chalkboard-user' },
          { label: 'Asistencias', path: '/asistencias', icon: 'fa-solid fa-user-check' }
        );
      }

      if ((esTutor && tieneTut) || esAdmin) {
        hijosAcademicos.push({
          label: 'Mi sección tutorada',
          path: '/seccion-tutorada',
          icon: 'fa-solid fa-users',
          activePaths: ['/mis-asignaciones/tutorias']
        });
      }

      if (hijosAcademicos.length > 0) {
        items.push({
          id: 'academico',
          label: 'Gestión académica',
          icon: 'fa-solid fa-graduation-cap',
          children: hijosAcademicos
        });
      }
    }

    if (esAdmin || (esDocente && tieneAsig)) {
      items.push({
        id: 'seguimiento',
        label: 'Seguimiento académico',
        icon: 'fa-solid fa-shield-heart',
        children: [
          {
            label: 'Predicción de riesgo',
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
            const tieneAsig = asignaciones.some((asignacion) => (asignacion.estado ?? 'ACTIVO') === 'ACTIVO');
            const tieneTut = tutorias.some((tutoria) => (tutoria.estado ?? 'ACTIVO') === 'ACTIVO');

            Shell.contextoCache.asignacionesActivas = tieneAsig;
            Shell.contextoCache.tutoriasActivas = tieneTut;
            Shell.contextoCache.cargado = true;

            this.tieneAsignacionesActivas.set(tieneAsig);
            this.tieneTutoriasActivas.set(tieneTut);
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
    Shell.contextoCache.asignacionesActivas = false;
    Shell.contextoCache.tutoriasActivas = false;
    Shell.contextoCache.cargado = false;
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
    if (usuario.roles.includes('DIRECTOR_ACADEMICO')) {
      etiquetas.push('Director académico');
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
