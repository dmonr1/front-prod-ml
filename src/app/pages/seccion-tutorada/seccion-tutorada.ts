import { Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { Tutoria } from '../../models/tutoria';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { AuthService } from '../../services/auth/auth.service';
import { CustomAlertComponent } from '../../components/custom-alert/custom-alert';
import {
  AlumnoTutoriaResumen,
  CursoAlumnoTutoriaResumen,
  TutoriaResumenAcademico,
  TutoriaService
} from '../../services/asignaciones/tutoria.service';
import { formatearMensajeError } from '../../utils/error-formatter';

export type ModoVistaTutoria = 'matriz' | 'fichas';
export type FiltroRiesgoTutoria = 'todos' | 'riesgo' | 'desaprobados' | 'asistencia';

@Component({
  selector: 'app-seccion-tutorada',
  standalone: true,
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './seccion-tutorada.html',
  styleUrl: './seccion-tutorada.scss'
})
export class SeccionTutorada implements OnInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly tutoriaIdRuta = Number(this.route.snapshot.paramMap.get('tutoriaId'));
  readonly currentYear = new Date().getFullYear();
  readonly cargando = signal(true);
  readonly cargandoTabla = signal(false);
  readonly mantenerSkeletonPorError = signal(false);
  readonly error = signal<string | null>(null);
  readonly tutoria = signal<Tutoria | null>(null);
  readonly tutoriasDisponibles = signal<Tutoria[]>([]);
  readonly tutoriaIdActiva = signal<number | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly resumenAcademico = signal<TutoriaResumenAcademico | null>(null);
  readonly mostrarSelectorTutoria = signal(false);
  readonly animacionCambio = signal<'left' | 'right' | null>(null);
  readonly animacionEntradaActiva = signal(true);
  private direccionAnimacionPendiente: 'left' | 'right' | null = null;

  // Modos de visualización y filtros 360°
  readonly modoVista = signal<ModoVistaTutoria>('matriz');
  readonly busqueda = signal<string>('');
  readonly filtroRiesgo = signal<FiltroRiesgoTutoria>('todos');
  readonly alumnoSeleccionado = signal<AlumnoTutoriaResumen | null>(null);

  readonly mostrarError = signal(true);
  readonly mostrarSkeleton = computed(() => this.cargando() || this.mantenerSkeletonPorError());

  readonly periodosEvaluacionTutoria = computed(() =>
    this.periodosEvaluacion()
      .filter((periodo) => periodo.periodoAcademicoId === this.tutoria()?.periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero)
  );

  readonly indicePeriodoEvaluacionSeleccionado = computed(() =>
    this.periodosEvaluacionTutoria().findIndex(
      (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
    )
  );

  readonly periodoEvaluacionSeleccionado = computed(
    () =>
      this.periodosEvaluacionTutoria().find(
        (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
      ) ?? null
  );

  // KPIs institucionales del aula
  readonly kpisAula = computed(() => {
    const resumen = this.resumenAcademico();
    const alumnos = resumen?.alumnos ?? [];
    const totalAlumnos = alumnos.length;

    const promedios = alumnos
      .map((a) => a.promedioGeneral)
      .filter((p): p is number => p !== null && !isNaN(p));

    const promedioAula = promedios.length
      ? Math.round((promedios.reduce((acc, p) => acc + p, 0) / promedios.length) * 100) / 100
      : null;

    const asistencias = alumnos
      .map((a) => a.porcentajeAsistencia)
      .filter((pct): pct is number => pct !== null && !isNaN(pct));

    const asistenciaAula = asistencias.length
      ? Math.round((asistencias.reduce((acc, pct) => acc + pct, 0) / asistencias.length) * 10) / 10
      : null;

    const alumnosEnRiesgo = alumnos.filter((a) => this.esAlumnoEnRiesgo(a)).length;
    const alumnosAprobados = alumnos.filter((a) => this.contarCursosDesaprobados(a) === 0 && (a.promedioGeneral ?? 0) >= 11).length;

    return {
      totalAlumnos,
      promedioAula,
      asistenciaAula,
      alumnosEnRiesgo,
      alumnosAprobados,
      totalCursos: resumen?.cursos?.length ?? 0
    };
  });

  // Lista de alumnos con búsqueda y filtros reactivos
  readonly alumnosFiltrados = computed(() => {
    const resumen = this.resumenAcademico();
    if (!resumen) return [];

    let lista = [...resumen.alumnos];
    const query = this.busqueda().trim().toLowerCase();

    if (query) {
      lista = lista.filter((a) =>
        a.alumnoNombreCompleto.toLowerCase().includes(query) ||
        a.codigoAlumno.toLowerCase().includes(query)
      );
    }

    const filtro = this.filtroRiesgo();
    if (filtro === 'riesgo') {
      lista = lista.filter((a) => this.esAlumnoEnRiesgo(a));
    } else if (filtro === 'desaprobados') {
      lista = lista.filter((a) => this.contarCursosDesaprobados(a) > 0);
    } else if (filtro === 'asistencia') {
      lista = lista.filter((a) => (a.porcentajeAsistencia ?? 100) < 80);
    }

    return lista;
  });

  // Promedio de cada curso a nivel de toda la sección tutorada
  readonly promediosPorCurso = computed(() => {
    const resumen = this.resumenAcademico();
    if (!resumen || !resumen.cursos?.length) return new Map<number, number | null>();

    const mapa = new Map<number, number | null>();
    for (const curso of resumen.cursos) {
      const notas = resumen.alumnos
        .map((a) => a.cursos.find((c) => c.asignacionId === curso.asignacionId)?.promedio)
        .filter((p): p is number => p !== null && p !== undefined && !isNaN(p));

      if (notas.length) {
        const avg = Math.round((notas.reduce((acc, val) => acc + val, 0) / notas.length) * 100) / 100;
        mapa.set(curso.asignacionId, avg);
      } else {
        mapa.set(curso.asignacionId, null);
      }
    }
    return mapa;
  });

  ngOnInit(): void {
    this.cargarVista();
    setTimeout(() => this.animacionEntradaActiva.set(false), 700);
  }

  cargarVista(): void {
    const docenteId = this.authService.obtenerUsuario()?.docenteId;

    if (!docenteId) {
      this.cargando.set(false);
      this.mantenerSkeletonPorError.set(true);
      this.error.set('Tu usuario no tiene un docente vinculado.');
      this.mostrarError.set(true);
      return;
    }

    this.error.set(null);
    this.mostrarError.set(false);
    this.cargando.set(true);
    this.mantenerSkeletonPorError.set(false);

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual =
          periodos.find((periodo) => periodo.anio === this.currentYear) ??
          [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
          null;

        if (!periodoActual) {
          this.cargando.set(false);
          this.mantenerSkeletonPorError.set(true);
          this.error.set('No existe un período académico configurado para cargar la sección tutorada.');
          this.mostrarError.set(true);
          return;
        }

        forkJoin({
          tutorias: this.tutoriaService.listarPorDocente(docenteId, periodoActual.id),
          periodosEvaluacion: this.periodoEvaluacionService.listar()
        }).subscribe({
          next: ({ tutorias, periodosEvaluacion }) => {
            const tutoriasActivas = tutorias.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
            const tutoria =
              tutoriasActivas.find((item) => item.id === this.tutoriaIdRuta) ??
              tutoriasActivas[0] ??
              null;

            if (!tutoria) {
              this.cargando.set(false);
              this.error.set('No tienes una sección tutorada activa en el período actual.');
              this.mostrarError.set(true);
              return;
            }

            this.tutoriasDisponibles.set(tutoriasActivas);
            this.tutoria.set(tutoria);
            this.tutoriaIdActiva.set(tutoria.id);
            this.periodosEvaluacion.set(periodosEvaluacion);
            this.mantenerSkeletonPorError.set(false);
            this.cargarPrimerPeriodoDisponible(true);
          },
          error: (error) => {
            this.error.set(
              formatearMensajeError(
                error,
                'No se pudo cargar el resumen académico de la sección tutorada.'
              )
            );
            this.resumenAcademico.set(null);
            this.mostrarError.set(true);
            this.cargando.set(false);
            this.cargandoTabla.set(false);
            this.mantenerSkeletonPorError.set(true);
          }
        });
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(
          formatearMensajeError(error, 'No se pudo resolver el período académico actual.')
        );
        this.resumenAcademico.set(null);
        this.mostrarError.set(true);
        this.mantenerSkeletonPorError.set(true);
      }
    });
  }

  reintentarCarga(): void {
    this.mostrarError.set(false);
    this.error.set(null);
    this.mantenerSkeletonPorError.set(false);

    const periodoId = this.periodoEvaluacionSeleccionadoId();
    if (periodoId) {
      this.seleccionarPeriodoEvaluacion(periodoId);
    } else {
      this.cargarVista();
    }
  }

  cerrarError(): void {
    this.mostrarError.set(false);
  }

  seleccionarPeriodoEvaluacion(
    periodoEvaluacionId: number,
    cargaCompleta = false,
    direccion: 'left' | 'right' | null = null
  ): void {
    const tutoriaId = this.tutoriaIdActiva();
    if (!tutoriaId) {
      this.error.set('No se pudo identificar la tutoría activa.');
      return;
    }

    this.direccionAnimacionPendiente = direccion;
    this.periodoEvaluacionSeleccionadoId.set(periodoEvaluacionId);
    this.error.set(null);
    this.cargando.set(cargaCompleta);
    this.cargandoTabla.set(!cargaCompleta);

    this.tutoriaService.obtenerResumenAcademico(tutoriaId, periodoEvaluacionId).subscribe({
      next: (resumen) => {
        this.resumenAcademico.set(resumen);
        this.cargando.set(false);
        this.cargandoTabla.set(false);
        this.mantenerSkeletonPorError.set(false);
        if (this.direccionAnimacionPendiente) {
          this.animacionCambio.set(this.direccionAnimacionPendiente);
          setTimeout(() => this.animacionCambio.set(null), 320);
        }
        this.direccionAnimacionPendiente = null;
      },
      error: (error) => {
        this.error.set(
          formatearMensajeError(
            error,
            'No se pudo cargar el resumen académico de la sección tutorada.'
          )
        );
        this.mostrarError.set(true);
        this.cargando.set(false);
        this.cargandoTabla.set(false);
        this.mantenerSkeletonPorError.set(cargaCompleta);
        this.direccionAnimacionPendiente = null;
        this.animacionCambio.set(null);
      }
    });
  }

  seleccionarTutoria(tutoria: Tutoria): void {
    if (this.tutoriaIdActiva() === tutoria.id) {
      this.mostrarSelectorTutoria.set(false);
      return;
    }

    this.tutoria.set(tutoria);
    this.tutoriaIdActiva.set(tutoria.id);
    this.mostrarSelectorTutoria.set(false);
    this.cargarPrimerPeriodoDisponible(false, 'right');
  }

  toggleSelectorTutoria(): void {
    if (this.tutoriasDisponibles().length <= 1) {
      return;
    }
    this.mostrarSelectorTutoria.update((valor) => !valor);
  }

  cerrarSelectorTutoria(): void {
    this.mostrarSelectorTutoria.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.mostrarSelectorTutoria()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) {
      return;
    }
    this.cerrarSelectorTutoria();
  }

  irPeriodoEvaluacionAnterior(): void {
    const periodos = this.periodosEvaluacionTutoria();
    const indice = this.indicePeriodoEvaluacionSeleccionado();
    if (indice <= 0) return;
    this.seleccionarPeriodoEvaluacion(periodos[indice - 1].id, false, 'left');
  }

  irPeriodoEvaluacionSiguiente(): void {
    const periodos = this.periodosEvaluacionTutoria();
    const indice = this.indicePeriodoEvaluacionSeleccionado();
    if (indice < 0 || indice >= periodos.length - 1) return;
    this.seleccionarPeriodoEvaluacion(periodos[indice + 1].id, false, 'right');
  }

  // Métodos de control visual y filtros
  setModoVista(modo: ModoVistaTutoria): void {
    this.modoVista.set(modo);
  }

  setFiltroRiesgo(filtro: FiltroRiesgoTutoria): void {
    this.filtroRiesgo.set(filtro);
  }

  onBusquedaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda.set(input.value);
  }

  limpiarBusqueda(): void {
    this.busqueda.set('');
  }

  abrirExpediente(alumno: AlumnoTutoriaResumen): void {
    this.alumnoSeleccionado.set(alumno);
  }

  cerrarExpediente(): void {
    this.alumnoSeleccionado.set(null);
  }

  verFichaCompletaAlumno(alumnoId: number): void {
    void this.router.navigate(['/alumno', alumnoId], {
      queryParams: {
        periodoEvaluacionId: this.periodoEvaluacionSeleccionadoId(),
        seccionId: this.tutoria()?.seccionId ?? null,
        vista: 'global'
      }
    });
  }

  // Helpers de evaluación y cálculo
  esAlumnoEnRiesgo(alumno: AlumnoTutoriaResumen): boolean {
    const desaprobados = this.contarCursosDesaprobados(alumno);
    const asistencia = alumno.porcentajeAsistencia;
    const promedio = alumno.promedioGeneral;

    return (
      desaprobados >= 2 ||
      (asistencia !== null && asistencia < 75) ||
      (promedio !== null && promedio < 11)
    );
  }

  contarCursosDesaprobados(alumno: AlumnoTutoriaResumen): number {
    return alumno.cursos.filter((c) => c.promedio !== null && c.promedio < 11).length;
  }

  obtenerCursosDesaprobados(alumno: AlumnoTutoriaResumen): CursoAlumnoTutoriaResumen[] {
    return alumno.cursos.filter((c) => c.promedio !== null && c.promedio < 11);
  }

  obtenerNotaCurso(alumno: AlumnoTutoriaResumen, asignacionId: number): CursoAlumnoTutoriaResumen | undefined {
    return alumno.cursos.find((c) => c.asignacionId === asignacionId);
  }

  obtenerColorNota(promedio: number | null): 'aprobado' | 'regular' | 'desaprobado' | 'vacio' {
    if (promedio === null || isNaN(promedio)) return 'vacio';
    if (promedio >= 14) return 'aprobado';
    if (promedio >= 11) return 'regular';
    return 'desaprobado';
  }

  formatearPromedio(promedio: number | null): string {
    return promedio === null || isNaN(promedio) ? '--' : promedio.toFixed(2);
  }

  obtenerNotasEtiquetadas(curso: CursoAlumnoTutoriaResumen): Array<{ etiqueta: string; valor: string }> {
    if (curso.detalleNotas?.length) {
      return curso.detalleNotas.map((nota) => ({
        etiqueta: nota.etiqueta,
        valor: nota.nota.toFixed(0)
      }));
    }

    return curso.notas.map((nota, indice) => ({
      etiqueta: `EV${indice + 1}`,
      valor: nota.toFixed(0)
    }));
  }

  obtenerAsistenciaTexto(clasesAsistidas: number, clasesProgramadas: number): string {
    if (!clasesProgramadas) return '0/0';
    return `${clasesAsistidas}/${clasesProgramadas}`;
  }

  obtenerAsistenciaPorcentaje(porcentaje: number | null): string {
    return porcentaje === null ? '--' : `${porcentaje.toFixed(0)}%`;
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'AL';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  private cargarPrimerPeriodoDisponible(
    cargaCompleta = false,
    direccion: 'left' | 'right' | null = null
  ): void {
    const primerPeriodo = this.periodosEvaluacionTutoria()[0] ?? null;
    if (primerPeriodo) {
      this.seleccionarPeriodoEvaluacion(primerPeriodo.id, cargaCompleta, direccion);
    } else {
      this.periodoEvaluacionSeleccionadoId.set(null);
      this.resumenAcademico.set(null);
      this.cargando.set(false);
      this.cargandoTabla.set(false);
      this.mantenerSkeletonPorError.set(false);
      this.animacionCambio.set(null);
    }
  }
}
