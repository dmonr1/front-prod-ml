import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
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
}

@Component({
  selector: 'app-predicciones',
  imports: [Shell, DecimalPipe],
  templateUrl: './predicciones.html',
  styleUrl: './predicciones.scss'
})
export class Predicciones {
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

  readonly prediccionesFiltradas = computed(() => {
    const query = this.busqueda().trim().toLowerCase();

    return this.datasetActivo().filter((item) => {
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

  cambiarVista(vista: VistaPrediccion): void {
    if (this.vistaActiva() === vista) {
      return;
    }

    this.vistaActiva.set(vista);
    this.asegurarSeleccion();
  }

  onPeriodoEvaluacionChange(value: string): void {
    this.periodoEvaluacionSeleccionadoId.set(Number(value));
    this.cargarVista();
  }

  onSeccionChange(value: string): void {
    this.seccionSeleccionadaId.set(Number(value));
    this.ajustarPeriodoSegunSeccion();
    this.cargarVista();
  }

  onBusqueda(value: string): void {
    this.busqueda.set(value);
    this.asegurarSeleccion();
  }

  seleccionarPrediccion(id: number): void {
    this.prediccionSeleccionadaId.set(id);
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

  private mapearPrediccion(
    item: PrediccionRiesgo,
    alertas: AlertaSeguimiento[],
    recomendaciones: RecomendacionSeguimiento[]
  ): PrediccionVista {
    const nivel = this.normalizarNivel(item.nivelRiesgo);
    const alerta = this.buscarAlerta(item, alertas);
    const recomendacion = this.buscarRecomendacion(item, recomendaciones);

    return {
      ...item,
      nivelRiesgoNormalizado: nivel,
      puntaje: Number(item.puntajeRiesgo ?? 0),
      factores: this.extraerFactores(item.variablesEntrada),
      alertaPrincipal:
        alerta?.mensaje ??
        (nivel === 'ALTO'
          ? 'Riesgo alto detectado por el modelo.'
          : nivel === 'MEDIO'
            ? 'Riesgo medio con necesidad de seguimiento.'
            : 'Sin alerta critica para este registro.'),
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
