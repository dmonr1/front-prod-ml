import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Shell } from '../../layouts/shell/shell';
import {
  AlertaSeguimiento,
  AlertaSeguimientoService,
  RecomendacionSeguimiento
} from '../../services/alerta/alerta-seguimiento.service';
import { PrediccionRiesgo, PrediccionService } from '../../services/prediccion/prediccion.service';

type NivelRiesgo = 'ALTO' | 'MEDIO' | 'BAJO';
type TonoFactor = 'high' | 'medium' | 'low';

interface PrediccionDetalleVista extends PrediccionRiesgo {
  nivelRiesgoNormalizado: NivelRiesgo;
  puntaje: number;
  factores: string[];
  alertaPrincipal: string;
  recomendacionPrincipal: string;
}

interface FactorAnalitico {
  titulo: string;
  subtitulo: string;
  valor: number;
  tono: TonoFactor;
  etiqueta: string;
}

interface PuntoEvolucion {
  etiqueta: string;
  valor: number;
}

interface RecomendacionPersonalizada {
  titulo: string;
  descripcion: string;
  accion: string;
  icono: string;
  tono: TonoFactor;
}

interface PeriodoPerfilItem {
  id: number;
  nombre: string;
  numero: number;
}

@Component({
  selector: 'app-perfil-alumno',
  standalone: true,
  imports: [Shell, RouterLink, DecimalPipe],
  templateUrl: './perfil-alumno.html',
  styleUrl: './perfil-alumno.scss'
})
export class PerfilAlumno {
  private readonly route = inject(ActivatedRoute);
  private readonly prediccionService = inject(PrediccionService);
  private readonly alertaService = inject(AlertaSeguimientoService);

  readonly alumnoId = Number(this.route.snapshot.paramMap.get('alumnoId'));
  readonly periodoEvaluacionId = Number(this.route.snapshot.queryParamMap.get('periodoEvaluacionId'));
  readonly seccionId = Number(this.route.snapshot.queryParamMap.get('seccionId'));
  readonly vista = this.route.snapshot.queryParamMap.get('vista');

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly predicciones = signal<PrediccionDetalleVista[]>([]);
  readonly recomendacionesCargadas = signal<RecomendacionSeguimiento[]>([]);
  readonly seleccionadaId = signal<number | null>(null);

  constructor() {
    this.cargarPerfil();
  }

  readonly prediccionSeleccionada = computed(() => {
    const actual =
      this.predicciones().find((item) => item.id === this.seleccionadaId()) ??
      this.predicciones()[0] ??
      null;

    if (!actual) {
      return null;
    }

    if (this.vista === 'curso' && actual.cursoId == null) {
      return this.predicciones().find((item) => item.cursoId != null) ?? actual;
    }

    return actual;
  });

  readonly prediccionesGlobales = computed(() =>
    this.predicciones()
      .filter((item) => item.cursoId == null)
      .sort((a, b) => (a.numeroPeriodoEvaluacion ?? 0) - (b.numeroPeriodoEvaluacion ?? 0))
  );

  readonly periodosDisponiblesPerfil = computed<PeriodoPerfilItem[]>(() => {
    const mapa = new Map<number, PeriodoPerfilItem>();

    for (const item of this.predicciones()) {
      if (!item.periodoEvaluacionId) {
        continue;
      }

      if (!mapa.has(item.periodoEvaluacionId)) {
        mapa.set(item.periodoEvaluacionId, {
          id: item.periodoEvaluacionId,
          nombre: item.nombrePeriodoEvaluacion || `Periodo ${item.numeroPeriodoEvaluacion ?? ''}`.trim(),
          numero: item.numeroPeriodoEvaluacion ?? 0
        });
      }
    }

    return [...mapa.values()].sort((a, b) => a.numero - b.numero);
  });

  readonly resumen = computed(() => {
    const registros = this.predicciones();
    const promedio = registros.length
      ? Math.round((registros.reduce((acc, item) => acc + item.puntaje, 0) / registros.length) * 10) / 10
      : 0;

    return {
      total: registros.length,
      alto: registros.filter((item) => item.nivelRiesgoNormalizado === 'ALTO').length,
      medio: registros.filter((item) => item.nivelRiesgoNormalizado === 'MEDIO').length,
      bajo: registros.filter((item) => item.nivelRiesgoNormalizado === 'BAJO').length,
      promedio
    };
  });

  readonly variablesSeleccionadas = computed(() =>
    this.parsearVariables(this.prediccionSeleccionada()?.variablesEntrada ?? null)
  );

  readonly promedioGeneral = computed(() => {
    const promedio = this.obtenerNumero(this.variablesSeleccionadas()['promedio_general']);
    return promedio ?? null;
  });

  readonly porcentajeAsistencia = computed(() => {
    const asistencia = this.obtenerNumero(this.variablesSeleccionadas()['porcentaje_asistencia']);
    return asistencia ?? null;
  });

  readonly tendenciaRiesgo = computed(() => {
    const serie = this.prediccionesGlobales();
    if (serie.length < 2) {
      return {
        titulo: 'En observacion',
        detalle: 'Aun no hay suficientes periodos para comparar',
        tono: 'medium' as TonoFactor
      };
    }

    const primero = serie[0].puntaje;
    const ultimo = serie[serie.length - 1].puntaje;
    const diferencia = Math.round((ultimo - primero) * 10) / 10;

    if (diferencia <= -5) {
      return {
        titulo: 'En descenso',
        detalle: `Bajo ${Math.abs(diferencia).toFixed(1)} pts frente al primer periodo`,
        tono: 'low' as TonoFactor
      };
    }

    if (diferencia >= 5) {
      return {
        titulo: 'En aumento',
        detalle: `Subio ${diferencia.toFixed(1)} pts frente al primer periodo`,
        tono: 'high' as TonoFactor
      };
    }

    return {
      titulo: 'Estable',
      detalle: 'Sin variacion importante entre periodos',
      tono: 'medium' as TonoFactor
    };
  });

  readonly metricasKpi = computed(() => {
    const detalle = this.prediccionSeleccionada();
    if (!detalle) {
      return [];
    }

    return [
      {
        etiqueta: 'Promedio general',
        valor: this.promedioGeneral() == null ? '--' : this.formatearNumero(this.promedioGeneral(), 1),
        ayuda: this.promedioGeneral() != null && this.promedioGeneral()! >= 14 ? 'Buen rendimiento actual' : 'Revisar avance academico',
        tono: this.promedioGeneral() != null && this.promedioGeneral()! >= 14 ? 'low' : 'medium'
      },
      {
        etiqueta: 'Riesgo academico',
        valor: `${detalle.puntaje.toFixed(0)}%`,
        ayuda: detalle.nivelRiesgoNormalizado === 'ALTO' ? 'Probabilidad alta de riesgo' : detalle.nivelRiesgoNormalizado === 'MEDIO' ? 'Seguimiento preventivo' : 'Riesgo actualmente controlado',
        tono: this.mapearNivelATono(detalle.nivelRiesgoNormalizado)
      },
      {
        etiqueta: 'Tendencia',
        valor: this.tendenciaRiesgo().titulo,
        ayuda: this.tendenciaRiesgo().detalle,
        tono: this.tendenciaRiesgo().tono
      },
      {
        etiqueta: 'Asistencia',
        valor: this.porcentajeAsistencia() == null ? '--' : `${this.formatearNumero(this.porcentajeAsistencia(), 0)}%`,
        ayuda: this.porcentajeAsistencia() != null && this.porcentajeAsistencia()! >= 85 ? 'Asistencia adecuada' : 'Requiere seguimiento',
        tono: this.porcentajeAsistencia() != null && this.porcentajeAsistencia()! >= 85 ? 'low' : this.porcentajeAsistencia() != null && this.porcentajeAsistencia()! >= 70 ? 'medium' : 'high'
      }
    ];
  });

  readonly factoresAnaliticos = computed<FactorAnalitico[]>(() => {
    const variables = this.variablesSeleccionadas();

    const promedio = this.obtenerNumero(variables['promedio_general']);
    const asistencia = this.obtenerNumero(variables['porcentaje_asistencia']);
    const notaMinima = this.obtenerNumero(variables['nota_minima']);
    const desaprobados = this.obtenerNumero(variables['cantidad_cursos_desaprobados']);

    const factores: FactorAnalitico[] = [];

    if (promedio != null) {
      factores.push({
        titulo: 'Promedio general actual',
        subtitulo: `Promedio ${this.formatearNumero(promedio, 1)}`,
        valor: Math.max(0, Math.min(100, (promedio / 20) * 100)),
        tono: promedio >= 14 ? 'low' : promedio >= 11 ? 'medium' : 'high',
        etiqueta: promedio >= 14 ? 'Bajo' : promedio >= 11 ? 'Medio' : 'Alto'
      });
    }

    if (asistencia != null) {
      factores.push({
        titulo: 'Asistencia del periodo',
        subtitulo: `${this.formatearNumero(asistencia, 0)}% de asistencia`,
        valor: Math.max(0, Math.min(100, asistencia)),
        tono: asistencia >= 85 ? 'low' : asistencia >= 70 ? 'medium' : 'high',
        etiqueta: asistencia >= 85 ? 'Bajo' : asistencia >= 70 ? 'Medio' : 'Alto'
      });
    }

    if (notaMinima != null) {
      factores.push({
        titulo: 'Nota minima registrada',
        subtitulo: `Nota minima ${this.formatearNumero(notaMinima, 1)}`,
        valor: Math.max(0, Math.min(100, (notaMinima / 20) * 100)),
        tono: notaMinima >= 14 ? 'low' : notaMinima >= 11 ? 'medium' : 'high',
        etiqueta: notaMinima >= 14 ? 'Bajo' : notaMinima >= 11 ? 'Medio' : 'Alto'
      });
    }

    if (desaprobados != null) {
      const riesgoCursos = desaprobados <= 0 ? 'low' : desaprobados === 1 ? 'medium' : 'high';
      factores.push({
        titulo: 'Cursos desaprobados',
        subtitulo: `${desaprobados} cursos con riesgo`,
        valor: Math.max(8, Math.min(100, desaprobados * 35)),
        tono: riesgoCursos,
        etiqueta: riesgoCursos === 'low' ? 'Bajo' : riesgoCursos === 'medium' ? 'Medio' : 'Alto'
      });
    }

    return factores.slice(0, 4);
  });

  readonly evolucionRiesgo = computed<PuntoEvolucion[]>(() =>
    this.prediccionesGlobales().map((item) => ({
      etiqueta: item.nombrePeriodoEvaluacion || `P${item.numeroPeriodoEvaluacion ?? ''}`,
      valor: Number(item.puntaje ?? 0)
    }))
  );

  readonly svgEvolucion = computed(() => {
    const puntos = this.evolucionRiesgo();
    if (!puntos.length) {
      return { path: '', points: [] as Array<{ x: number; y: number; valor: number; etiqueta: string }> };
    }

    const width = 360;
    const height = 220;
    const paddingX = 24;
    const paddingTop = 18;
    const paddingBottom = 24;
    const stepX = puntos.length > 1 ? (width - paddingX * 2) / (puntos.length - 1) : 0;

    const mapped = puntos.map((punto, index) => {
      const x = paddingX + stepX * index;
      const y = paddingTop + ((100 - punto.valor) / 100) * (height - paddingTop - paddingBottom);
      return { ...punto, x, y };
    });

    const path = mapped
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return { path, points: mapped };
  });

  readonly recomendacionesPersonalizadas = computed<RecomendacionPersonalizada[]>(() => {
    const detalle = this.prediccionSeleccionada();
    const actuales: RecomendacionPersonalizada[] = this.recomendacionesCargadas()
      .filter((entry) => entry.alumnoId === this.alumnoId)
      .slice(0, 3)
      .map((entry, index) => ({
        titulo: entry.titulo || `Recomendacion ${index + 1}`,
        descripcion: entry.descripcion,
        accion: 'Ver sugerencias',
        icono: index === 0 ? 'fa-solid fa-user-check' : index === 1 ? 'fa-solid fa-calendar-check' : 'fa-solid fa-book-open-reader',
        tono: index === 0 ? 'high' as TonoFactor : index === 1 ? 'medium' as TonoFactor : 'low' as TonoFactor
      }));

    if (actuales.length) {
      return actuales;
    }

    const asistencia = this.porcentajeAsistencia();
    const promedio = this.promedioGeneral();
    const riesgo = detalle?.nivelRiesgoNormalizado ?? 'BAJO';
    const recomendaciones: RecomendacionPersonalizada[] = [];

    if (asistencia != null && asistencia < 85) {
      recomendaciones.push({
        titulo: 'Mejora tu asistencia',
        descripcion: 'Tu porcentaje de asistencia esta por debajo del nivel recomendado para sostener el avance del periodo.',
        accion: 'Ver sugerencias',
        icono: 'fa-solid fa-user-check',
        tono: asistencia < 70 ? 'high' : 'medium'
      });
    }

    if (promedio != null && promedio < 14) {
      recomendaciones.push({
        titulo: 'Refuerza tus bases',
        descripcion: 'Organiza repasos sobre los cursos donde el rendimiento actual necesita consolidarse.',
        accion: 'Ver sugerencias',
        icono: 'fa-solid fa-book-open-reader',
        tono: promedio < 11 ? 'high' : 'medium'
      });
    }

    if (riesgo !== 'BAJO') {
      recomendaciones.push({
        titulo: 'Organiza tu tiempo',
        descripcion: 'Planifica una rutina de estudio semanal y prioriza tareas cercanas para evitar acumulacion.',
        accion: 'Ver sugerencias',
        icono: 'fa-solid fa-calendar-check',
        tono: 'medium'
      });
    }

    if (!recomendaciones.length) {
      recomendaciones.push(
        {
          titulo: 'Mantiene tu ritmo',
          descripcion: 'Tus indicadores actuales estan controlados. Conserva constancia en asistencia y estudio.',
          accion: 'Ver seguimiento',
          icono: 'fa-solid fa-shield-heart',
          tono: 'low'
        },
        {
          titulo: 'Sostiene tus avances',
          descripcion: 'Sigue reforzando tus cursos principales para conservar un riesgo academico bajo.',
          accion: 'Ver sugerencias',
          icono: 'fa-solid fa-book-open',
          tono: 'low'
        },
        {
          titulo: 'Anticipa el siguiente periodo',
          descripcion: 'Prepara tus apuntes y metas para el proximo corte de evaluacion.',
          accion: 'Ver sugerencias',
          icono: 'fa-solid fa-lightbulb',
          tono: 'medium'
        }
      );
    }

    return recomendaciones.slice(0, 3);
  });

  readonly avatarIniciales = computed(() => {
    const nombre = this.prediccionSeleccionada()?.alumnoNombreCompleto ?? '';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  });

  seleccionarPrediccion(id: number): void {
    this.seleccionadaId.set(id);
  }

  seleccionarPeriodoPerfil(periodoId: number): void {
    const candidato =
      this.predicciones().find((item) => {
        const coincidePeriodo = item.periodoEvaluacionId === periodoId;
        const coincideVista = this.vista === 'curso' ? item.cursoId != null : item.cursoId == null;
        return coincidePeriodo && coincideVista;
      }) ??
      this.predicciones().find((item) => item.periodoEvaluacionId === periodoId) ??
      null;

    if (candidato) {
      this.seleccionadaId.set(candidato.id);
    }
  }

  ringStyle(puntaje: number, nivel: NivelRiesgo): string {
    const porcentaje = Math.max(0, Math.min(100, puntaje));
    const color =
      nivel === 'ALTO' ? '#ef4444' : nivel === 'MEDIO' ? '#f59e0b' : '#10b981';

    return `background: conic-gradient(${color} 0 ${porcentaje}%, #e7eef9 ${porcentaje}% 100%);`;
  }

  obtenerInicialPeriodo(nombre: string | null | undefined): string {
    if (!nombre) {
      return 'PERIODO';
    }

    const match = nombre.match(/\d+/);
    return match ? `PERIODO ${match[0]}` : nombre.toUpperCase();
  }

  private cargarPerfil(): void {
    if (!this.alumnoId) {
      this.cargando.set(false);
      this.error.set('Selecciona un alumno desde Predicciones para abrir su ficha.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    const alertas$ =
      this.periodoEvaluacionId && this.seccionId
        ? this.alertaService.listarAlertas(this.periodoEvaluacionId, this.seccionId)
        : of<AlertaSeguimiento[]>([]);

    const recomendaciones$ =
      this.periodoEvaluacionId && this.seccionId
        ? this.alertaService.listarRecomendaciones(this.periodoEvaluacionId, this.seccionId)
        : of<RecomendacionSeguimiento[]>([]);

    forkJoin({
      predicciones: this.prediccionService.listarPorAlumno(this.alumnoId),
      alertas: alertas$,
      recomendaciones: recomendaciones$
    }).subscribe({
      next: ({ predicciones, alertas, recomendaciones }) => {
        const detalle = predicciones
          .map((item) => this.mapearPrediccion(item, alertas, recomendaciones))
          .sort((a, b) => {
            if ((a.cursoId == null) !== (b.cursoId == null)) {
              return a.cursoId == null ? -1 : 1;
            }

            if ((a.numeroPeriodoEvaluacion ?? 0) !== (b.numeroPeriodoEvaluacion ?? 0)) {
              return (b.numeroPeriodoEvaluacion ?? 0) - (a.numeroPeriodoEvaluacion ?? 0);
            }

            return (a.curso ?? '').localeCompare(b.curso ?? '');
          });

        this.predicciones.set(detalle);
        this.recomendacionesCargadas.set(recomendaciones);
        const seleccionInicial =
          detalle.find((item) => {
            const coincidePeriodo = this.periodoEvaluacionId
              ? item.periodoEvaluacionId === this.periodoEvaluacionId
              : true;
            const coincideVista = this.vista === 'curso' ? item.cursoId != null : item.cursoId == null;
            return coincidePeriodo && coincideVista;
          }) ??
          detalle.find((item) => this.vista === 'curso' ? item.cursoId != null : item.cursoId == null) ??
          detalle[0] ??
          null;

        this.seleccionadaId.set(seleccionInicial?.id ?? null);
        this.cargando.set(false);

        if (!detalle.length) {
          this.error.set('No se encontraron predicciones para este alumno en el periodo seleccionado.');
        }
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la ficha del alumno.');
      }
    });
  }

  private mapearPrediccion(
    item: PrediccionRiesgo,
    alertas: AlertaSeguimiento[],
    recomendaciones: RecomendacionSeguimiento[]
  ): PrediccionDetalleVista {
    const nivel = this.normalizarNivel(item.nivelRiesgo);
    const variables = this.parsearVariables(item.variablesEntrada);
    const alerta = alertas.find(
      (entry) =>
        entry.alumnoId === item.alumnoId &&
        (item.cursoId == null ? entry.cursoId == null : entry.cursoId === item.cursoId)
    );

    const recomendacion = recomendaciones.find(
      (entry) =>
        entry.alumnoId === item.alumnoId &&
        (item.cursoId == null ? entry.cursoId == null : entry.cursoId === item.cursoId)
    );

    return {
      ...item,
      puntaje: Number(item.puntajeRiesgo ?? 0),
      nivelRiesgoNormalizado: nivel,
      factores: this.extraerFactores(item.variablesEntrada),
      alertaPrincipal: alerta?.mensaje ?? this.construirJustificacionRiesgo(nivel, variables),
      recomendacionPrincipal:
        recomendacion?.descripcion ?? 'Sin recomendacion registrada para este caso.'
    };
  }

  private normalizarNivel(nivel: string | null | undefined): NivelRiesgo {
    if (nivel === 'ALTO' || nivel === 'MEDIO') {
      return nivel;
    }
    return 'BAJO';
  }

  private mapearNivelATono(nivel: NivelRiesgo): TonoFactor {
    return nivel === 'ALTO' ? 'high' : nivel === 'MEDIO' ? 'medium' : 'low';
  }

  private extraerFactores(raw: string | null): string[] {
    if (!raw) {
      return ['Modelo sin variables explicativas visibles'];
    }

    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(data)
        .slice(0, 8)
        .map(([key, value]) => `${this.humanizarKey(key)}: ${String(value)}`);
    } catch {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8);
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
        ? `Alto riesgo de fracaso por asistencia critica (${this.formatearNumero(asistencia, 0)}%).`
        : `Seguimiento por asistencia baja (${this.formatearNumero(asistencia, 0)}%).`;
    }

    if (
      promedio != null &&
      (promedio <= 10.5 || (notaMinima != null && notaMinima <= 10.5) || (cursosDesaprobados ?? 0) > 0)
    ) {
      const detallePromedio = promedio != null ? `promedio ${this.formatearNumero(promedio, 1)}` : 'rendimiento bajo';
      return nivel === 'ALTO'
        ? `Alto riesgo de fracaso por rendimiento: ${detallePromedio}.`
        : `Seguimiento por rendimiento academico: ${detallePromedio}.`;
    }

    if (asistencia != null && asistencia < 80 && promedio != null && promedio < 14) {
      return `Riesgo ${nivel.toLowerCase()} de fracaso por combinacion de asistencia (${this.formatearNumero(asistencia, 0)}%) y rendimiento (${this.formatearNumero(promedio, 1)}).`;
    }

    if (nivel === 'ALTO') {
      return 'Alto riesgo de fracaso detectado por el modelo con prioridad de seguimiento.';
    }

    if (nivel === 'MEDIO') {
      return 'Riesgo medio de fracaso con necesidad de seguimiento cercano.';
    }

    return 'Riesgo bajo de fracaso con indicadores actualmente controlados.';
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

  private formatearNumero(value: number | null | undefined, decimales = 1): string {
    return Number(value ?? 0).toFixed(decimales);
  }

  private humanizarKey(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }
}
