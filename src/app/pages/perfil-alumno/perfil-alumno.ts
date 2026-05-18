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

interface PrediccionDetalleVista extends PrediccionRiesgo {
  nivelRiesgoNormalizado: NivelRiesgo;
  puntaje: number;
  factores: string[];
  alertaPrincipal: string;
  recomendacionPrincipal: string;
}

@Component({
  selector: 'app-perfil-alumno',
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

  seleccionarPrediccion(id: number): void {
    this.seleccionadaId.set(id);
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
          .filter((item) =>
            this.periodoEvaluacionId ? item.periodoEvaluacionId === this.periodoEvaluacionId : true
          )
          .map((item) => this.mapearPrediccion(item, alertas, recomendaciones));

        this.predicciones.set(detalle);
        this.seleccionadaId.set(detalle[0]?.id ?? null);
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

  private formatearNumero(value: number | null | undefined): string {
    return Number(value ?? 0).toFixed(1);
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
