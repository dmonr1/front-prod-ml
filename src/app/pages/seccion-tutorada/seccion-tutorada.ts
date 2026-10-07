import { Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademico } from '../../models/periodo-academico';
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
export type OrdenTutoria = 'nombre' | 'promedio-asc' | 'promedio-desc' | 'asistencia-asc';

@Component({
  selector: 'app-seccion-tutorada',
  standalone: true,
  imports: [Shell, FormsModule, CustomAlertComponent, RouterLink],
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

  readonly tutoriaIdRuta = signal(Number(this.route.snapshot.paramMap.get('tutoriaId')) || null);
  readonly currentYear = new Date().getFullYear();
  readonly periodosAcademicos = signal<PeriodoAcademico[]>([]);
  readonly periodoAcademicoId = signal<number | null>(null);
  readonly periodoAcademicoSeleccionado = computed(() =>
    this.periodosAcademicos().find((periodo) => periodo.id === this.periodoAcademicoId()) ?? null
  );
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

  readonly totalColumnasMatriz = computed(
    () => 6 + (this.resumenAcademico()?.cursos?.length || 0)
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

  readonly orden = signal<OrdenTutoria>('nombre');

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

    const criterioOrden = this.orden();
    if (criterioOrden === 'promedio-asc') {
      lista.sort((a, b) => (a.promedioGeneral ?? 99) - (b.promedioGeneral ?? 99));
    } else if (criterioOrden === 'promedio-desc') {
      lista.sort((a, b) => (b.promedioGeneral ?? -1) - (a.promedioGeneral ?? -1));
    } else if (criterioOrden === 'asistencia-asc') {
      lista.sort((a, b) => (a.porcentajeAsistencia ?? 100) - (b.porcentajeAsistencia ?? 100));
    } else {
      lista.sort((a, b) => a.alumnoNombreCompleto.localeCompare(b.alumnoNombreCompleto));
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
        this.periodosAcademicos.set(periodos);
        const periodoSolicitadoId = Number(this.route.snapshot.queryParamMap.get('periodoAcademicoId')) || null;
        const periodoActual = periodos.find((periodo) => periodo.id === periodoSolicitadoId) ??
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

        this.periodoAcademicoId.set(periodoActual.id);
        this.cargarTutoriasPeriodo(docenteId, periodoActual, null, true);
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

  cambiarPeriodoAcademico(valor: string | number): void {
    const periodoId = Number(valor);
    const periodo = this.periodosAcademicos().find((item) => item.id === periodoId);
    if (!periodo || periodo.id === this.periodoAcademicoId()) return;
    const docenteId = this.authService.obtenerUsuario()?.docenteId;
    if (!docenteId) return;
    const tutoriaAnterior = this.tutoria();
    this.periodoAcademicoId.set(periodo.id);
    if (!tutoriaAnterior) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { periodoAcademicoId: periodo.id },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
    this.cargarTutoriasPeriodo(docenteId, periodo, tutoriaAnterior, false);
  }

  private cargarTutoriasPeriodo(
    docenteId: number,
    periodo: PeriodoAcademico,
    tutoriaAnterior: Tutoria | null,
    cargaCompleta: boolean
  ): void {
    this.cargando.set(true);
    this.error.set(null);
    this.mostrarError.set(false);
    this.mantenerSkeletonPorError.set(false);
    forkJoin({
      tutorias: this.tutoriaService.listarPorDocente(docenteId, periodo.id),
      periodosEvaluacion: this.periodoEvaluacionService.listar()
    }).subscribe({
          next: ({ tutorias, periodosEvaluacion }) => {
            const tutoriasActivas = tutorias.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
            this.tutoriasDisponibles.set(tutoriasActivas);
            this.periodosEvaluacion.set(periodosEvaluacion);

            if (!this.tutoriaIdRuta()) {
              this.cargando.set(false);
              this.tutoria.set(null);
              this.tutoriaIdActiva.set(null);
              if (!tutoriasActivas.length) {
                this.error.set(`No tienes una sección tutorada activa en ${periodo.anio}.`);
                this.mostrarError.set(true);
              }
              return;
            }

            const tutoria = tutoriaAnterior
              ? tutoriasActivas.find((item) => item.grado === tutoriaAnterior.grado
                && item.seccion === tutoriaAnterior.seccion && item.nivel === tutoriaAnterior.nivel) ?? null
              : tutoriasActivas.find((item) => item.id === this.tutoriaIdRuta()) ?? null;
            if (!tutoria) {
              this.cargando.set(false);
              this.tutoria.set(null);
              this.tutoriaIdActiva.set(null);
              this.resumenAcademico.set(null);
              this.error.set(`La sección no tiene una tutoría activa en ${periodo.anio}.`);
              this.mostrarError.set(true);
              this.tutoriaIdRuta.set(null);
              void this.router.navigate(['/seccion-tutorada'], {
                queryParams: { periodoAcademicoId: periodo.id },
                replaceUrl: true
              });
              return;
            }

            this.tutoria.set(tutoria);
            this.tutoriaIdActiva.set(tutoria.id);
            this.tutoriaIdRuta.set(tutoria.id);
            if (tutoriaAnterior && tutoriaAnterior.id !== tutoria.id) {
              void this.router.navigate(['/mis-asignaciones/tutorias', tutoria.id], {
                queryParams: { periodoAcademicoId: periodo.id, periodoEvaluacionId: null },
                replaceUrl: true
              });
            }
            this.mantenerSkeletonPorError.set(false);
            this.cargarPrimerPeriodoDisponible(cargaCompleta);
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
    this.persistirPeriodo(periodoEvaluacionId);
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

  verSeguimientoTutoria(tutoria: Tutoria): void {
    this.router.navigate(['/mis-asignaciones/tutorias', tutoria.id], {
      queryParams: { periodoAcademicoId: tutoria.periodoAcademicoId }
    });
  }

  verHorarioTutoria(tutoria: Tutoria): void {
    this.router.navigate(['/horario-seccion', tutoria.seccionId], {
      queryParams: {
        periodoAcademicoId: tutoria.periodoAcademicoId,
        seccionLabel: `${tutoria.grado} · Sección ${tutoria.seccion} · ${tutoria.nivel}`,
        nivelNombre: tutoria.nivel
      }
    });
  }

  obtenerColorPortadaTutoria(tutoria: Tutoria): string {
    const paleta = ['#0f766e', '#1d5fc4', '#1e40af', '#4338ca', '#0891b2', '#2563eb'];
    const idx = Math.abs(tutoria.id || 0) % paleta.length;
    return paleta[idx];
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

  setModoVista(modo: ModoVistaTutoria): void {
    this.modoVista.set(modo);
  }

  setFiltroRiesgo(filtro: FiltroRiesgoTutoria): void {
    this.filtroRiesgo.set(filtro);
  }

  setOrden(orden: OrdenTutoria): void {
    this.orden.set(orden);
  }

  obtenerInasistencias(clasesAsistidas: number, clasesProgramadas: number): number {
    return Math.max(0, clasesProgramadas - clasesAsistidas);
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
    const periodoId = this.periodoEvaluacionSeleccionadoId();
    if (periodoId) {
      this.persistirPeriodo(periodoId);
    }
    void this.router.navigate(['/alumno', alumnoId], {
      queryParams: {
        from: 'seccion-tutorada',
        tutoriaId: this.tutoria()?.id ?? null,
        periodoEvaluacionId: periodoId,
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

  obtenerInasistenciasCurso(curso: CursoAlumnoTutoriaResumen | undefined): number {
    if (!curso) return 0;
    if (curso.inasistencias !== undefined && curso.inasistencias !== null) {
      return curso.inasistencias;
    }
    if (curso.clasesProgramadas !== undefined && curso.clasesAsistidas !== undefined) {
      return Math.max(0, curso.clasesProgramadas - curso.clasesAsistidas);
    }
    return 0;
  }

  obtenerAsistenciaCursoTexto(curso: CursoAlumnoTutoriaResumen | undefined): string {
    if (!curso || !curso.clasesProgramadas) return '0/0';
    return `${curso.clasesAsistidas ?? 0}/${curso.clasesProgramadas}`;
  }

  obtenerDetalleCursoTooltip(curso: CursoAlumnoTutoriaResumen | undefined, cursoNombre: string): string {
    if (!curso) return `${cursoNombre}: Sin notas ni asistencias registradas`;
    const notaTexto = curso.promedio !== null && !isNaN(curso.promedio) ? `Promedio: ${curso.promedio.toFixed(2)}` : 'Sin notas';
    const evTexto = `${curso.evaluacionesRegistradas || 0} evaluaci${(curso.evaluacionesRegistradas || 0) === 1 ? 'ón' : 'ones'}`;
    const inasist = this.obtenerInasistenciasCurso(curso);
    const asistTexto = curso.clasesProgramadas
      ? `Asistencia: ${curso.porcentajeAsistencia !== null && curso.porcentajeAsistencia !== undefined ? curso.porcentajeAsistencia.toFixed(0) : '--'}% (${curso.clasesAsistidas ?? 0}/${curso.clasesProgramadas} clases)`
      : 'Asistencia: Sin clases registradas';
    const faltasTexto = inasist > 0 ? ` · ${inasist} inasistencia${inasist > 1 ? 's' : ''}` : '';
    const tardTexto = (curso.tardanzas ?? 0) > 0 ? ` · ${curso.tardanzas} tardanza${(curso.tardanzas ?? 0) > 1 ? 's' : ''}` : '';
    return `${cursoNombre} (${curso.docenteNombreCompleto})\n${notaTexto} · ${evTexto}\n${asistTexto}${faltasTexto}${tardTexto}`;
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'AL';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  private readonly STORAGE_KEY_PERIODO = 'tutoria_periodo_seleccionado';

  private persistirPeriodo(periodoId: number): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY_PERIODO, String(periodoId));
    } catch {
      // Storage no disponible
    }
  }

  private obtenerPeriodoPersistido(): number | null {
    try {
      const val = sessionStorage.getItem(this.STORAGE_KEY_PERIODO);
      return val ? Number(val) : null;
    } catch {
      return null;
    }
  }

  private cargarPrimerPeriodoDisponible(
    cargaCompleta = false,
    direccion: 'left' | 'right' | null = null
  ): void {
    const periodos = this.periodosEvaluacionTutoria();
    const queryParamPeriodoId = Number(this.route.snapshot.queryParamMap.get('periodoEvaluacionId')) || null;
    const sessionPeriodoId = this.obtenerPeriodoPersistido();
    const periodoDeseadoId = queryParamPeriodoId || sessionPeriodoId;

    const periodoEncontrado = periodos.find((p) => p.id === periodoDeseadoId) ?? periodos[0] ?? null;
    if (periodoEncontrado) {
      this.seleccionarPeriodoEvaluacion(periodoEncontrado.id, cargaCompleta, direccion);
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
