import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { Seccion } from '../../models/seccion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { SeccionService } from '../../services/academico/seccion.service';
import {
  AlertaSeguimiento,
  AlertaSeguimientoService,
  RecomendacionSeguimiento
} from '../../services/alerta/alerta-seguimiento.service';
import { AuthService } from '../../services/auth/auth.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import {
  PrediccionRiesgo,
  PrediccionService,
  ResumenPrediccion
} from '../../services/prediccion/prediccion.service';

type VistaPrediccion = 'global' | 'curso';
type NivelRiesgo = 'ALTO' | 'MEDIO' | 'BAJO';

interface PrediccionVista extends PrediccionRiesgo {
  nivelRiesgoNormalizado: NivelRiesgo;
  puntaje: number;
  factores: string[];
  alertaPrincipal: string;
  recomendacionPrincipal: string;
  tendencia: 'Critico' | 'Controlado';
  factorDominante: 'asistencia' | 'rendimiento' | 'mixto' | 'controlado';
}

@Component({
  selector: 'app-predicciones',
  imports: [Shell, DecimalPipe],
  templateUrl: './predicciones.html',
  styleUrl: './predicciones.scss'
})
export class Predicciones {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly seccionService = inject(SeccionService);
  private readonly tutoriaService = inject(TutoriaService);
  private readonly prediccionService = inject(PrediccionService);
  private readonly alertaSeguimientoService = inject(AlertaSeguimientoService);
  private readonly currentYear = new Date().getFullYear();

  readonly vistaActiva = signal<VistaPrediccion>('global');
  readonly cargandoFiltros = signal(true);
  readonly cargandoVista = signal(false);
  readonly error = signal<string | null>(null);

  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly seccionSeleccionadaId = signal<number | null>(null);
  readonly cursoSeleccionadoId = signal<number | null>(null);
  readonly busqueda = signal('');
  readonly prediccionSeleccionadaId = signal<number | null>(null);

  readonly resumenApi = signal<ResumenPrediccion | null>(null);
  readonly prediccionesGlobales = signal<PrediccionVista[]>([]);
  readonly prediccionesCurso = signal<PrediccionVista[]>([]);

  constructor() {
    this.cargarFiltros();
  }

  readonly periodoEvaluacionSeleccionado = computed(
    () =>
      this.periodosEvaluacionDisponibles().find(
        (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
      ) ?? null
  );

  readonly seccionSeleccionada = computed(
    () => this.secciones().find((seccion) => seccion.id === this.seccionSeleccionadaId()) ?? null
  );

  readonly periodosEvaluacionDisponibles = computed(() => {
    const seccion = this.seccionSeleccionada();
    const periodos = this.periodosEvaluacion();

    if (!seccion?.periodoAcademicoId) {
      return periodos;
    }

    return periodos
      .filter((periodo) => periodo.periodoAcademicoId === seccion.periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero);
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

    return this.datasetActivo().filter((item) => {
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
    });
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

    if (!resumen) {
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
        label: 'Alumnos criticos',
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
        value: this.prediccionSeleccionada()?.modeloVersion || 'Sin version',
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
        label: 'Meta de asistencia del periodo',
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
      return 'Todos los cursos';
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
          detail: 'Casos visibles en esta seccion.',
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
          detail: 'Probabilidad promedio de fracaso en la seccion.',
          icon: 'fa-solid fa-chart-line',
          tone: 'neutral'
        },
        {
          label: 'Riesgo alto',
          value: `${resumen.alto}`,
          detail: 'Alumnos con atencion inmediata.',
          icon: 'fa-solid fa-triangle-exclamation',
          tone: 'high'
        }
      ] as const;
    }

    return [
      {
        label: 'Curso seleccionado',
        value: this.cursoSeleccionadoNombre() ?? 'Curso',
        detail: 'Filtro activo del analisis por curso.',
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
        detalle: 'La seccion requiere seguimiento prioritario.',
        tone: 'high' as const
      };
    }

    if (promedio >= 40) {
      return {
        nivel: 'Medio',
        detalle: 'La seccion necesita monitoreo cercano.',
        tone: 'medium' as const
      };
    }

    return {
      nivel: 'Bajo',
      detalle: 'La seccion mantiene un riesgo controlado.',
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
  }

  onPeriodoEvaluacionChange(value: string): void {
    this.periodoEvaluacionSeleccionadoId.set(Number(value));
    this.cargarVista();
  }

  onSeccionChange(value: string): void {
    this.seccionSeleccionadaId.set(Number(value));
    this.cursoSeleccionadoId.set(null);
    this.ajustarPeriodoSegunSeccion();
    this.cargarVista();
  }

  onCursoChange(value: string): void {
    this.cursoSeleccionadoId.set(value ? Number(value) : null);
    this.asegurarSeleccion();
  }

  onBusqueda(value: string): void {
    this.busqueda.set(value);
    this.asegurarSeleccion();
  }

  seleccionarPrediccion(id: number): void {
    this.prediccionSeleccionadaId.set(id);
  }

  verFichaAlumno(alumnoId: number): void {
    void this.router.navigate(['/alumno', alumnoId], {
      queryParams: {
        periodoEvaluacionId: this.periodoEvaluacionSeleccionadoId(),
        seccionId: this.seccionSeleccionadaId(),
        vista: this.vistaActiva()
      }
    });
  }

  private cargarFiltros(): void {
    this.cargandoFiltros.set(true);
    this.error.set(null);

    forkJoin({
      periodosEvaluacion: this.periodoEvaluacionService.listar(),
      secciones: this.seccionService.listar(),
      periodosAcademicos: this.periodoAcademicoService.listar()
    }).subscribe({
      next: ({ periodosEvaluacion, secciones, periodosAcademicos }) => {
        const periodosActivos = [...periodosEvaluacion]
          .filter((periodo) => periodo.estado !== 'INACTIVO')
          .sort((a, b) => {
            const anio = (b.anioAcademico ?? 0) - (a.anioAcademico ?? 0);
            return anio !== 0 ? anio : a.numero - b.numero;
          });

        const seccionesActivas = [...secciones]
          .filter((seccion) => seccion.estado !== 'INACTIVO')
          .sort((a, b) =>
            `${a.nivelNombre ?? ''}${a.gradoNombre ?? ''}${a.nombre}`.localeCompare(
              `${b.nivelNombre ?? ''}${b.gradoNombre ?? ''}${b.nombre}`
            )
          );

        const usuario = this.authService.obtenerUsuario();
        const esTutor = Boolean(
          usuario?.esTutor || usuario?.roles.includes('DOCENTE_TUTOR')
        );
        const docenteId = usuario?.docenteId;

        if (esTutor && docenteId) {
          const periodoActual = this.obtenerPeriodoActual(periodosAcademicos);

          if (!periodoActual) {
            this.configurarFiltros(periodosActivos, seccionesActivas);
            return;
          }

          this.tutoriaService.listarPorDocente(docenteId, periodoActual.id).subscribe({
            next: (tutorias) => {
              const seccionesTutoradasIds = new Set(
                tutorias
                  .filter((tutoria) => (tutoria.estado ?? 'ACTIVO') === 'ACTIVO')
                  .map((tutoria) => tutoria.seccionId)
              );

              const seccionesTutoradas = seccionesActivas.filter((seccion) =>
                seccionesTutoradasIds.has(seccion.id)
              );

              this.configurarFiltros(
                periodosActivos,
                seccionesTutoradas.length ? seccionesTutoradas : seccionesActivas
              );
            },
            error: () => {
              this.configurarFiltros(periodosActivos, seccionesActivas);
            }
          });
          return;
        }

        this.configurarFiltros(periodosActivos, seccionesActivas);
      },
      error: () => {
        this.cargandoFiltros.set(false);
        this.error.set('No se pudieron cargar los filtros de prediccion.');
      }
    });
  }

  private cargarVista(): void {
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    const seccionId = this.seccionSeleccionadaId();

    if (!periodoEvaluacionId || !seccionId) {
      return;
    }

    this.cargandoVista.set(true);
    this.error.set(null);

    forkJoin({
      resumen: this.prediccionService.obtenerResumen(periodoEvaluacionId, seccionId),
      globales: this.prediccionService.listarGlobales(periodoEvaluacionId, seccionId),
      cursos: this.prediccionService.listarCursos(periodoEvaluacionId, seccionId),
      alertas: this.alertaSeguimientoService.listarAlertas(periodoEvaluacionId, seccionId),
      recomendaciones: this.alertaSeguimientoService.listarRecomendaciones(periodoEvaluacionId, seccionId)
    }).subscribe({
      next: ({ resumen, globales, cursos, alertas, recomendaciones }) => {
        this.resumenApi.set(resumen);
        this.prediccionesGlobales.set(
          globales.map((item) => this.mapearPrediccion(item, alertas, recomendaciones))
        );
        this.prediccionesCurso.set(
          cursos.map((item) => this.mapearPrediccion(item, alertas, recomendaciones))
        );
        this.ajustarCursoSeleccionado();
        this.cargandoVista.set(false);
        this.asegurarSeleccion();
      },
      error: (error) => {
        this.cargandoVista.set(false);
        this.error.set(error?.error?.mensaje ?? 'No se pudieron cargar las predicciones.');
      }
    });
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
          : 'Mantener monitoreo tutorial y seguimiento academico general.'),
      tendencia: nivel === 'ALTO' ? 'Critico' : 'Controlado'
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

    if (asistencia != null && asistencia < 60) {
      return nivel === 'ALTO'
        ? `Alto riesgo de fracaso por asistencia critica (${this.formatearNumero(asistencia)}%).`
        : `Seguimiento por asistencia baja (${this.formatearNumero(asistencia)}%).`;
    }

    if (
      promedio != null &&
      (promedio <= 10.5 || notaMinima != null && notaMinima <= 10.5 || (cursosDesaprobados ?? 0) > 0)
    ) {
      const detallePromedio = promedio != null ? `promedio ${this.formatearNumero(promedio)}` : 'rendimiento bajo';
      return nivel === 'ALTO'
        ? `Alto riesgo de fracaso por rendimiento: ${detallePromedio}.`
        : `Seguimiento por rendimiento academico: ${detallePromedio}.`;
    }

    if (asistencia != null && asistencia < 80 && promedio != null && promedio < 14) {
      return `Riesgo ${nivel.toLowerCase()} de fracaso por combinacion de asistencia (${this.formatearNumero(asistencia)}%) y rendimiento (${this.formatearNumero(promedio)}).`;
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

    const asistenciaCritica = asistencia != null && asistencia < 60;
    const rendimientoBajo =
      promedio != null &&
      (promedio <= 10.5 || notaMinima != null && notaMinima <= 10.5 || (cursosDesaprobados ?? 0) > 0);
    const combinado = asistencia != null && asistencia < 80 && promedio != null && promedio < 14;

    if (asistenciaCritica && (rendimientoBajo || combinado)) {
      return 'mixto';
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
      return 'Sin seccion';
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

  private configurarFiltros(periodos: PeriodoEvaluacion[], secciones: Seccion[]): void {
    this.periodosEvaluacion.set(periodos);
    this.secciones.set(secciones);
    this.seccionSeleccionadaId.set(secciones[0]?.id ?? null);
    this.ajustarPeriodoSegunSeccion();
    this.cargandoFiltros.set(false);

    if (this.periodoEvaluacionSeleccionadoId() && this.seccionSeleccionadaId()) {
      this.cargarVista();
    }
  }

  private ajustarPeriodoSegunSeccion(): void {
    const periodoActual = this.periodoEvaluacionSeleccionadoId();
    const disponibles = this.periodosEvaluacionDisponibles();
    const existe = disponibles.some((periodo) => periodo.id === periodoActual);

    if (!existe) {
      this.periodoEvaluacionSeleccionadoId.set(disponibles[0]?.id ?? null);
    }
  }

  private obtenerPeriodoActual(periodos: PeriodoAcademico[]): PeriodoAcademico | null {
    return (
      periodos.find((periodo) => periodo.anio === this.currentYear) ??
      [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
      null
    );
  }
}
