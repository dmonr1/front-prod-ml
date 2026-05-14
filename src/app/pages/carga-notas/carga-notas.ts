import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { DetalleNotaEvaluacion, Evaluacion } from '../../models/evaluacion';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AuthService } from '../../services/auth/auth.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { EvaluacionService } from '../../services/evaluacion/evaluacion.service';

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
}

@Component({
  selector: 'app-carga-notas',
  imports: [Shell, RouterLink, CustomAlertComponent],
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
    autoCloseMs: null
  });

  readonly asignacion = signal<AsignacionDocente | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly evaluaciones = signal<Evaluacion[]>([]);
  readonly matriculas = signal<Matricula[]>([]);
  readonly filasNotas = signal<NotaFila[]>([]);
  readonly notasPorEvaluacion = signal<Record<number, DetalleNotaEvaluacion[]>>({});
  private readonly autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly autoSaveInFlight = new Map<string, string>();
  private readonly autoSavePending = new Map<string, { matriculaId: number; evaluacionId: number; valor: string }>();

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
      .map((nota) => Number(nota))
      .filter((nota) => !Number.isNaN(nota));
    const promedio = notas.length
      ? Math.round((notas.reduce((acc, nota) => acc + nota, 0) / notas.length) * 100) / 100
      : 0;

    return {
      total: this.filasNotas().length,
      registradas: notas.length,
      promedio
    };
  });

  readonly leyendaEvaluaciones = computed(() => {
    const mapa = new Map<string, string>();

    this.evaluaciones().forEach((evaluacion) => {
      const abreviatura = this.abreviarTipoEvaluacion(evaluacion.tipoEvaluacion);
      const nombre = evaluacion.tipoEvaluacion?.trim() || 'Evaluacion';
      if (!mapa.has(abreviatura)) {
        mapa.set(abreviatura, nombre);
      }
    });

    return Array.from(mapa.entries()).map(([abreviatura, nombre]) => ({
      abreviatura,
      nombre
    }));
  });

  abreviaturaEvaluacion(evaluacion: Evaluacion): string {
    const base = this.abreviarTipoEvaluacion(evaluacion.tipoEvaluacion);
    return `${base}${evaluacion.numeroEvaluacion}`;
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
          this.error.set('No se encontro un periodo academico para cargar la asignacion.');
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
              this.error.set('No se encontro la asignacion seleccionada para tu usuario.');
              return;
            }

            const primerPeriodoEvaluacion = periodosEvaluacion
              .filter((item) => item.periodoAcademicoId === asignacion.periodoAcademicoId)
              .sort((a, b) => a.numero - b.numero)[0];

            if (primerPeriodoEvaluacion) {
              this.seleccionarPeriodoEvaluacion(primerPeriodoEvaluacion.id);
            }
          },
          error: (error) => {
            this.cargando.set(false);
            this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la informacion inicial.');
          }
        });
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo resolver el periodo academico actual.'
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
            this.error.set(error?.error?.mensaje ?? 'No se pudieron cargar las notas.');
            this.prepararFilasNotas(matriculas, {});
          }
        });
      },
      error: (error) => {
        this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la informacion del periodo de evaluacion.');
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
        'No hay evaluaciones programadas para guardar notas en este periodo.',
        { confirmText: null, autoCloseMs: 3000 }
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
        'Notas invalidas',
        'Ingresa notas validas entre 0 y 20 antes de guardar.',
        { confirmText: null, autoCloseMs: 3000 }
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
          'Las notas se guardaron y el promedio del periodo se recalculo correctamente.',
          { confirmText: null, autoCloseMs: 3000 }
        );
      },
      error: (error) => {
        this.guardandoNotas.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudieron guardar',
          error?.error?.mensaje ?? 'No se pudieron guardar las notas.'
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
      confirmText: 'Aceptar',
      cancelText: null,
      autoCloseMs: null
    });
  }

  private mostrarAlerta(
    type: CustomAlertType,
    title: string,
    message: string,
    options?: {
      confirmText?: string | null;
      cancelText?: string | null;
      autoCloseMs?: number | null;
    }
  ): void {
    this.alertState.set({
      open: true,
      type,
      title,
      message,
      confirmText: options?.confirmText ?? 'Aceptar',
      cancelText: options?.cancelText ?? null,
      autoCloseMs: options?.autoCloseMs ?? null
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
            error?.error?.mensaje ?? 'No se pudo guardar la nota automaticamente.'
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
