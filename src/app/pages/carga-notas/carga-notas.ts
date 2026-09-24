import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import {
  ConfiguracionEvaluacionCursoDetalle,
  ConfiguracionEvaluacionCursoItem
} from '../../models/configuracion-evaluacion-curso';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { DetalleNotaEvaluacion, Evaluacion } from '../../models/evaluacion';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AuthService } from '../../services/auth/auth.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { ConfiguracionEvaluacionCursoService } from '../../services/evaluacion/configuracion-evaluacion-curso.service';
import { EvaluacionService } from '../../services/evaluacion/evaluacion.service';
import { formatearMensajeError } from '../../utils/error-formatter';

interface NotaFila {
  matricula: Matricula;
  notas: Record<number, string>;
}

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
  action: 'planificar-fechas' | 'configurar-estructura' | null;
}

interface ConfiguracionEvaluacionEditable extends ConfiguracionEvaluacionCursoItem {
  cantidadActual: number;
}

interface SemanaPlanificacionEvaluaciones {
  clave: string;
  semana: number | null;
  inicio: string | null;
  fin: string | null;
  evaluaciones: Evaluacion[];
}

type PanelConfiguracionEvaluaciones = 'fechas' | 'estructura';

@Component({
  selector: 'app-carga-notas',
  imports: [Shell, RouterLink, FormsModule, CustomAlertComponent],
  templateUrl: './carga-notas.html',
  styleUrl: './carga-notas.scss'
})
export class CargaNotas implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly asignacionService = inject(AsignacionAcademicaService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly matriculaService = inject(MatriculaService);
  private readonly evaluacionService = inject(EvaluacionService);
  private readonly configuracionCursoService = inject(ConfiguracionEvaluacionCursoService);

  readonly asignacionId = Number(this.route.snapshot.paramMap.get('asignacionId'));
  readonly currentYear = new Date().getFullYear();
  readonly cargando = signal(true);
  readonly guardandoNotas = signal(false);
  readonly error = signal<string | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null,
    action: null
  });

  readonly asignacion = signal<AsignacionDocente | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly evaluaciones = signal<Evaluacion[]>([]);
  readonly guardandoFechaEvaluacion = signal<number | null>(null);
  readonly matriculas = signal<Matricula[]>([]);
  readonly filasNotas = signal<NotaFila[]>([]);
  readonly notasPorEvaluacion = signal<Record<number, DetalleNotaEvaluacion[]>>({});
  readonly mostrarConfiguracionEvaluaciones = signal(false);
  readonly panelConfiguracionEvaluaciones = signal<PanelConfiguracionEvaluaciones>('fechas');
  readonly evaluacionFechaSeleccionadaId = signal<number | null>(null);
  readonly cargandoConfiguracion = signal(false);
  readonly guardandoConfiguracion = signal(false);
  readonly errorConfiguracion = signal<string | null>(null);
  readonly detalleConfiguracion = signal<ConfiguracionEvaluacionCursoDetalle | null>(null);
  readonly configuracionesEditables = signal<ConfiguracionEvaluacionEditable[]>([]);
  private readonly autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly autoSaveInFlight = new Map<string, string>();
  private readonly autoSavePending = new Map<string, { matriculaId: number; evaluacionId: number; valor: string }>();
  private readonly periodosProgramacionRevisada = new Set<number>();

  readonly periodosEvaluacionPeriodo = computed(() =>
    this.periodosEvaluacion()
      .filter((periodoEvaluacion) => periodoEvaluacion.periodoAcademicoId === this.asignacion()?.periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero)
  );

  readonly indicePeriodoEvaluacionSeleccionado = computed(() =>
    this.periodosEvaluacionPeriodo().findIndex(
      (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
    )
  );

  readonly periodoEvaluacionSeleccionado = computed(
    () =>
      this.periodosEvaluacionPeriodo().find(
        (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
      ) ?? null
  );

  readonly resumenNotas = computed(() => {
    const notas = this.filasNotas()
      .flatMap((fila) => Object.values(fila.notas))
      .filter((nota) => nota.trim() !== '')
      .map((nota) => Number(nota))
      .filter((nota) => !Number.isNaN(nota));
    const promedio = notas.length
      ? Math.round((notas.reduce((acc, nota) => acc + nota, 0) / notas.length) * 100) / 100
      : 0;
    const totalAlumnos = this.filasNotas().length;
    const totalEvaluaciones = this.evaluaciones().length;
    const notasEsperadas = totalAlumnos * totalEvaluaciones;
    const alumnosCompletos = this.filasNotas().filter((fila) =>
      this.evaluaciones().every((evaluacion) => (fila.notas[evaluacion.id] ?? '').trim() !== '')
    ).length;

    return {
      totalAlumnos,
      totalEvaluaciones,
      notasEsperadas,
      registradas: notas.length,
      promedio,
      alumnosCompletos
    };
  });

  readonly leyendaEvaluaciones = computed(() => {
    const mapa = new Map<string, string>();

    this.evaluaciones().forEach((evaluacion) => {
      const abreviatura = this.abreviarTipoEvaluacion(evaluacion.tipoEvaluacion);
      const nombre = evaluacion.tipoEvaluacion?.trim() || 'Evaluación';
      if (!mapa.has(abreviatura)) {
        mapa.set(abreviatura, nombre);
      }
    });

    return Array.from(mapa.entries()).map(([abreviatura, nombre]) => ({
      abreviatura,
      nombre
    }));
  });

  readonly resumenConfiguracionEvaluaciones = computed(() =>
    this.configuracionesEditables()
      .filter((configuracion) => configuracion.cantidadActual > 0)
      .map((configuracion) => ({
        tipoEvaluacionId: configuracion.tipoEvaluacionId,
        abreviatura: this.abreviarTipoEvaluacion(configuracion.nombreTipoEvaluacion),
        nombre: configuracion.nombreTipoEvaluacion,
        cantidad: configuracion.cantidadActual
      }))
  );

  readonly evaluacionesPendientesFecha = computed(() =>
    this.evaluaciones().filter((evaluacion) => !evaluacion.fechaEvaluacion)
  );

  readonly planificacionPorSemana = computed<SemanaPlanificacionEvaluaciones[]>(() => {
    const periodo = this.periodoEvaluacionSeleccionado();
    if (!periodo) return [];

    const numeroSemanas = Math.max(0, Math.ceil((this.diasEntre(periodo.fechaInicio, periodo.fechaFin) + 1) / 7));
    const semanas = Array.from({ length: numeroSemanas }, (_, indice) => ({
      semana: indice + 1,
      evaluaciones: [] as Evaluacion[]
    }));
    const pendientes: Evaluacion[] = [];
    for (const evaluacion of this.evaluaciones()) {
      if (!evaluacion.fechaEvaluacion) {
        pendientes.push(evaluacion);
        continue;
      }
      const numeroSemana = Math.floor(this.diasEntre(periodo.fechaInicio, evaluacion.fechaEvaluacion) / 7) + 1;
      const semana = semanas[numeroSemana - 1];
      if (semana) semana.evaluaciones.push(evaluacion);
    }

    const grupos: SemanaPlanificacionEvaluaciones[] = semanas.map(({ semana, evaluaciones }) => {
        const inicio = this.sumarDias(periodo.fechaInicio, (semana - 1) * 7);
        const finSemana = this.sumarDias(inicio, 6);
        return {
          clave: `semana-${semana}`,
          semana,
          inicio,
          fin: finSemana > periodo.fechaFin ? periodo.fechaFin : finSemana,
          evaluaciones: this.ordenarEvaluaciones(evaluaciones)
        };
      });

    if (pendientes.length) {
      grupos.push({ clave: 'pendientes', semana: null, inicio: null, fin: null, evaluaciones: this.ordenarEvaluaciones(pendientes) });
    }
    return grupos;
  });

  readonly totalColumnasNotas = computed(() =>
    1 + this.planificacionPorSemana().reduce((total, grupo) => total + Math.max(1, grupo.evaluaciones.length), 0)
  );

  readonly evaluacionFechaSeleccionada = computed<Evaluacion | null>(() =>
    this.evaluaciones().find((evaluacion) => evaluacion.id === this.evaluacionFechaSeleccionadaId())
      ?? this.evaluacionesPendientesFecha()[0]
      ?? this.evaluaciones()[0]
      ?? null
  );

  readonly hayNotasRegistradas = computed(() =>
    Object.values(this.notasPorEvaluacion()).some((detalles) => detalles.length > 0)
  );

  abreviaturaEvaluacion(evaluacion: Evaluacion): string {
    const base = this.abreviarTipoEvaluacion(evaluacion.tipoEvaluacion);
    return `${base}${evaluacion.numeroEvaluacion}`;
  }

  formatoFechaCorta(fecha: string): string {
    const [year, month, day] = fecha.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }

  rangoSemanaPlanificacion(inicio: string, fin: string): string {
    return `${this.formatoFechaCorta(inicio)} – ${this.formatoFechaCorta(fin)}`;
  }

  private diasEntre(inicio: string, fin: string): number {
    const fechaInicio = new Date(`${inicio.slice(0, 10)}T00:00:00`);
    const fechaFin = new Date(`${fin.slice(0, 10)}T00:00:00`);
    return Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / 86_400_000);
  }

  private sumarDias(fecha: string, dias: number): string {
    const [year, month, day] = fecha.slice(0, 10).split('-').map(Number);
    const resultado = new Date(year, month - 1, day + dias);
    return `${resultado.getFullYear()}-${String(resultado.getMonth() + 1).padStart(2, '0')}-${String(resultado.getDate()).padStart(2, '0')}`;
  }

  private ordenarEvaluaciones(evaluaciones: Evaluacion[]): Evaluacion[] {
    return [...evaluaciones].sort((a, b) =>
      (a.fechaEvaluacion ?? '').localeCompare(b.fechaEvaluacion ?? '')
      || a.tipoEvaluacion.localeCompare(b.tipoEvaluacion)
      || a.numeroEvaluacion - b.numeroEvaluacion
    );
  }

  nombreTipoEvaluacionVisible(nombre: string | null): string {
    const valor = (nombre ?? '').trim();
    if (!valor) {
      return 'Evaluación';
    }

    return valor
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letra) => letra.toUpperCase());
  }

  private abreviarTipoEvaluacion(tipo: string | null): string {
    const valor = (tipo ?? '').trim().toUpperCase();
    const mapa: Record<string, string> = {
      EXAMEN: 'EX',
      EXAMEN_DIARIO: 'ED',
      REVISION_CUADERNO: 'RC',
      REVISION_LIBRO: 'RL',
      TAREA_TRABAJO: 'TT',
      EXPOSICION_PARTICIPACION: 'EP'
    };

    if (mapa[valor]) {
      return mapa[valor];
    }

    const palabras = valor
      .replace(/[^A-Z0-9_ ]/g, ' ')
      .split(/[\s_]+/)
      .filter(Boolean);

    return palabras
      .slice(0, 2)
      .map((palabra) => palabra[0])
      .join('') || 'EV';
  }

  ngOnInit(): void {
    this.cargarBase();
  }

  cargarBase(): void {
    const docenteId = this.authService.obtenerUsuario()?.docenteId;

    if (!docenteId) {
      this.cargando.set(false);
      this.error.set('Tu usuario no tiene un docente vinculado.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual =
          periodos.find((periodo) => periodo.anio === this.currentYear) ??
          [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
          null;

        if (!periodoActual) {
          this.cargando.set(false);
          this.error.set('No se encontró un período académico para cargar la asignación.');
          return;
        }

        forkJoin({
          asignaciones: this.asignacionService.listarAsignaciones(docenteId, periodoActual.id),
          periodosEvaluacion: this.periodoEvaluacionService.listar()
        }).subscribe({
          next: ({ asignaciones, periodosEvaluacion }) => {
            const asignacion = asignaciones.find((item) => item.id === this.asignacionId) ?? null;
            this.asignacion.set(asignacion);
            this.periodosEvaluacion.set(periodosEvaluacion);
            this.cargando.set(false);

            if (!asignacion) {
              this.error.set('No se encontró la asignación seleccionada para tu usuario.');
              return;
            }

            const periodosAsignacion = periodosEvaluacion
              .filter((item) => item.periodoAcademicoId === asignacion.periodoAcademicoId)
              .sort((a, b) => a.numero - b.numero);
            const periodoSolicitadoId = Number(this.route.snapshot.queryParamMap.get('periodoEvaluacionId'));
            const hoy = new Date();
            const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
            const periodoInicial = periodosAsignacion.find((item) => item.id === periodoSolicitadoId)
              ?? periodosAsignacion.find((item) => item.fechaInicio.slice(0, 10) <= fechaHoy && fechaHoy <= item.fechaFin.slice(0, 10))
              ?? [...periodosAsignacion]
                .filter((item) => item.fechaInicio.slice(0, 10) <= fechaHoy)
                .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))[0]
              ?? periodosAsignacion[0];
            const evaluacionPendienteId = Number(this.route.snapshot.queryParamMap.get('evaluacionId')) || null;

            if (periodoInicial) {
              if (evaluacionPendienteId) {
                this.panelConfiguracionEvaluaciones.set('fechas');
                this.evaluacionFechaSeleccionadaId.set(evaluacionPendienteId);
                this.mostrarConfiguracionEvaluaciones.set(true);
              }
              this.seleccionarPeriodoEvaluacion(periodoInicial.id);
            }

            this.cargarConfiguracionEvaluaciones();
          },
          error: (error) => {
            this.cargando.set(false);
            this.error.set(
              formatearMensajeError(error, 'No se pudo cargar la información inicial.')
            );
          }
        });
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(
          formatearMensajeError(error, 'No se pudo resolver el período académico actual.')
        );
      }
    });
  }

  seleccionarPeriodoEvaluacion(periodoEvaluacionId: number): void {
    const asignacion = this.asignacion();
    if (!asignacion) {
      return;
    }

    this.periodoEvaluacionSeleccionadoId.set(periodoEvaluacionId);
    this.evaluacionFechaSeleccionadaId.set(null);
    this.evaluaciones.set([]);
    this.notasPorEvaluacion.set({});
    this.filasNotas.set([]);
    this.error.set(null);

    forkJoin({
      evaluaciones: this.evaluacionService.listarEvaluaciones(asignacion.id, periodoEvaluacionId),
      matriculas: this.matriculaService.listar(asignacion.periodoAcademicoId, asignacion.seccionId)
    }).subscribe({
      next: ({ evaluaciones, matriculas }) => {
        this.evaluaciones.set(evaluaciones);
        this.matriculas.set(matriculas);
        const evaluacionPendienteId = Number(this.route.snapshot.queryParamMap.get('evaluacionId'));
        const evaluacionPendiente = evaluaciones.find((item) => item.id === evaluacionPendienteId);
        if (evaluacionPendiente) {
          this.panelConfiguracionEvaluaciones.set('fechas');
          this.evaluacionFechaSeleccionadaId.set(evaluacionPendiente.id);
          this.mostrarConfiguracionEvaluaciones.set(true);
        }
        if (!this.periodosProgramacionRevisada.has(periodoEvaluacionId)) {
          this.periodosProgramacionRevisada.add(periodoEvaluacionId);
          if (!evaluacionPendiente) {
            this.advertirPlanificacionPendiente(evaluaciones);
          }
        }
        if (!evaluaciones.length) {
          this.prepararFilasNotas(matriculas, {});
          return;
        }

        forkJoin(
          evaluaciones.map((evaluacion) =>
            this.evaluacionService.listarNotas(evaluacion.id)
          )
        ).subscribe({
          next: (notasPorEvaluacion) => {
            const mapa: Record<number, DetalleNotaEvaluacion[]> = {};
            evaluaciones.forEach((evaluacion, index) => {
              mapa[evaluacion.id] = notasPorEvaluacion[index] ?? [];
            });
            this.notasPorEvaluacion.set(mapa);
            this.prepararFilasNotas(matriculas, mapa);
          },
          error: (error) => {
            this.error.set(
              formatearMensajeError(error, 'No se pudieron cargar las notas.')
            );
            this.prepararFilasNotas(matriculas, {});
          }
        });
      },
      error: (error) => {
        this.error.set(
          formatearMensajeError(error, 'No se pudo cargar la información del período de evaluación.')
        );
      }
    });
  }

  private advertirPlanificacionPendiente(evaluaciones: Evaluacion[]): void {
    if (!evaluaciones.length) {
      this.mostrarAlerta('warning', 'Falta configurar las evaluaciones',
        'Configura las evaluaciones del período antes de registrar notas.',
        { confirmText: 'Configurar ahora', cancelText: 'Después', action: 'configurar-estructura' });
      return;
    }

    const pendientes = evaluaciones.filter((evaluacion) => !evaluacion.fechaEvaluacion).length;
    if (pendientes) {
      this.mostrarAlerta('warning', 'Faltan fechas de evaluación',
        `${pendientes} ${pendientes === 1 ? 'evaluación no tiene' : 'evaluaciones no tienen'} fecha programada. Planifícalas antes de registrar notas.`,
        { confirmText: 'Planificar ahora', cancelText: 'Después', action: 'planificar-fechas' });
    }
  }

  actualizarFechaEvaluacion(evaluacion: Evaluacion, event: Event): void {
    const input = event.target as HTMLInputElement;
    const fecha = input.value;
    const periodo = this.periodosEvaluacionPeriodo().find((item) => item.id === evaluacion.periodoEvaluacionId);
    if (!fecha || !periodo || fecha < periodo.fechaInicio || fecha > periodo.fechaFin) {
      input.value = evaluacion.fechaEvaluacion ?? '';
      this.mostrarAlerta('error', 'Fecha no válida', 'La fecha de evaluación debe estar dentro del período seleccionado.');
      return;
    }

    this.guardandoFechaEvaluacion.set(evaluacion.id);
    this.evaluacionService.actualizarFecha(evaluacion.id, fecha).subscribe({
      next: (actualizada) => {
        this.evaluaciones.update((actuales) => actuales.map((item) => item.id === actualizada.id ? actualizada : item));
        this.guardandoFechaEvaluacion.set(null);
      },
      error: (error) => {
        this.guardandoFechaEvaluacion.set(null);
        input.value = evaluacion.fechaEvaluacion ?? '';
        this.mostrarAlerta('error', 'No se guardó la fecha', formatearMensajeError(error, 'No se pudo actualizar la fecha de evaluación.'));
      }
    });
  }

  alternarPanelConfiguracion(): void {
    const siguiente = !this.mostrarConfiguracionEvaluaciones();
    if (siguiente) {
      this.panelConfiguracionEvaluaciones.set(this.evaluaciones().length ? 'fechas' : 'estructura');
      this.evaluacionFechaSeleccionadaId.set(this.evaluacionesPendientesFecha()[0]?.id ?? this.evaluaciones()[0]?.id ?? null);
    }
    this.mostrarConfiguracionEvaluaciones.set(siguiente);

    if (siguiente && !this.detalleConfiguracion() && !this.cargandoConfiguracion()) {
      this.cargarConfiguracionEvaluaciones();
    }
  }

  seleccionarPanelConfiguracion(panel: PanelConfiguracionEvaluaciones): void {
    this.panelConfiguracionEvaluaciones.set(panel);
    if (panel === 'estructura' && !this.detalleConfiguracion() && !this.cargandoConfiguracion()) {
      this.cargarConfiguracionEvaluaciones();
    }
  }

  seleccionarEvaluacionFecha(event: Event): void {
    this.evaluacionFechaSeleccionadaId.set(Number((event.target as HTMLSelectElement).value));
  }

  abrirPlanificacionEvaluacion(evaluacionId: number): void {
    this.panelConfiguracionEvaluaciones.set('fechas');
    this.evaluacionFechaSeleccionadaId.set(evaluacionId);
    this.mostrarConfiguracionEvaluaciones.set(true);
  }

  actualizarCantidadConfiguracion(tipoEvaluacionId: number, valor: string | number): void {
    const cantidad = Math.max(0, Number(valor || 0));
    this.configuracionesEditables.update((actual) =>
      actual.map((configuracion) =>
        configuracion.tipoEvaluacionId === tipoEvaluacionId
          ? { ...configuracion, cantidadActual: cantidad }
          : configuracion
      )
    );
  }

  alternarTipoConfiguracion(configuracion: ConfiguracionEvaluacionEditable): void {
    if (configuracion.cantidadActual > 0) {
      this.actualizarCantidadConfiguracion(configuracion.tipoEvaluacionId, 0);
      return;
    }

    const restaurada = configuracion.cantidadBasePeriodo > 0 ? configuracion.cantidadBasePeriodo : 1;
    this.actualizarCantidadConfiguracion(configuracion.tipoEvaluacionId, restaurada);
  }

  restaurarConfiguracionBase(): void {
    this.configuracionesEditables.update((actual) =>
      actual.map((configuracion) => ({
        ...configuracion,
        cantidadActual: configuracion.cantidadBasePeriodo
      }))
    );
  }

  guardarConfiguracionEvaluaciones(): void {
    const asignacion = this.asignacion();
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();

    if (!asignacion) {
      return;
    }

    this.guardandoConfiguracion.set(true);
    this.errorConfiguracion.set(null);

    this.configuracionCursoService.guardar({
      periodoAcademicoId: asignacion.periodoAcademicoId,
      cursoId: asignacion.cursoId,
      configuraciones: this.configuracionesEditables().map((configuracion) => ({
        tipoEvaluacionId: configuracion.tipoEvaluacionId,
        cantidadEvaluaciones: configuracion.cantidadActual,
        calcularEnPromedio: true
      }))
    }).subscribe({
      next: (detalle) => {
        this.guardandoConfiguracion.set(false);
        this.detalleConfiguracion.set(detalle);
        this.configuracionesEditables.set(this.construirConfiguracionesEditables(detalle));
        this.mostrarAlerta(
          'success',
          'Evaluaciones actualizadas',
          'La grilla de evaluaciones se resincronizó para esta asignación.'
        );

        if (periodoEvaluacionId) {
          this.seleccionarPeriodoEvaluacion(periodoEvaluacionId);
        }
      },
      error: (error) => {
        this.guardandoConfiguracion.set(false);
        this.errorConfiguracion.set(formatearMensajeError(error, 'No se pudo actualizar la configuración.'));
        this.mostrarAlerta(
          'error',
          'No se pudo guardar',
          formatearMensajeError(error, 'No se pudo actualizar la configuración de evaluaciones.')
        );
      }
    });
  }

  irPeriodoEvaluacionAnterior(): void {
    const periodos = this.periodosEvaluacionPeriodo();
    const indice = this.indicePeriodoEvaluacionSeleccionado();
    if (indice <= 0) {
      return;
    }

    this.seleccionarPeriodoEvaluacion(periodos[indice - 1].id);
  }

  irPeriodoEvaluacionSiguiente(): void {
    const periodos = this.periodosEvaluacionPeriodo();
    const indice = this.indicePeriodoEvaluacionSeleccionado();
    if (indice < 0 || indice >= periodos.length - 1) {
      return;
    }

    this.seleccionarPeriodoEvaluacion(periodos[indice + 1].id);
  }

  onNotaInput(matriculaId: number, evaluacionId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const notaNormalizada = this.normalizarNota(input.value);
    input.value = notaNormalizada;
    this.filasNotas.update((filas) =>
      filas.map((fila) =>
        fila.matricula.id === matriculaId
          ? {
              ...fila,
              notas: {
                ...fila.notas,
                [evaluacionId]: notaNormalizada
              }
            }
          : fila
      )
    );

    this.programarGuardadoAutomatico(matriculaId, evaluacionId);
  }

  bloquearCambioNota(event: Event): void {
    event.preventDefault();
  }

  onNotaBlur(matriculaId: number, evaluacionId: number): void {
    this.guardarNotaAutomatica(matriculaId, evaluacionId);
  }

  guardarNotas(): void {
    const evaluaciones = this.evaluaciones();
    if (!evaluaciones.length) {
      this.mostrarAlerta(
        'warning',
        'No hay evaluaciones',
        'No hay evaluaciones programadas para guardar notas en este período.'
      );
      return;
    }

    const solicitudes = evaluaciones
      .map((evaluacion) => {
        const notas = this.filasNotas()
          .map((fila) => ({
            matriculaId: fila.matricula.id,
            nota: fila.notas[evaluacion.id] ?? ''
          }))
          .filter((item) => item.nota.trim() !== '')
          .map((item) => ({
            matriculaId: item.matriculaId,
            nota: Number(item.nota),
            observacion: null
          }));

        return { evaluacion, notas };
      })
      .filter((item) => item.notas.length > 0);

    const notasInvalidas = solicitudes.some((item) =>
      item.notas.some((nota) => Number.isNaN(nota.nota) || nota.nota < 0 || nota.nota > 20)
    );

    if (!solicitudes.length || notasInvalidas) {
      this.mostrarAlerta(
        'warning',
        'Notas inválidas',
        'Ingresa notas válidas entre 0 y 20 antes de guardar.'
      );
      return;
    }

    this.guardandoNotas.set(true);
    this.error.set(null);

    forkJoin(
      solicitudes.map((item) =>
        this.evaluacionService.registrarNotas(item.evaluacion.id, item.notas)
      )
    ).subscribe({
      next: (responses) => {
        this.guardandoNotas.set(false);
        const mapa: Record<number, DetalleNotaEvaluacion[]> = {};
        solicitudes.forEach((item, index) => {
          mapa[item.evaluacion.id] = responses[index] ?? [];
        });
        this.notasPorEvaluacion.update((actual) => ({ ...actual, ...mapa }));
        this.prepararFilasNotas(this.matriculas(), { ...this.notasPorEvaluacion(), ...mapa });
        this.mostrarAlerta(
          'success',
          'Notas guardadas',
          'Las notas se guardaron y el promedio del período se recalculó correctamente.'
        );
      },
      error: (error) => {
        this.guardandoNotas.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudieron guardar',
          formatearMensajeError(error, 'No se pudieron guardar las notas.')
        );
      }
    });
  }

  cerrarAlerta(): void {
    this.alertState.set({
      open: false,
      type: 'info',
      title: '',
      message: '',
      confirmText: 'Entendido',
      cancelText: null,
      autoCloseMs: null,
      action: null
    });
  }

  confirmarAlerta(): void {
    const action = this.alertState().action;
    this.cerrarAlerta();
    if (!action) return;

    this.mostrarConfiguracionEvaluaciones.set(true);
    this.seleccionarPanelConfiguracion(action === 'configurar-estructura' ? 'estructura' : 'fechas');
    if (action === 'planificar-fechas') {
      this.evaluacionFechaSeleccionadaId.set(this.evaluacionesPendientesFecha()[0]?.id ?? null);
    }
  }

  private mostrarAlerta(
    type: CustomAlertType,
    title: string,
    message: string,
    options?: {
      confirmText?: string | null;
      cancelText?: string | null;
      autoCloseMs?: number | null;
      action?: AlertState['action'];
    }
  ): void {
    this.alertState.set({
      open: true,
      type,
      title,
      message,
      confirmText: options?.confirmText ?? 'Entendido',
      cancelText: options?.cancelText ?? null,
      autoCloseMs: null,
      action: options?.action ?? null
    });
  }

  private prepararFilasNotas(
    matriculas: Matricula[],
    notasPorEvaluacion: Record<number, DetalleNotaEvaluacion[]>
  ): void {
    const evaluaciones = this.evaluaciones();
    this.filasNotas.set(
      matriculas.map((matricula) => {
        const notas: Record<number, string> = {};
        evaluaciones.forEach((evaluacion) => {
          const nota = (notasPorEvaluacion[evaluacion.id] ?? []).find(
            (detalle) => detalle.matriculaId === matricula.id
          );
          notas[evaluacion.id] = nota?.nota?.toString() ?? '';
        });
        return {
          matricula,
          notas
        };
      })
    );
  }

  private cargarConfiguracionEvaluaciones(): void {
    const asignacion = this.asignacion();
    if (!asignacion) {
      return;
    }

    this.cargandoConfiguracion.set(true);
    this.errorConfiguracion.set(null);

    this.configuracionCursoService
      .obtenerDetalle(asignacion.periodoAcademicoId, asignacion.cursoId)
      .subscribe({
        next: (detalle) => {
          this.detalleConfiguracion.set(detalle);
          this.configuracionesEditables.set(this.construirConfiguracionesEditables(detalle));
          this.cargandoConfiguracion.set(false);
        },
        error: (error) => {
          this.detalleConfiguracion.set(null);
          this.configuracionesEditables.set([]);
          this.cargandoConfiguracion.set(false);
          this.errorConfiguracion.set(
            formatearMensajeError(error, 'No se pudo cargar la configuración de evaluaciones.')
          );
        }
      });
  }

  private construirConfiguracionesEditables(
    detalle: ConfiguracionEvaluacionCursoDetalle
  ): ConfiguracionEvaluacionEditable[] {
    return detalle.configuraciones
      .map((configuracion) => ({
        ...configuracion,
        cantidadActual: configuracion.cantidadEvaluaciones,
        calcularEnPromedio: true
      }))
      .sort((a, b) => a.nombreTipoEvaluacion.localeCompare(b.nombreTipoEvaluacion));
  }

  private programarGuardadoAutomatico(matriculaId: number, evaluacionId: number): void {
    const clave = this.construirClaveNota(matriculaId, evaluacionId);
    const timerActual = this.autoSaveTimers.get(clave);
    if (timerActual) {
      clearTimeout(timerActual);
    }

    const timer = setTimeout(() => {
      this.guardarNotaAutomatica(matriculaId, evaluacionId);
    }, 700);

    this.autoSaveTimers.set(clave, timer);
  }

  private guardarNotaAutomatica(matriculaId: number, evaluacionId: number): void {
    const clave = this.construirClaveNota(matriculaId, evaluacionId);
    const timerActual = this.autoSaveTimers.get(clave);
    if (timerActual) {
      clearTimeout(timerActual);
      this.autoSaveTimers.delete(clave);
    }

    const fila = this.filasNotas().find((item) => item.matricula.id === matriculaId);
    const valor = fila?.notas[evaluacionId]?.trim() ?? '';

    if (!valor) {
      return;
    }

    const nota = Number(valor);
    if (Number.isNaN(nota) || nota < 0 || nota > 20) {
      return;
    }

    const notaGuardada =
      this.notasPorEvaluacion()[evaluacionId]?.find((detalle) => detalle.matriculaId === matriculaId)?.nota ?? null;

    if (notaGuardada !== null && Number(notaGuardada) === nota) {
      return;
    }

    const guardadoEnCurso = this.autoSaveInFlight.get(clave);
    if (guardadoEnCurso) {
      if (guardadoEnCurso !== valor) {
        this.autoSavePending.set(clave, { matriculaId, evaluacionId, valor });
      }
      return;
    }

    this.autoSaveInFlight.set(clave, valor);

    this.evaluacionService
      .registrarNotas(evaluacionId, [
        {
          matriculaId,
          nota,
          observacion: null
        }
      ])
      .subscribe({
        next: (response) => {
          const detallesActuales = this.notasPorEvaluacion()[evaluacionId] ?? [];
          const detalleGuardado = response[0];
          this.autoSaveInFlight.delete(clave);
          if (!detalleGuardado) {
            return;
          }

          const sinActual = detallesActuales.filter((detalle) => detalle.matriculaId !== matriculaId);
          this.notasPorEvaluacion.update((actual) => ({
            ...actual,
            [evaluacionId]: [...sinActual, detalleGuardado]
          }));

          const pendiente = this.autoSavePending.get(clave);
          if (pendiente) {
            this.autoSavePending.delete(clave);
            const valorActual =
              this.filasNotas()
                .find((item) => item.matricula.id === pendiente.matriculaId)
                ?.notas[pendiente.evaluacionId]
                ?.trim() ?? '';
            if (valorActual && valorActual !== valor) {
              this.guardarNotaAutomatica(pendiente.matriculaId, pendiente.evaluacionId);
            }
          }
        },
        error: (error) => {
          this.autoSaveInFlight.delete(clave);
          this.autoSavePending.delete(clave);
          this.mostrarAlerta(
            'error',
            'No se pudo guardar la nota',
            formatearMensajeError(error, 'No se pudo guardar la nota automáticamente.')
          );
        }
      });
  }

  private construirClaveNota(matriculaId: number, evaluacionId: number): string {
    return `${matriculaId}-${evaluacionId}`;
  }

  private normalizarNota(valor: string): string {
    const limpio = valor.replace(',', '.').replace(/[^\d.]/g, '');
    const partes = limpio.split('.');
    const entero = partes[0] ?? '';
    const decimal = partes.slice(1).join('').slice(0, 2);

    if (!entero && !limpio.includes('.')) {
      return '';
    }

    const base = limpio.includes('.') ? `${entero}.${decimal}` : entero;
    const numero = Number(base);

    if (Number.isNaN(numero)) {
      return base;
    }

    if (numero < 0) {
      return '0';
    }

    if (numero > 20) {
      return '20';
    }

    return base;
  }
}
