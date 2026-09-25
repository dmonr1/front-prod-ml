import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomAlertComponent } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { CorteSeguimiento, EvaluacionPendienteFecha, PreparacionCorte } from '../../models/corte-seguimiento';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { Seccion } from '../../models/seccion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { CorteSeguimientoService } from '../../services/academico/corte-seguimiento.service';
import { SeccionService } from '../../services/academico/seccion.service';
import {
  AlertaSeguimiento,
  AlertaSeguimientoService,
  RecomendacionSeguimiento
} from '../../services/alerta/alerta-seguimiento.service';
import { AuthService } from '../../services/auth/auth.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import {
  PrediccionRiesgo,
  PrediccionService,
  ResumenPrediccion
} from '../../services/prediccion/prediccion.service';
import { formatearMensajeError } from '../../utils/error-formatter';

type VistaPrediccion = 'global' | 'curso';
type NivelRiesgo = 'ALTO' | 'MEDIO' | 'BAJO';

interface PrediccionVista extends PrediccionRiesgo {
  nivelRiesgoNormalizado: NivelRiesgo;
  puntaje: number;
  factores: string[];
  alertaPrincipal: string;
  recomendacionPrincipal: string;
  tendencia: 'Crítico' | 'Controlado';
  factorDominante: 'asistencia' | 'rendimiento' | 'mixto' | 'controlado';
}

interface EstadoPreparacionCorte {
  corte: CorteSeguimiento;
  preparacion: PreparacionCorte | null;
}

@Component({
  selector: 'app-predicciones',
  imports: [Shell, DecimalPipe, CustomAlertComponent],
  templateUrl: './predicciones.html',
  styleUrl: './predicciones.scss'
})
export class Predicciones {
  private vistaRequestId = 0;
  private estadoInicialPresentado = false;
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly corteSeguimientoService = inject(CorteSeguimientoService);
  private readonly seccionService = inject(SeccionService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);
  private readonly prediccionService = inject(PrediccionService);
  private readonly alertaSeguimientoService = inject(AlertaSeguimientoService);
  readonly vistaActiva = signal<VistaPrediccion>('global');
  readonly cargandoFiltros = signal(true);
  readonly cargandoVista = signal(false);
  readonly recalculando = signal(false);
  readonly error = signal<string | null>(null);
  readonly alertaConexionAbierta = signal(false);
  readonly alertaRecalculoAbierta = signal(false);
  readonly mensajeRecalculo = signal('');

  readonly periodosEvaluacion = signal<CorteSeguimiento[]>([]);
  readonly periodosAcademicosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly evaluacionesPendientesFecha = signal<EvaluacionPendienteFecha[]>([]);
  readonly preparacionCorte = signal<PreparacionCorte | null>(null);
  readonly periodoAcademicoActual = signal<PeriodoAcademico | null>(null);
  readonly secciones = signal<Seccion[]>([]);
  readonly cursoIdsVisibles = signal<ReadonlySet<number> | null>(null);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly seccionSeleccionadaId = signal<number | null>(null);
  readonly cursoSeleccionadoId = signal<number | null>(null);
  readonly busqueda = signal('');
  readonly prediccionSeleccionadaId = signal<number | null>(null);
  readonly animationToken = signal(0);
  readonly mostrarSelectorPeriodo = signal(false);
  readonly mostrarSelectorPeriodoEvaluacion = signal(false);
  readonly mostrarSelectorSeccion = signal(false);
  readonly modalEstadoCortesAbierto = signal(false);
  readonly cargandoEstadoCortes = signal(false);
  readonly estadoCortes = signal<EstadoPreparacionCorte[]>([]);
  readonly evaluacionesPendientesEstado = signal<EvaluacionPendienteFecha[]>([]);
  readonly periodoEvaluacionSeleccionadoIdTermino = signal<number | null>(null);

  readonly resumenApi = signal<ResumenPrediccion | null>(null);
  readonly prediccionesGlobales = signal<PrediccionVista[]>([]);
  readonly prediccionesCurso = signal<PrediccionVista[]>([]);

  readonly puedeRecalcular = computed(() => {
    return this.authService.tieneGestionAdministrativa();
  });

  constructor() {
    this.cargarFiltros();
  }

  readonly periodoEvaluacionSeleccionado = computed(
    () =>
      this.periodosEvaluacionDisponibles().find((corte) => corte.id === this.periodoEvaluacionSeleccionadoId()) ?? null
  );

  readonly periodoEvaluacionTerminoSeleccionado = computed(() =>
    this.periodosAcademicosEvaluacion().find((periodo) => periodo.id === this.periodoEvaluacionSeleccionadoIdTermino()) ?? null
  );

  readonly etiquetaPeriodoEvaluacion = computed(() => {
    const periodo = this.periodoEvaluacionTerminoSeleccionado();
    return periodo ? `${periodo.nombre} · N.° ${periodo.numero}` : 'Período de evaluación';
  });

  readonly periodosTerminoDisponibles = computed(() => {
    const periodoAcademicoId = this.seccionSeleccionada()?.periodoAcademicoId;
    return this.periodosAcademicosEvaluacion()
      .filter((periodo) => !periodoAcademicoId || periodo.periodoAcademicoId === periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero);
  });

  readonly nombrePeriodoAcademico = computed(() =>
    String(this.seccionSeleccionada()?.anioAcademico ?? this.periodoAcademicoActual()?.anio ?? '') ||
    'Período académico no disponible'
  );

  readonly seccionSeleccionada = computed(
    () => this.secciones().find((seccion) => seccion.id === this.seccionSeleccionadaId()) ?? null
  );

  readonly periodosEvaluacionDisponibles = computed(() => {
    const seccion = this.seccionSeleccionada();
    const periodos = this.periodosEvaluacion();
    const periodoAcademicoId = seccion?.periodoAcademicoId;
    const periodoTermino = this.periodoEvaluacionTerminoSeleccionado();

    if (!periodoAcademicoId) {
      return periodos;
    }

    const cortesAcademicos = periodos
      .filter((corte) => corte.periodoAcademicoId === periodoAcademicoId)
      .sort((a, b) => a.semana - b.semana);

    if (!periodoTermino) return cortesAcademicos;
    return cortesAcademicos.filter((corte) =>
      corte.fechaCorte >= periodoTermino.fechaInicio.slice(0, 10) &&
      corte.fechaCorte <= periodoTermino.fechaFin.slice(0, 10)
    );
  });

  readonly datasetActivo = computed(() =>
    this.vistaActiva() === 'global' ? this.prediccionesGlobales() : this.prediccionesCurso()
  );

  readonly cursosDisponibles = computed(() => {
    const cursos = new Map<number, string>();

    for (const item of this.prediccionesCurso()) {
      if (item.cursoId != null && item.curso) {
        cursos.set(item.cursoId, item.curso);
      }
    }

    return [...cursos.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly prediccionesFiltradas = computed(() => {
    const query = this.busqueda().trim().toLowerCase();
    const cursoSeleccionadoId = this.cursoSeleccionadoId();

    return this.datasetActivo()
      .filter((item) => {
        if (
          this.vistaActiva() === 'curso' &&
          cursoSeleccionadoId != null &&
          item.cursoId !== cursoSeleccionadoId
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          item.alumnoNombreCompleto,
          item.codigoAlumno,
          item.curso ?? '',
          item.grado ?? '',
          item.seccion ?? ''
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) =>
        this.obtenerClaveOrdenAlumno(a.alumnoNombreCompleto).localeCompare(
          this.obtenerClaveOrdenAlumno(b.alumnoNombreCompleto)
        )
      );
  });

  readonly prediccionSeleccionada = computed(() => {
    const seleccionada = this.prediccionesFiltradas().find(
      (item) => item.id === this.prediccionSeleccionadaId()
    );
    return seleccionada ?? this.prediccionesFiltradas()[0] ?? null;
  });

  readonly resumen = computed(() => {
    const resumen = this.resumenApi();
    const registros = this.prediccionesFiltradas();

    if (!resumen || this.vistaActiva() === 'curso') {
      return {
        total: registros.length,
        alto: registros.filter((item) => item.nivelRiesgoNormalizado === 'ALTO').length,
        medio: registros.filter((item) => item.nivelRiesgoNormalizado === 'MEDIO').length,
        bajo: registros.filter((item) => item.nivelRiesgoNormalizado === 'BAJO').length,
        promedio: this.promedio(registros.map((item) => item.puntaje))
      };
    }

    return {
      total: resumen.totalPredicciones ?? 0,
      alto: resumen.totalRiesgoAlto ?? 0,
      medio: resumen.totalRiesgoMedio ?? 0,
      bajo: resumen.totalRiesgoBajo ?? 0,
      promedio: Number(resumen.promedioPuntajeRiesgo ?? 0)
    };
  });

  readonly distribucion = computed(() => {
    const resumen = this.resumen();
    const total = resumen.total || 1;
    return [
      {
        label: 'Riesgo alto',
        value: resumen.alto,
        percent: Math.round((resumen.alto / total) * 100),
        tone: 'high'
      },
      {
        label: 'Riesgo medio',
        value: resumen.medio,
        percent: Math.round((resumen.medio / total) * 100),
        tone: 'medium'
      },
      {
        label: 'Riesgo bajo',
        value: resumen.bajo,
        percent: Math.round((resumen.bajo / total) * 100),
        tone: 'low'
      }
    ];
  });

  readonly tituloDistribucion = computed(() =>
    this.vistaActiva() === 'global'
      ? 'Alumnos por nivel de riesgo'
      : 'Casos por nivel de riesgo'
  );

  readonly subtituloDistribucion = computed(() =>
    this.vistaActiva() === 'global'
      ? `${this.resumen().total} alumnos evaluados`
      : `${this.resumen().total} casos evaluados`
  );

  readonly donutDistribucion = computed(() => {
    const distribucion = this.distribucion();
    const alto = distribucion.find((item) => item.tone === 'high')?.percent ?? 0;
    const medio = distribucion.find((item) => item.tone === 'medium')?.percent ?? 0;
    const bajo = distribucion.find((item) => item.tone === 'low')?.percent ?? 0;

    return `conic-gradient(
      
#ff0000 0% ${alto}%,
      
#ffda09 ${alto}% ${alto + medio}%,

#5be00d ${alto + medio}% 100%
    )`;
  });

  readonly indicadores = computed(() => {
    const registros = this.prediccionesFiltradas();
    return [
      {
        label: 'Alumnos críticos',
        value: registros.filter((item) => item.nivelRiesgoNormalizado === 'ALTO').length.toString(),
        tone: 'high'
      },
      {
        label: 'Promedio riesgo',
        value: this.formatearNumero(this.resumen().promedio),
        tone: 'medium'
      },
      {
        label: 'Modelo activo',
        value: this.prediccionSeleccionada()?.modeloVersion || 'Sin versión',
        tone: 'low'
      }
    ];
  });

  readonly prioridadesIntervencion = computed(() => {
    const prioridadNivel = { ALTO: 0, MEDIO: 1, BAJO: 2 } satisfies Record<NivelRiesgo, number>;

    return [...this.prediccionesFiltradas()]
      .sort((a, b) => {
        const nivel = prioridadNivel[a.nivelRiesgoNormalizado] - prioridadNivel[b.nivelRiesgoNormalizado];
        if (nivel !== 0) {
          return nivel;
        }

        return b.puntaje - a.puntaje;
      })
      .slice(0, 5);
  });

  readonly asistenciaSeccion = computed(() => {
    const registros = this.prediccionesGlobales();
    const acumulado = registros.reduce(
      (acc, item) => {
        const variables = this.parsearVariables(item.variablesEntrada);
        const asistidas = this.obtenerNumero(variables['clases_asistidas']) ?? 0;
        const programadas = this.obtenerNumero(variables['clases_programadas']) ?? 0;
        const porcentaje = this.obtenerNumero(variables['porcentaje_asistencia']);

        acc.asistidas += asistidas;
        acc.programadas += programadas;

        if (porcentaje != null) {
          acc.porcentajes.push(porcentaje);
        }

        return acc;
      },
      { asistidas: 0, programadas: 0, porcentajes: [] as number[] }
    );

    const porcentajePromedio = acumulado.porcentajes.length
      ? this.promedio(acumulado.porcentajes)
      : acumulado.programadas
        ? (acumulado.asistidas / acumulado.programadas) * 100
        : 0;

    const faltas = Math.max(acumulado.programadas - acumulado.asistidas, 0);
    const mayor = acumulado.porcentajes.length ? Math.max(...acumulado.porcentajes) : porcentajePromedio;
    const menor = acumulado.porcentajes.length ? Math.min(...acumulado.porcentajes) : porcentajePromedio;
    const meta = 90;

    return {
      porcentaje: porcentajePromedio,
      asistidas: acumulado.asistidas,
      programadas: acumulado.programadas,
      faltas,
      meta,
      diferenciaMeta: porcentajePromedio - meta,
      mayor,
      menor,
      tono:
        porcentajePromedio >= 90 ? 'low' : porcentajePromedio >= 75 ? 'medium' : 'high'
    } as const;
  });

  readonly detalleRiesgoGlobal = computed(() => {
    const resumen = this.resumen();
    const asistencia = this.asistenciaSeccion();
    const prioritarios = resumen.alto + resumen.medio;

    return [
      {
        label: 'Riesgo promedio de fracaso',
        value: `${this.formatearNumero(resumen.promedio)}%`
      },
      {
        label: 'Asistencia promedio',
        value: `${this.formatearNumero(asistencia.porcentaje)}%`
      },
      {
        label: 'Meta de asistencia del período',
        value: `${this.formatearNumero(asistencia.meta)}%`
      },
      {
        label: 'Casos prioritarios',
        value: `${prioritarios}`
      },
      {
        label: 'Riesgo alto',
        value: `${resumen.alto}`
      },
      {
        label: 'Inasistencias',
        value: `${asistencia.faltas}`
      },
      {
        label: 'Clases programadas',
        value: `${asistencia.programadas}`
      }
    ] as const;
  });

  readonly cursoSeleccionadoNombre = computed(() => {
    if (this.vistaActiva() !== 'curso') {
      return null;
    }

    const cursoId = this.cursoSeleccionadoId();
    if (cursoId == null) {
      return 'Todos';
    }

    return this.cursosDisponibles().find((curso) => curso.id === cursoId)?.nombre ?? 'Curso';
  });

  readonly metricasDashboard = computed(() => {
    const resumen = this.resumen();
    const prioritarios = resumen.alto + resumen.medio;

    if (this.vistaActiva() === 'global') {
      return [
        {
          label: 'Alumnos evaluados',
          value: `${resumen.total}`,
          detail: 'Casos visibles en esta sección.',
          icon: 'fa-solid fa-users',
          tone: 'neutral'
        },
        {
          label: 'Casos prioritarios',
          value: `${prioritarios}`,
          detail: 'Alumnos con riesgo medio o alto de fracaso.',
          icon: 'fa-solid fa-bullseye',
          tone: 'medium'
        },
        {
          label: 'Riesgo promedio',
          value: `${this.formatearNumero(resumen.promedio)}%`,
          detail: 'Probabilidad promedio de fracaso en la sección.',
          icon: 'fa-solid fa-chart-line',
          tone: 'neutral'
        },
        {
          label: 'Riesgo alto',
          value: `${resumen.alto}`,
          detail: 'Alumnos con atención inmediata.',
          icon: 'fa-solid fa-triangle-exclamation',
          tone: 'high'
        }
      ] as const;
    }

    return [
      {
        label: 'Curso seleccionado',
        value: this.cursoSeleccionadoNombre() ?? 'Curso',
        detail: 'Filtro activo del análisis por curso.',
        icon: 'fa-solid fa-book-open',
        tone: 'neutral'
      },
      {
        label: 'Alumnos evaluados',
        value: `${resumen.total}`,
        detail: 'Casos visibles para este curso.',
        icon: 'fa-solid fa-users-viewfinder',
        tone: 'neutral'
      },
      {
        label: 'Riesgo promedio',
        value: `${this.formatearNumero(resumen.promedio)}%`,
        detail: 'Probabilidad promedio de fracaso en este curso.',
        icon: 'fa-solid fa-chart-column',
        tone: 'medium'
      },
      {
        label: 'Riesgo alto',
        value: `${resumen.alto}`,
        detail: 'Casos altos en el curso seleccionado.',
        icon: 'fa-solid fa-triangle-exclamation',
        tone: 'high'
      }
    ] as const;
  });

  readonly riesgoGeneral = computed(() => {
    const promedio = this.resumen().promedio;

    if (promedio >= 70) {
      return {
        nivel: 'Alto',
        detalle: 'La sección requiere seguimiento prioritario.',
        tone: 'high' as const
      };
    }

    if (promedio >= 40) {
      return {
        nivel: 'Medio',
        detalle: 'La sección necesita monitoreo cercano.',
        tone: 'medium' as const
      };
    }

    return {
      nivel: 'Bajo',
      detalle: 'La sección mantiene un riesgo controlado.',
      tone: 'low' as const
    };
  });

  cambiarVista(vista: VistaPrediccion): void {
    if (this.vistaActiva() === vista) {
      return;
    }

    this.vistaActiva.set(vista);
    this.ajustarCursoSeleccionado();
    this.asegurarSeleccion();
    this.animarPanel();
  }

  onPeriodoEvaluacionChange(value: string): void {
    this.periodoEvaluacionSeleccionadoId.set(Number(value));
    this.mostrarSelectorPeriodo.set(false);
    this.cargarVista();
  }

  onSeccionChange(value: string): void {
    this.seccionSeleccionadaId.set(Number(value));
    this.cursoSeleccionadoId.set(null);
    this.mostrarSelectorSeccion.set(false);
    this.ajustarPeriodoTerminoSegunSeccion();
    this.ajustarPeriodoSegunSeccion();
    this.cargarVista();
  }

  toggleSelectorPeriodo(): void {
    this.mostrarSelectorPeriodo.update((valor) => !valor);
    if (this.mostrarSelectorPeriodo()) {
      this.mostrarSelectorSeccion.set(false);
      this.mostrarSelectorPeriodoEvaluacion.set(false);
    }
  }

  toggleSelectorPeriodoEvaluacion(): void {
    this.mostrarSelectorPeriodoEvaluacion.update((valor) => !valor);
    if (this.mostrarSelectorPeriodoEvaluacion()) {
      this.mostrarSelectorPeriodo.set(false);
      this.mostrarSelectorSeccion.set(false);
    }
  }

  onPeriodoEvaluacionTerminoChange(value: string): void {
    this.periodoEvaluacionSeleccionadoIdTermino.set(Number(value));
    this.mostrarSelectorPeriodoEvaluacion.set(false);
    this.ajustarPeriodoSegunSeccion();
    this.cargarVista();
    this.abrirEstadoCortes();
  }

  toggleSelectorSeccion(): void {
    this.mostrarSelectorSeccion.update((valor) => !valor);
    if (this.mostrarSelectorSeccion()) {
      this.mostrarSelectorPeriodo.set(false);
      this.mostrarSelectorPeriodoEvaluacion.set(false);
    }
  }

  cerrarSelectores(): void {
    this.mostrarSelectorPeriodo.set(false);
    this.mostrarSelectorSeccion.set(false);
    this.mostrarSelectorPeriodoEvaluacion.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.mostrarSelectorPeriodo() && !this.mostrarSelectorSeccion() && !this.mostrarSelectorPeriodoEvaluacion()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.cerrarSelectores();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrarSelectores();
    this.cerrarEstadoCortes();
  }

  onCursoChange(value: string): void {
    this.cursoSeleccionadoId.set(value ? Number(value) : null);
    this.asegurarSeleccion();
    this.animarPanel();
  }

  onBusqueda(value: string): void {
    this.busqueda.set(value);
    this.asegurarSeleccion();
  }

  recalcularPredicciones(): void {
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    const seccionId = this.seccionSeleccionadaId();

    const preparacion = this.preparacionCorte();
    if (!periodoEvaluacionId || !seccionId || this.recalculando() || this.evaluacionesPendientesFecha().length
        || !preparacion?.corteDisponible || !preparacion.alumnosConDatos) {
      return;
    }

    this.recalculando.set(true);
    this.error.set(null);
    this.alertaConexionAbierta.set(false);

    this.prediccionService.recalcular(periodoEvaluacionId, seccionId).subscribe({
      next: (respuesta) => {
        this.recalculando.set(false);
        this.mensajeRecalculo.set(
          `${respuesta.matriculasProcesadas} alumnos procesados con el modelo ${respuesta.modeloVersion}.`
        );
        this.alertaRecalculoAbierta.set(true);
        this.cargarVista();
      },
      error: (error) => {
        this.recalculando.set(false);
        const mensaje = formatearMensajeError(error, 'No se pudieron recalcular las predicciones.');
        if (mensaje.toLowerCase().includes('fecha')) {
          this.error.set(mensaje);
        } else {
          this.error.set(mensaje);
          this.alertaConexionAbierta.set(true);
        }
      }
    });
  }

  reintentarCarga(): void {
    this.alertaConexionAbierta.set(false);
    this.error.set(null);

    if (this.periodosEvaluacion().length && this.secciones().length) {
      this.cargarVista();
      return;
    }

    this.cargarFiltros();
  }

  cerrarAlertaError(): void {
    this.alertaConexionAbierta.set(false);
  }

  cerrarAlertaRecalculo(): void {
    this.alertaRecalculoAbierta.set(false);
  }

  abrirEstadoCortes(): void {
    const seccionId = this.seccionSeleccionadaId();
    const cortes = this.periodosEvaluacionDisponibles();
    this.modalEstadoCortesAbierto.set(true);
    this.estadoCortes.set([]);
    this.evaluacionesPendientesEstado.set([]);

    if (!seccionId || !cortes.length) {
      this.cargandoEstadoCortes.set(false);
      return;
    }

    this.cargandoEstadoCortes.set(true);
    forkJoin({
      preparaciones: forkJoin(cortes.map((corte) =>
        this.corteSeguimientoService.preparacion(corte.id, seccionId).pipe(catchError(() => of(null)))
      )),
      pendientes: this.corteSeguimientoService.evaluacionesPendientes(cortes[0].id, seccionId)
        .pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ preparaciones, pendientes }) => {
        this.estadoCortes.set(preparaciones.map((preparacion, index) => ({
          corte: cortes[index],
          preparacion
        })));
        const unicas = new Map(pendientes
          .filter((item) => item.periodoEvaluacionId === this.periodoEvaluacionSeleccionadoIdTermino())
          .map((item) => [item.evaluacionId, item]));
        this.evaluacionesPendientesEstado.set([...unicas.values()]);
        this.cargandoEstadoCortes.set(false);
      },
      error: () => this.cargandoEstadoCortes.set(false)
    });
  }

  cerrarEstadoCortes(): void {
    this.modalEstadoCortesAbierto.set(false);
  }

  corteListo(item: EstadoPreparacionCorte): boolean {
    const prep = item.preparacion;
    return Boolean(prep?.corteDisponible && prep.alumnosMatriculados > 0 && prep.alumnosConDatos > 0
      && !prep.evaluacionesSinFecha && Boolean(prep.periodoEvaluacion));
  }

  etiquetaEstadoCorte(item: EstadoPreparacionCorte): string {
    if (!this.corteListo(item)) return 'Pendiente';
    return this.faltantesCorte(item).length ? 'Calculable · cobertura parcial' : 'Listo para calcular';
  }

  faltantesCorte(item: EstadoPreparacionCorte): string[] {
    const prep = item.preparacion;
    if (!prep) return ['No se pudo consultar la preparación de este corte.'];

    const faltantes: string[] = [];
    if (!prep.corteDisponible) faltantes.push('La fecha del corte todavía no llega.');
    if (!prep.alumnosMatriculados) faltantes.push('No hay alumnos matriculados en la sección para este período.');
    else if (!prep.alumnosConDatos) faltantes.push('Registra notas o asistencia para que el modelo tenga datos.');
    const evaluacionesSinFecha = prep.evaluacionesSinFecha;
    if (evaluacionesSinFecha) faltantes.push(`${evaluacionesSinFecha} evaluación(es) aún no tienen fecha.`);
    if (!prep.periodoEvaluacion) faltantes.push('No se encontró un período de evaluación asociado a esta fecha de corte.');
    if (prep.notasEsperadas > prep.notasRegistradas) {
      faltantes.push(`Faltan ${prep.notasEsperadas - prep.notasRegistradas} notas por registrar.`);
    }
    if (!prep.bloquesSemanales) faltantes.push('No hay clases programadas en el horario.');
    else if (prep.alumnosConAsistencia < prep.alumnosMatriculados) {
      faltantes.push(`Asistencia incompleta: ${prep.alumnosConAsistencia} de ${prep.alumnosMatriculados} alumnos tienen registros.`);
    }
    return faltantes;
  }

  seleccionarPrediccion(id: number): void {
    this.prediccionSeleccionadaId.set(id);
  }

  verFichaAlumno(alumnoId: number): void {
    void this.router.navigate(['/alumno', alumnoId], {
      queryParams: {
        corteSeguimientoId: this.periodoEvaluacionSeleccionadoId(),
        seccionId: this.seccionSeleccionadaId(),
        vista: this.vistaActiva()
      }
    });
  }

  private cargarFiltros(): void {
    this.cargandoFiltros.set(true);
    this.error.set(null);
    this.alertaConexionAbierta.set(false);

    forkJoin({
      secciones: this.seccionService.listar(),
      periodosAcademicos: this.periodoAcademicoService.listar(),
      periodosEvaluacion: this.periodoEvaluacionService.listar()
    }).subscribe({
      next: ({ secciones, periodosAcademicos, periodosEvaluacion }) => {
        const periodoAcademico = this.resolverPeriodoAcademicoActual(periodosAcademicos);
        this.periodoAcademicoActual.set(periodoAcademico);
        const terminosDelPeriodo = periodosEvaluacion
          .filter((periodo) => periodo.periodoAcademicoId === periodoAcademico?.id && periodo.estado !== 'INACTIVO')
          .sort((a, b) => a.numero - b.numero);
        this.periodosAcademicosEvaluacion.set(terminosDelPeriodo);
        this.periodoEvaluacionSeleccionadoIdTermino.set(
          this.resolverPeriodoEvaluacionVigente(terminosDelPeriodo)?.id ?? null
        );
        if (!periodoAcademico) {
          this.configurarFiltros([], []);
          return;
        }
        const seccionesActivas = secciones.filter((seccion) => seccion.estado !== 'INACTIVO'
          && seccion.periodoAcademicoId === periodoAcademico.id)
          .sort((a, b) => `${a.nivelNombre ?? ''}${a.gradoNombre ?? ''}${a.nombre}`
            .localeCompare(`${b.nivelNombre ?? ''}${b.gradoNombre ?? ''}${b.nombre}`));
        this.corteSeguimientoService.listar(periodoAcademico.id).subscribe({
          next: (cortes) => this.aplicarFiltrosPorRol(cortes, seccionesActivas, periodoAcademico.id),
          error: () => {
            this.cargandoFiltros.set(false);
            this.error.set('No se pudieron cargar los cortes semanales del período.');
            this.alertaConexionAbierta.set(true);
          }
        });
      },
      error: () => {
        this.cargandoFiltros.set(false);
        this.error.set('No se pudieron cargar los filtros de predicción.');
        this.alertaConexionAbierta.set(true);
      }
    });
  }

  private aplicarFiltrosPorRol(cortes: CorteSeguimiento[], secciones: Seccion[], periodoAcademicoId: number): void {
    this.periodosEvaluacion.set(cortes);
    const usuario = this.authService.obtenerUsuario();
    if (this.authService.tieneGestionAdministrativa()) {
      this.cursoIdsVisibles.set(null);
      this.configurarFiltros(cortes, secciones);
      return;
    }
    const docenteId = usuario?.docenteId;
    if (docenteId && usuario?.roles.includes('DOCENTE')) {
      this.asignacionAcademicaService.listarAsignaciones(docenteId, periodoAcademicoId).subscribe({
        next: (asignaciones) => {
          const activas = asignaciones.filter((asignacion) => (asignacion.estado ?? 'ACTIVO') === 'ACTIVO');
          const seccionesPermitidas = new Set(activas.map((asignacion) => asignacion.seccionId));
          this.cursoIdsVisibles.set(new Set(activas.map((asignacion) => asignacion.cursoId)));
          this.configurarFiltros(cortes, secciones.filter((seccion) => seccionesPermitidas.has(seccion.id)));
        },
        error: () => {
          this.cursoIdsVisibles.set(new Set());
          this.configurarFiltros(cortes, []);
        }
      });
      return;
    }
    this.cursoIdsVisibles.set(new Set());
    this.configurarFiltros(cortes, []);
  }

  private cargarVista(): void {
    const requestId = ++this.vistaRequestId;
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    const seccionId = this.seccionSeleccionadaId();

    if (!periodoEvaluacionId || !seccionId) {
      this.preparacionCorte.set(null);
      return;
    }

      this.preparacionCorte.set(null);
      this.evaluacionesPendientesFecha.set([]);
      this.cargandoVista.set(true);
      this.error.set(null);
      this.alertaConexionAbierta.set(false);

    forkJoin({
      resumen: this.prediccionService.obtenerResumen(periodoEvaluacionId, seccionId),
      globales: this.prediccionService.listarGlobales(periodoEvaluacionId, seccionId),
      cursos: this.prediccionService.listarCursos(periodoEvaluacionId, seccionId),
      alertas: this.alertaSeguimientoService.listarAlertasPorCorte(periodoEvaluacionId, seccionId),
      recomendaciones: this.alertaSeguimientoService.listarRecomendacionesPorCorte(periodoEvaluacionId, seccionId),
      pendientes: this.corteSeguimientoService.evaluacionesPendientes(periodoEvaluacionId, seccionId),
      preparacion: this.corteSeguimientoService.preparacion(periodoEvaluacionId, seccionId)
    }).subscribe({
      next: ({ resumen, globales, cursos, alertas, recomendaciones, pendientes, preparacion }) => {
        if (requestId !== this.vistaRequestId) return;
        this.evaluacionesPendientesFecha.set(pendientes);
        this.preparacionCorte.set(preparacion);
        this.resumenApi.set(resumen);
        this.prediccionesGlobales.set(
          globales.map((item) => this.mapearPrediccion(item, alertas, recomendaciones))
        );
        const cursoIdsVisibles = this.cursoIdsVisibles();
        this.prediccionesCurso.set(
          cursos
            .filter((item) =>
              cursoIdsVisibles === null ||
              (item.cursoId !== null && cursoIdsVisibles.has(item.cursoId))
            )
            .map((item) => this.mapearPrediccion(item, alertas, recomendaciones))
        );
        this.ajustarCursoSeleccionado();
        this.cargandoVista.set(false);
        this.asegurarSeleccion();
        this.animarPanel();
      },
      error: (error) => {
        if (requestId !== this.vistaRequestId) return;
        this.cargandoVista.set(false);
        this.error.set(formatearMensajeError(error, 'No se pudieron cargar las predicciones.'));
        if (!this.error()?.toLowerCase().includes('corte')) this.alertaConexionAbierta.set(true);
      }
    });
  }

  abrirFechaEvaluacion(evaluacion: EvaluacionPendienteFecha): void {
    void this.router.navigate(['/mis-asignaciones', evaluacion.asignacionId, 'notas'], {
      queryParams: { periodoEvaluacionId: evaluacion.periodoEvaluacionId, evaluacionId: evaluacion.evaluacionId }
    });
  }

  abrirConfiguracionCortes(): void {
    void this.router.navigate(['/gestion-estudiantil']);
  }

  abrirRegistroNotas(): void {
    void this.router.navigate(['/mis-asignaciones']);
  }

  abrirRegistroAsistencia(): void {
    void this.router.navigate(['/asistencias']);
  }

  abrirHorarios(): void {
    void this.router.navigate(['/horarios']);
  }

  abrirMatriculas(): void {
    const periodoId = this.periodoAcademicoActual()?.id;
    const seccionId = this.seccionSeleccionadaId();
    if (periodoId && seccionId) {
      void this.router.navigate(['/gestion-estudiantil/periodo', periodoId, 'seccion', seccionId]);
    }
  }

  private asegurarSeleccion(): void {
    const primera = this.prediccionesFiltradas()[0] ?? null;
    const existe = this.prediccionesFiltradas().some(
      (item) => item.id === this.prediccionSeleccionadaId()
    );

    if (!existe) {
      this.prediccionSeleccionadaId.set(primera?.id ?? null);
    }
  }

  private ajustarCursoSeleccionado(): void {
    if (this.vistaActiva() !== 'curso') {
      this.cursoSeleccionadoId.set(null);
      return;
    }

    const cursoActual = this.cursoSeleccionadoId();
    const existe = this.cursosDisponibles().some((curso) => curso.id === cursoActual);

    if (!existe) {
      this.cursoSeleccionadoId.set(null);
    }
  }

  private animarPanel(): void {
    this.animationToken.update((value) => value + 1);
  }

  private mapearPrediccion(
    item: PrediccionRiesgo,
    alertas: AlertaSeguimiento[],
    recomendaciones: RecomendacionSeguimiento[]
  ): PrediccionVista {
    const nivel = this.normalizarNivel(item.nivelRiesgo);
    const alerta = this.buscarAlerta(item, alertas);
    const recomendacion = this.buscarRecomendacion(item, recomendaciones);
    const variables = this.parsearVariables(item.variablesEntrada);

    return {
      ...item,
      nivelRiesgoNormalizado: nivel,
      puntaje: Number(item.puntajeRiesgo ?? 0),
      factores: this.extraerFactores(item.variablesEntrada),
      factorDominante: this.detectarFactorDominante(nivel, variables),
      alertaPrincipal:
        alerta?.mensaje ??
        this.construirJustificacionRiesgo(nivel, variables),
      recomendacionPrincipal:
        recomendacion?.descripcion ??
        (item.cursoId != null
          ? 'Aplicar seguimiento focalizado por curso y revisar evaluaciones recientes.'
          : 'Mantener el seguimiento académico general y revisar la evolución del siguiente corte.'),
      tendencia: nivel === 'ALTO' ? 'Crítico' : 'Controlado'
    };
  }

  private buscarAlerta(item: PrediccionRiesgo, alertas: AlertaSeguimiento[]): AlertaSeguimiento | undefined {
    return alertas.find((alerta) => {
      const coincideAlumno = alerta.alumnoId === item.alumnoId;
      const coincideCurso =
        item.cursoId == null ? alerta.cursoId == null : alerta.cursoId === item.cursoId;
      return coincideAlumno && coincideCurso;
    });
  }

  private buscarRecomendacion(
    item: PrediccionRiesgo,
    recomendaciones: RecomendacionSeguimiento[]
  ): RecomendacionSeguimiento | undefined {
    return recomendaciones.find((recomendacion) => {
      const coincideAlumno = recomendacion.alumnoId === item.alumnoId;
      const coincideCurso =
        item.cursoId == null
          ? recomendacion.cursoId == null
          : recomendacion.cursoId === item.cursoId;
      return coincideAlumno && coincideCurso;
    });
  }

  private normalizarNivel(nivel: string | null | undefined): NivelRiesgo {
    if (nivel === 'ALTO' || nivel === 'MEDIO') {
      return nivel;
    }
    return 'BAJO';
  }

  private extraerFactores(raw: string | null): string[] {
    if (!raw) {
      return ['Modelo sin variables explicativas visibles'];
    }

    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      const entries = Object.entries(data).slice(0, 6);
      if (!entries.length) {
        return ['Variables registradas sin detalle interpretable'];
      }

      return entries.map(([key, value]) => `${this.humanizarKey(key)}: ${String(value)}`);
    } catch {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
  }

  private construirJustificacionRiesgo(
    nivel: NivelRiesgo,
    variables: Record<string, unknown>
  ): string {
    const asistencia = this.obtenerNumero(variables['porcentaje_asistencia']);
    const promedio = this.obtenerNumero(variables['promedio_general']);
    const notaMinima = this.obtenerNumero(variables['nota_minima']);
    const cursosDesaprobados = this.obtenerNumero(variables['cantidad_cursos_desaprobados']);
    const notasDesaprobadas = this.obtenerNumero(variables['cantidad_notas_desaprobadas_total'])
      ?? this.obtenerNumero(variables['cantidad_notas_desaprobadas']);
    const notasCriticas = this.obtenerNumero(variables['cantidad_notas_criticas_total'])
      ?? this.obtenerNumero(variables['cantidad_notas_criticas']);
    const peorNota = this.obtenerNumero(variables['peor_nota_periodo'])
      ?? this.obtenerNumero(variables['nota_minima_curso'])
      ?? notaMinima;
    const notaExamen = this.obtenerNumero(variables['nota_examen_principal']);

    const hayAsistenciaAlta = asistencia != null && asistencia >= 85;
    const hayRendimientoFragil =
      (promedio != null && promedio < 12.5) ||
      (peorNota != null && peorNota <= 10.5) ||
      (notaExamen != null && notaExamen <= 10.5) ||
      (notasCriticas ?? 0) >= 1 ||
      (notasDesaprobadas ?? 0) >= 2 ||
      (cursosDesaprobados ?? 0) > 0;

    if (hayAsistenciaAlta && hayRendimientoFragil) {
      const piezas = [
        promedio != null ? `promedio ${this.formatearNumero(promedio)}` : null,
        peorNota != null ? `nota mínima ${this.formatearNumero(peorNota)}` : null,
        notaExamen != null ? `examen ${this.formatearNumero(notaExamen)}` : null
      ].filter(Boolean);

      return nivel === 'ALTO'
        ? `Asiste regularmente (${this.formatearNumero(asistencia)}%), pero sus resultados siguen siendo frágiles${piezas.length ? `: ${piezas.join(', ')}` : ''}. Requiere refuerzo académico prioritario.`
        : `Mantiene buena asistencia (${this.formatearNumero(asistencia)}%), pero aún presenta fragilidad académica${piezas.length ? `: ${piezas.join(', ')}` : ''}.`;
    }

    if (asistencia != null && asistencia < 60) {
      return nivel === 'ALTO'
        ? `Alto riesgo de fracaso por asistencia crítica (${this.formatearNumero(asistencia)}%).`
        : `Seguimiento por asistencia baja (${this.formatearNumero(asistencia)}%).`;
    }

    if (
      promedio != null &&
      (
        promedio <= 10.5 ||
        notaMinima != null && notaMinima <= 10.5 ||
        peorNota != null && peorNota <= 10.5 ||
        notaExamen != null && notaExamen <= 10.5 ||
        (cursosDesaprobados ?? 0) > 0
      )
    ) {
      const detallePromedio = [
        promedio != null ? `promedio ${this.formatearNumero(promedio)}` : null,
        peorNota != null ? `nota mínima ${this.formatearNumero(peorNota)}` : null,
        notaExamen != null ? `examen ${this.formatearNumero(notaExamen)}` : null
      ]
        .filter(Boolean)
        .join(', ');
      return nivel === 'ALTO'
        ? `Alto riesgo de fracaso por rendimiento académico comprometido${detallePromedio ? `: ${detallePromedio}` : ''}.`
        : `Seguimiento por rendimiento académico vulnerable${detallePromedio ? `: ${detallePromedio}` : ''}.`;
    }

    if (asistencia != null && asistencia < 80 && promedio != null && promedio < 14) {
      return `Riesgo ${nivel.toLowerCase()} de fracaso por combinación de asistencia (${this.formatearNumero(asistencia)}%) y rendimiento (${this.formatearNumero(promedio)}).`;
    }

    if (nivel === 'ALTO') {
      return 'Alto riesgo de fracaso detectado por el modelo con prioridad de seguimiento.';
    }

    if (nivel === 'MEDIO') {
      return 'Riesgo medio de fracaso con necesidad de seguimiento cercano.';
    }

    return 'Riesgo bajo de fracaso con indicadores actualmente controlados.';
  }

  private detectarFactorDominante(
    nivel: NivelRiesgo,
    variables: Record<string, unknown>
  ): 'asistencia' | 'rendimiento' | 'mixto' | 'controlado' {
    const asistencia = this.obtenerNumero(variables['porcentaje_asistencia']);
    const promedio = this.obtenerNumero(variables['promedio_general']);
    const notaMinima = this.obtenerNumero(variables['nota_minima']);
    const cursosDesaprobados = this.obtenerNumero(variables['cantidad_cursos_desaprobados']);
    const notasDesaprobadas = this.obtenerNumero(variables['cantidad_notas_desaprobadas_total'])
      ?? this.obtenerNumero(variables['cantidad_notas_desaprobadas']);
    const notasCriticas = this.obtenerNumero(variables['cantidad_notas_criticas_total'])
      ?? this.obtenerNumero(variables['cantidad_notas_criticas']);
    const peorNota = this.obtenerNumero(variables['peor_nota_periodo'])
      ?? this.obtenerNumero(variables['nota_minima_curso'])
      ?? notaMinima;
    const notaExamen = this.obtenerNumero(variables['nota_examen_principal']);

    const asistenciaCritica = asistencia != null && asistencia < 60;
    const rendimientoBajo =
      promedio != null &&
      (
        promedio <= 10.5 ||
        notaMinima != null && notaMinima <= 10.5 ||
        peorNota != null && peorNota <= 10.5 ||
        notaExamen != null && notaExamen <= 10.5 ||
        (cursosDesaprobados ?? 0) > 0 ||
        (notasCriticas ?? 0) >= 1 ||
        (notasDesaprobadas ?? 0) >= 2
      );
    const combinado = asistencia != null && asistencia < 80 && promedio != null && promedio < 14;
    const aprendeInsuficiente = asistencia != null && asistencia >= 85 && rendimientoBajo;

    if (asistenciaCritica && (rendimientoBajo || combinado)) {
      return 'mixto';
    }

    if (aprendeInsuficiente) {
      return 'rendimiento';
    }

    if (asistenciaCritica) {
      return 'asistencia';
    }

    if (rendimientoBajo || combinado) {
      return 'rendimiento';
    }

    return nivel === 'BAJO' ? 'controlado' : 'mixto';
  }

  private parsearVariables(raw: string | null): Record<string, unknown> {
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private obtenerNumero(value: unknown): number | null {
    const numero = Number(value);
    return Number.isFinite(numero) ? numero : null;
  }

  private humanizarKey(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }

  private obtenerClaveOrdenAlumno(nombreCompleto: string | null | undefined): string {
    const limpio = (nombreCompleto ?? '').trim().replace(/\s+/g, ' ');
    if (!limpio) {
      return '';
    }

    const partes = limpio.split(' ');
    if (partes.length <= 2) {
      return limpio.toLowerCase();
    }

    const nombres = partes.slice(0, -2).join(' ');
    const apellidos = partes.slice(-2).join(' ');
    return `${apellidos} ${nombres}`.trim().toLowerCase();
  }

  private promedio(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    return Math.round((values.reduce((acc, value) => acc + value, 0) / values.length) * 10) / 10;
  }

  formatearNumero(value: number | null | undefined): string {
    return Number(value ?? 0).toFixed(1);
  }

  etiquetaSeccion(seccion: Seccion | null): string {
    if (!seccion) {
      return 'Sin sección';
    }

    return `${seccion.gradoNombre ?? ''} ${seccion.nombre}`.trim();
  }

  tonoNivel(nivel: NivelRiesgo): 'high' | 'medium' | 'low' {
    if (nivel === 'ALTO') {
      return 'high';
    }

    if (nivel === 'MEDIO') {
      return 'medium';
    }

    return 'low';
  }

  private configurarFiltros(periodos: CorteSeguimiento[], secciones: Seccion[]): void {
    this.periodosEvaluacion.set(periodos);
    this.secciones.set(secciones);
    this.seccionSeleccionadaId.set(secciones[0]?.id ?? null);
    this.ajustarPeriodoTerminoSegunSeccion();
    this.ajustarPeriodoSegunSeccion();
    this.cargandoFiltros.set(false);

    if (this.periodoEvaluacionSeleccionadoId() && this.seccionSeleccionadaId()) {
      this.cargarVista();
    }

    if (!this.estadoInicialPresentado && this.seccionSeleccionadaId()) {
      this.estadoInicialPresentado = true;
      this.abrirEstadoCortes();
    }
  }

  private ajustarPeriodoTerminoSegunSeccion(): void {
    const disponibles = this.periodosTerminoDisponibles();
    const seleccionado = this.periodoEvaluacionSeleccionadoIdTermino();
    if (!disponibles.some((periodo) => periodo.id === seleccionado)) {
      this.periodoEvaluacionSeleccionadoIdTermino.set(
        this.resolverPeriodoEvaluacionVigente(disponibles)?.id ?? null
      );
    }
  }

  private ajustarPeriodoSegunSeccion(): void {
    const periodoActual = this.periodoEvaluacionSeleccionadoId();
    const disponibles = this.periodosEvaluacionDisponibles();
    const existe = disponibles.some((periodo) => periodo.id === periodoActual);

    if (!existe) {
      this.periodoEvaluacionSeleccionadoId.set(this.seleccionarCortePorFecha(disponibles)?.id ?? null);
    }
  }

  private seleccionarCortePorFecha(periodos: CorteSeguimiento[]): CorteSeguimiento | null {
    if (!periodos.length) return null;
    const hoy = this.fechaLocalHoy();
    return periodos.find((corte) => corte.fechaCorte === hoy)
      ?? [...periodos].filter((corte) => corte.fechaCorte < hoy).at(-1)
      ?? periodos[0];
  }

  private fechaLocalHoy(): string {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }

  private resolverPeriodoAcademicoActual(periodos: PeriodoAcademico[]): PeriodoAcademico | null {
    const activo = periodos.find((periodo) => (periodo.estado ?? '').toUpperCase() === 'ACTIVO');
    if (activo) {
      return activo;
    }

    const anioActual = new Date().getFullYear();
    return (
      periodos.find((periodo) => periodo.anio === anioActual) ??
      [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
      null
    );
  }

  private resolverPeriodoEvaluacionVigente(periodos: PeriodoEvaluacion[]): PeriodoEvaluacion | null {
    if (!periodos.length) return null;
    const hoy = this.fechaLocalHoy();
    const ordenados = [...periodos].sort((a, b) => a.numero - b.numero);
    return ordenados.find((periodo) => {
      const inicio = periodo.fechaInicio.slice(0, 10);
      const fin = periodo.fechaFin.slice(0, 10);
      return inicio <= hoy && hoy <= fin;
    })
      ?? ordenados.find((periodo) => (periodo.estado ?? '').toUpperCase() === 'ACTIVO')
      ?? [...ordenados].filter((periodo) => periodo.fechaFin.slice(0, 10) < hoy).at(-1)
      ?? ordenados[0];
  }

}
