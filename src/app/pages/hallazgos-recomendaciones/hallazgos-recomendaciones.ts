import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { UsuarioSesion } from '../../models/auth';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { Seccion } from '../../models/seccion';
import {
  AlertaSeguimientoService,
  RecomendacionSeguimiento
} from '../../services/alerta/alerta-seguimiento.service';
import {
  HallazgoDataMining,
  HallazgoDataMiningService
} from '../../services/alerta/hallazgo-data-mining.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AuthService } from '../../services/auth/auth.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';

@Component({
  selector: 'app-reportes',
  imports: [Shell, CustomAlertComponent],
  templateUrl: './hallazgos-recomendaciones.html',
  styleUrl: './hallazgos-recomendaciones.scss'
})
export class HallazgosRecomendaciones {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly seccionService = inject(SeccionService);
  private readonly tutoriaService = inject(TutoriaService);
  private readonly hallazgoService = inject(HallazgoDataMiningService);
  private readonly alertaSeguimientoService = inject(AlertaSeguimientoService);
  private readonly currentYear = new Date().getFullYear();

  readonly cargandoFiltros = signal(true);
  readonly cargandoVista = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarError = signal(true);

  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly seccionSeleccionadaId = signal<number | null>(null);
  readonly mostrarSelectorPeriodo = signal(false);
  readonly mostrarSelectorSeccion = signal(false);

  readonly hallazgos = signal<HallazgoDataMining[]>([]);
  readonly recomendaciones = signal<RecomendacionSeguimiento[]>([]);
  readonly usuario = signal<UsuarioSesion | null>(this.authService.obtenerUsuario());
  readonly recomendacionesDerivadas = computed(() =>
    this.hallazgos().map((hallazgo, index) => ({
      id: -(index + 1),
      matriculaId: 0,
      alumnoId: 0,
      codigoAlumno: 'SECCION',
      alumnoNombreCompleto: 'Recomendacion para la seccion tutorada',
      cursoId: hallazgo.cursoId,
      curso: hallazgo.curso,
      titulo: this.tituloRecomendacionHallazgo(hallazgo),
      descripcion: this.descripcionRecomendacionHallazgo(hallazgo),
      fuente: 'DATA_MINING',
      fechaRegistro: hallazgo.fechaGeneracion
    }))
  );
  readonly recomendacionesPriorizadas = computed(() =>
    [...this.recomendaciones()].sort((a, b) => {
      const prioridadA = this.obtenerPrioridadRecomendacion(a);
      const prioridadB = this.obtenerPrioridadRecomendacion(b);

      if (prioridadA !== prioridadB) {
        return prioridadB - prioridadA;
      }

      return (b.fechaRegistro ?? '').localeCompare(a.fechaRegistro ?? '');
    })
  );
  readonly mostrarSkeleton = computed(
    () => this.cargandoFiltros() || this.cargandoVista() || !!this.error()
  );

  constructor() {
    this.cargarFiltros();
  }

  reintentarCarga(): void {
    this.mostrarError.set(false);
    this.error.set(null);

    if (!this.periodosEvaluacion().length || !this.secciones().length) {
      this.cargarFiltros();
      return;
    }

    this.cargarVista();
  }

  cerrarError(): void {
    this.mostrarError.set(false);
  }

  readonly seccionSeleccionada = computed(
    () => this.secciones().find((seccion) => seccion.id === this.seccionSeleccionadaId()) ?? null
  );

  readonly periodoSeleccionado = computed(
    () => this.periodosDisponibles().find((periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()) ?? null
  );

  readonly periodosDisponibles = computed(() => {
    const seccion = this.seccionSeleccionada();
    const periodos = this.periodosEvaluacion();

    if (!seccion?.periodoAcademicoId) {
      return periodos;
    }

    return periodos
      .filter((periodo) => periodo.periodoAcademicoId === seccion.periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero);
  });

  readonly metricas = computed(() => {
    const hallazgos = this.hallazgos();
    const recomendacionesRegistradas = this.recomendaciones();
    const altas = hallazgos.filter((item) => item.nivelRelevancia === 'ALTO').length;
    const cursos = new Set(hallazgos.map((item) => item.curso).filter(Boolean));
    const tipos = new Set(hallazgos.map((item) => item.tipo).filter(Boolean));

    return [
      {
        label: 'Hallazgos criticos',
        value: altas,
        detail: 'Casos con mayor relevancia.',
        icon: 'fa-solid fa-triangle-exclamation'
      },
      {
        label: 'Tipos detectados',
        value: tipos.size,
        detail: 'Categorias de patrones encontradas.',
        icon: 'fa-solid fa-layer-group'
      },
      {
        label: 'Recomendaciones registradas',
        value: recomendacionesRegistradas.length,
        detail: recomendacionesRegistradas.length
          ? 'Acciones guardadas en el sistema.'
          : 'No llegaron recomendaciones persistidas.',
        icon: 'fa-solid fa-clipboard-check'
      },
      {
        label: 'Cursos involucrados',
        value: cursos.size,
        detail: 'Cursos mencionados en los hallazgos.',
        icon: 'fa-solid fa-book-open-reader'
      }
    ];
  });

  onPeriodoChange(value: string): void {
    this.periodoEvaluacionSeleccionadoId.set(value ? Number(value) : null);
    this.mostrarSelectorPeriodo.set(false);
    this.cargarVista();
  }

  onSeccionChange(value: string): void {
    this.seccionSeleccionadaId.set(value ? Number(value) : null);
    this.mostrarSelectorSeccion.set(false);
    this.ajustarPeriodo();
    this.cargarVista();
  }

  toggleSelectorPeriodo(): void {
    this.mostrarSelectorPeriodo.update((valor) => !valor);
    if (this.mostrarSelectorPeriodo()) {
      this.mostrarSelectorSeccion.set(false);
    }
  }

  toggleSelectorSeccion(): void {
    this.mostrarSelectorSeccion.update((valor) => !valor);
    if (this.mostrarSelectorSeccion()) {
      this.mostrarSelectorPeriodo.set(false);
    }
  }

  cerrarSelectores(): void {
    this.mostrarSelectorPeriodo.set(false);
    this.mostrarSelectorSeccion.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.mostrarSelectorPeriodo() && !this.mostrarSelectorSeccion()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.cerrarSelectores();
  }

  formatearResultado(raw: string | null): string[] {
    if (!raw) {
      return [];
    }

    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .slice(0, 4)
        .map(([key, value]) => `${this.humanizarKey(key)}: ${Array.isArray(value) ? value.length : value}`);
    } catch {
      return [];
    }
  }

  etiquetaSeccion(seccion: Seccion): string {
    return `${seccion.gradoNombre ?? ''} · Seccion ${seccion.nombre}`.trim();
  }

  private cargarFiltros(): void {
    this.cargandoFiltros.set(true);
    this.error.set(null);
    this.mostrarError.set(false);

    forkJoin({
      periodosAcademicos: this.periodoAcademicoService.listar(),
      periodos: this.periodoEvaluacionService.listar(),
      secciones: this.seccionService.listar()
    }).subscribe({
      next: ({ periodosAcademicos, periodos, secciones }) => {
        const seccionesActivas = secciones
          .filter((seccion) => seccion.estado !== 'INACTIVO')
          .sort((a, b) => {
            const anio = (b.anioAcademico ?? 0) - (a.anioAcademico ?? 0);
            if (anio !== 0) {
              return anio;
            }

            const grado = (a.gradoNombre ?? '').localeCompare(b.gradoNombre ?? '');
            if (grado !== 0) {
              return grado;
            }

            return (a.nombre ?? '').localeCompare(b.nombre ?? '');
          });
        const periodosActivos = periodos
          .filter((periodo) => periodo.estado !== 'INACTIVO')
          .sort((a, b) => (b.anioAcademico ?? 0) - (a.anioAcademico ?? 0) || a.numero - b.numero);

        const usuario = this.usuario();
        const esAdmin = usuario?.roles.includes('ADMIN') ?? false;

        if (esAdmin) {
          this.periodosEvaluacion.set(periodosActivos);
          this.secciones.set(seccionesActivas);
          this.seccionSeleccionadaId.set(this.obtenerSeccionInicial(seccionesActivas)?.id ?? null);
          this.ajustarPeriodo();
          this.cargandoFiltros.set(false);
          this.cargarVista();
          return;
        }

        const periodoReferencia = this.obtenerPeriodoAcademicoReferencia(periodosAcademicos);
        const docenteId = usuario?.docenteId;

        if (!docenteId || !periodoReferencia) {
          this.periodosEvaluacion.set(periodosActivos);
          this.secciones.set([]);
          this.seccionSeleccionadaId.set(null);
          this.cargandoFiltros.set(false);
          return;
        }

        this.tutoriaService.listarPorDocente(docenteId, periodoReferencia.id).subscribe({
          next: (tutorias) => {
            const tutoriasActivas = tutorias.filter(
              (tutoria) => (tutoria.estado ?? 'ACTIVO') === 'ACTIVO'
            );
            const seccionesTutor = seccionesActivas.filter((seccion) =>
              tutoriasActivas.some((tutoria) => tutoria.seccionId === seccion.id)
            );

            this.periodosEvaluacion.set(periodosActivos);
            this.secciones.set(seccionesTutor);
            this.seccionSeleccionadaId.set(this.obtenerSeccionInicial(seccionesTutor)?.id ?? null);
            this.ajustarPeriodo();
            this.cargandoFiltros.set(false);
            this.cargarVista();
          },
          error: () => {
            this.periodosEvaluacion.set(periodosActivos);
            this.secciones.set([]);
            this.seccionSeleccionadaId.set(null);
            this.cargandoFiltros.set(true);
            this.error.set('No se pudieron cargar las secciones a cargo del docente.');
            this.mostrarError.set(true);
          }
        });
      },
      error: () => {
        this.cargandoFiltros.set(true);
        this.error.set('No se pudieron cargar los filtros de hallazgos.');
        this.mostrarError.set(true);
      }
    });
  }

  private cargarVista(): void {
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    const seccionId = this.seccionSeleccionadaId();

    if (!periodoEvaluacionId || !seccionId) {
      this.hallazgos.set([]);
      this.recomendaciones.set([]);
      return;
    }

    this.cargandoVista.set(true);
    this.error.set(null);
    this.mostrarError.set(false);

    forkJoin({
      hallazgos: this.hallazgoService.listar(periodoEvaluacionId, seccionId),
      recomendaciones: this.alertaSeguimientoService.listarRecomendaciones(periodoEvaluacionId, seccionId)
    }).subscribe({
      next: ({ hallazgos, recomendaciones }) => {
        this.hallazgos.set(hallazgos);
        this.recomendaciones.set(recomendaciones);
        this.cargandoVista.set(false);
      },
      error: () => {
        this.hallazgos.set([]);
        this.recomendaciones.set([]);
        this.cargandoVista.set(true);
        this.error.set('No se pudieron cargar los hallazgos y recomendaciones.');
        this.mostrarError.set(true);
      }
    });
  }

  private ajustarPeriodo(): void {
    const periodoActual = this.periodoEvaluacionSeleccionadoId();
    const disponibles = this.periodosDisponibles();
    const existe = disponibles.some((periodo) => periodo.id === periodoActual);

    if (!existe) {
      this.periodoEvaluacionSeleccionadoId.set(disponibles[0]?.id ?? null);
    }
  }

  private obtenerSeccionInicial(secciones: Seccion[]): Seccion | null {
    return (
      secciones.find((seccion) => seccion.anioAcademico === this.currentYear) ??
      secciones[0] ??
      null
    );
  }

  private obtenerPeriodoAcademicoReferencia(periodos: PeriodoAcademico[]): PeriodoAcademico | null {
    const activos = periodos
      .filter((periodo) => periodo.estado !== 'INACTIVO')
      .sort((a, b) => b.anio - a.anio);

    return activos.find((periodo) => periodo.anio === this.currentYear) ?? activos[0] ?? null;
  }

  private humanizarKey(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }

  private tituloRecomendacionHallazgo(hallazgo: HallazgoDataMining): string {
    switch (hallazgo.codigo) {
      case 'CURSO_CRITICO':
        return hallazgo.curso
          ? `Refuerzo focalizado en ${hallazgo.curso}`
          : 'Refuerzo focalizado por curso';
      case 'ASISTENCIA_CRITICA':
        return 'Seguimiento de asistencia';
      case 'FACTOR_PREDOMINANTE':
        return 'Intervencion sobre factor predominante';
      case 'MULTIPLES_ALERTAS':
        return 'Plan de seguimiento prioritario';
      default:
        return 'Accion sugerida para la seccion';
    }
  }

  private descripcionRecomendacionHallazgo(hallazgo: HallazgoDataMining): string {
    switch (hallazgo.codigo) {
      case 'CURSO_CRITICO':
        return 'Coordinar refuerzo academico y revisar evaluaciones recientes del curso con mayor criticidad.';
      case 'ASISTENCIA_CRITICA':
        return 'Revisar inasistencias, contactar a las familias y establecer monitoreo tutorial del periodo.';
      case 'FACTOR_PREDOMINANTE':
        return 'Priorizar acciones segun el factor de riesgo detectado con mayor frecuencia en la seccion.';
      case 'MULTIPLES_ALERTAS':
        return 'Dar seguimiento inmediato a los alumnos que acumulan varias alertas activas y registrar acuerdos.';
      default:
        return hallazgo.descripcion;
    }
  }

  obtenerIconoHallazgo(codigo: string | null | undefined): string {
    switch (codigo) {
      case 'CURSO_CRITICO':
        return 'fa-solid fa-book-open';
      case 'ASISTENCIA_CRITICA':
        return 'fa-solid fa-user-check';
      case 'FACTOR_PREDOMINANTE':
        return 'fa-solid fa-chart-line';
      case 'MULTIPLES_ALERTAS':
        return 'fa-solid fa-bell';
      case 'RIESGO_GLOBAL_SECCION':
        return 'fa-solid fa-users-viewfinder';
      case 'CURSOS_RECURRENTES':
        return 'fa-solid fa-arrows-rotate';
      case 'BAJO_RENDIMIENTO_GENERAL':
        return 'fa-solid fa-arrow-trend-down';
      case 'PREDICCION_INESTABLE':
        return 'fa-solid fa-circle-info';
      default:
        return 'fa-solid fa-lightbulb';
    }
  }

  obtenerPrioridadRecomendacion(recomendacion: RecomendacionSeguimiento): number {
    const titulo = (recomendacion.titulo ?? '').toLowerCase();
    const descripcion = (recomendacion.descripcion ?? '').toLowerCase();

    if (titulo.includes('riesgo academico global') || descripcion.includes('acompanamiento')) {
      return 3;
    }

    if (titulo.includes('refuerzo') || descripcion.includes('seguimiento')) {
      return 2;
    }

    return 1;
  }

  obtenerEtiquetaPrioridad(recomendacion: RecomendacionSeguimiento): string {
    const prioridad = this.obtenerPrioridadRecomendacion(recomendacion);
    if (prioridad >= 3) {
      return 'Prioritaria';
    }
    if (prioridad === 2) {
      return 'Seguimiento';
    }
    return 'Apoyo';
  }
}
