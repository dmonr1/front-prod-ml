import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import {
  AsistenciaPeriodoEvaluacion,
  AsistenciaPeriodoEvaluacionPayload
} from '../../models/asistencia-periodo-evaluacion';
import { Matricula } from '../../models/matricula';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AuthService } from '../../services/auth/auth.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { AsistenciaPeriodoEvaluacionService } from '../../services/evaluacion/asistencia-periodo-evaluacion.service';
import { Tutoria } from '../../models/tutoria';

interface AsistenciaFila {
  matricula: Matricula;
  clasesAsistidas: string;
  porcentajeAsistencia: number | null;
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
  selector: 'app-carga-asistencias',
  imports: [Shell, CustomAlertComponent],
  templateUrl: './carga-asistencias.html',
  styleUrl: './carga-asistencias.scss'
})
export class CargaAsistencias implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly asignacionService = inject(AsignacionAcademicaService);
  private readonly tutoriaService = inject(TutoriaService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly matriculaService = inject(MatriculaService);
  private readonly asistenciaService = inject(AsistenciaPeriodoEvaluacionService);
  private readonly asignacionIdParam = this.route.snapshot.paramMap.get('asignacionId');

  readonly asignacionId = this.asignacionIdParam === null ? null : Number(this.asignacionIdParam);
  readonly currentYear = new Date().getFullYear();
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly mostrarErrorCarga = signal(true);
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
  readonly tutoriasDisponibles = signal<Tutoria[]>([]);
  readonly tutoriaActivaId = signal<number | null>(null);
  readonly asignacionesDocente = signal<AsignacionDocente[]>([]);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly matriculas = signal<Matricula[]>([]);
  readonly filasAsistencia = signal<AsistenciaFila[]>([]);
  readonly asistenciasGuardadas = signal<Record<number, AsistenciaPeriodoEvaluacion>>({});
  readonly clasesProgramadasGeneral = signal('');
  readonly filasPlaceholder = Array.from({ length: 5 }, (_, index) => index);
  

  private readonly autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly autoSaveInFlight = new Map<string, string>();
  private readonly autoSavePending = new Map<string, number>();
  private globalProgramadasTimer: ReturnType<typeof setTimeout> | null = null;

  

  
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

  readonly resumenAsistencia = computed(() => {
    const filas = this.filasAsistencia();
    const registradas = filas.filter(
      (fila) => this.clasesProgramadasGeneral().trim() !== '' && fila.clasesAsistidas.trim() !== ''
    );
    const porcentajes = registradas
      .map((fila) =>
        this.calcularPorcentaje(
          Number(this.clasesProgramadasGeneral()),
          Number(fila.clasesAsistidas)
        )
      )
      .filter((valor) => valor !== null) as number[];

    const promedio = porcentajes.length
      ? Math.round(
          (porcentajes.reduce((acumulado, valor) => acumulado + valor, 0) / porcentajes.length) *
            100
        ) / 100
      : 0;

    return {
      total: filas.length,
      registradas: registradas.length,
      promedio
    };
  });

  readonly esVistaSeccionTutorada = computed(
    () => this.asignacionId === null || Number.isNaN(this.asignacionId)
  );
  readonly tutoriaActiva = computed(
    () => this.tutoriasDisponibles().find((item) => item.id === this.tutoriaActivaId()) ?? null
  );
  readonly puedeRegistrarAsistencia = computed(() => !!this.asignacion());
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());


  ngOnInit(): void {
    this.cargarBase();
  }

  reintentarCargaError(): void {
    this.mostrarErrorCarga.set(false);
    this.error.set(null);

    const periodoId = this.periodoEvaluacionSeleccionadoId();
    if (periodoId && (this.asignacion() || this.tutoriaActiva())) {
      this.seleccionarPeriodoEvaluacion(periodoId);
      return;
    }

    this.cargarBase();
  }

  cerrarErrorCarga(): void {
    this.mostrarErrorCarga.set(false);
  }

  cargarBase(): void {
    const docenteId = this.authService.obtenerUsuario()?.docenteId;

    if (!docenteId) {
      this.cargando.set(true);
      this.error.set('Tu usuario no tiene un docente vinculado.');
      this.mostrarErrorCarga.set(true);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.mostrarErrorCarga.set(false);

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual =
          periodos.find((periodo) => periodo.anio === this.currentYear) ??
          [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
          null;

        if (!periodoActual) {
          this.cargando.set(true);
          this.error.set('No se encontro un periodo academico para cargar la asignacion.');
          this.mostrarErrorCarga.set(true);
          return;
        }

        if (this.esVistaSeccionTutorada()) {
          forkJoin({
            asignaciones: this.asignacionService.listarAsignaciones(docenteId, periodoActual.id),
            tutorias: this.tutoriaService.listarPorDocente(docenteId, periodoActual.id),
            periodosEvaluacion: this.periodoEvaluacionService.listar()
          }).subscribe({
            next: ({ asignaciones, tutorias, periodosEvaluacion }) => {
              this.asignacionesDocente.set(asignaciones);
              this.periodosEvaluacion.set(periodosEvaluacion);
              this.tutoriasDisponibles.set(
                tutorias.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO')
              );
              this.cargando.set(false);

              const primeraTutoria = this.tutoriasDisponibles()[0] ?? null;
              if (!primeraTutoria) {
                this.cargando.set(true);
                this.error.set('No tienes una seccion tutorada activa para registrar asistencias.');
                this.mostrarErrorCarga.set(true);
                return;
              }

              this.seleccionarTutoria(primeraTutoria.id);
            },
            error: (error) => {
              this.cargando.set(true);
              this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la informacion inicial.');
              this.mostrarErrorCarga.set(true);
            }
          });
          return;
        }

        forkJoin({
          asignaciones: this.asignacionService.listarAsignaciones(docenteId, periodoActual.id),
          periodosEvaluacion: this.periodoEvaluacionService.listar()
        }).subscribe({
          next: ({ asignaciones, periodosEvaluacion }) => {
            const asignacion =
              this.asignacionId === null
                ? null
                : asignaciones.find((item) => item.id === this.asignacionId) ?? null;
            this.asignacion.set(asignacion);
            this.periodosEvaluacion.set(periodosEvaluacion);
            this.cargando.set(false);

            if (!asignacion) {
              this.cargando.set(true);
              this.error.set('No se encontro la asignacion seleccionada para tu usuario.');
              this.mostrarErrorCarga.set(true);
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
            this.cargando.set(true);
            this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la informacion inicial.');
            this.mostrarErrorCarga.set(true);
          }
        });
      },
      error: (error) => {
        this.cargando.set(true);
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo resolver el periodo academico actual.'
        );
        this.mostrarErrorCarga.set(true);
      }
    });
  }

  seleccionarPeriodoEvaluacion(periodoEvaluacionId: number): void {
    const asignacion = this.asignacion();
    const tutoria = this.tutoriaActiva();
    const periodoAcademicoId = asignacion?.periodoAcademicoId ?? tutoria?.periodoAcademicoId ?? null;
    const seccionId = asignacion?.seccionId ?? tutoria?.seccionId ?? null;

    if (!periodoAcademicoId || !seccionId) {
      return;
    }

    this.periodoEvaluacionSeleccionadoId.set(periodoEvaluacionId);
    this.asistenciasGuardadas.set({});
    this.filasAsistencia.set([]);
    this.clasesProgramadasGeneral.set('');
    this.error.set(null);
    this.mostrarErrorCarga.set(false);
    this.cargando.set(true);

    forkJoin({
      configuracion: asignacion
        ? this.asistenciaService.obtenerConfiguracion(asignacion.id, periodoEvaluacionId)
        : of(null),
      asistencias: this.asistenciaService.listar(
        seccionId,
        periodoAcademicoId,
        periodoEvaluacionId
      ),
      matriculas: this.matriculaService.listar(periodoAcademicoId, seccionId)
    }).subscribe({
      next: ({ configuracion, asistencias, matriculas }) => {
        this.error.set(null);
        this.matriculas.set(matriculas);
        const mapa: Record<number, AsistenciaPeriodoEvaluacion> = {};
        asistencias.forEach((asistencia) => {
          mapa[asistencia.matriculaId] = asistencia;
        });
        this.asistenciasGuardadas.set(mapa);
        this.clasesProgramadasGeneral.set(
          configuracion?.clasesProgramadas !== null && configuracion?.clasesProgramadas !== undefined
            ? configuracion.clasesProgramadas.toString()
            : ''
        );
        this.prepararFilasAsistencia(matriculas, mapa);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo cargar la informacion del periodo de evaluacion.'
        );
        this.mostrarErrorCarga.set(true);
        this.cargando.set(true);
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

  seleccionarTutoria(tutoriaId: number): void {
    const tutoria = this.tutoriasDisponibles().find((item) => item.id === tutoriaId) ?? null;
    if (!tutoria) {
      return;
    }

    const asignacionAncla =
      this.asignacionesDocente().find((item) => item.seccionId === tutoria.seccionId) ?? null;

    this.tutoriaActivaId.set(tutoriaId);
    this.asignacion.set(asignacionAncla);
    this.error.set(null);

    const periodoAcademicoId = asignacionAncla?.periodoAcademicoId ?? tutoria.periodoAcademicoId;
    const primerPeriodoEvaluacion = this.periodosEvaluacion()
      .filter((item) => item.periodoAcademicoId === periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero)[0];

    if (primerPeriodoEvaluacion) {
      this.seleccionarPeriodoEvaluacion(primerPeriodoEvaluacion.id);
    }
  }

  onTutoriaChange(valor: string): void {
    const tutoriaId = Number(valor);
    if (Number.isNaN(tutoriaId)) {
      return;
    }

    this.seleccionarTutoria(tutoriaId);
  }

  onClasesProgramadasInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valorNormalizado = this.normalizarEntero(input.value);
    input.value = valorNormalizado;
    this.clasesProgramadasGeneral.set(valorNormalizado);
    this.filasAsistencia.update((filas) =>
      filas.map((fila) => ({
        ...fila,
        porcentajeAsistencia: this.calcularPorcentaje(
          Number(valorNormalizado),
          Number(fila.clasesAsistidas)
        )
      }))
    );

    if (this.globalProgramadasTimer) {
      clearTimeout(this.globalProgramadasTimer);
    }

    this.globalProgramadasTimer = setTimeout(() => {
      this.guardarClasesProgramadasGenerales();
    }, 700);
  }

  onClasesProgramadasBlur(): void {
    this.guardarClasesProgramadasGenerales(true);
  }

  onAsistenciaInput(
    matriculaId: number,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const valorNormalizado = this.normalizarEntero(input.value);
    input.value = valorNormalizado;

    this.filasAsistencia.update((filas) =>
      filas.map((fila) => {
        if (fila.matricula.id !== matriculaId) {
          return fila;
        }

        const actualizada = {
          ...fila,
          clasesAsistidas: valorNormalizado
        };

        return {
          ...actualizada,
          porcentajeAsistencia: this.calcularPorcentaje(
            Number(this.clasesProgramadasGeneral()),
            Number(actualizada.clasesAsistidas)
          )
        };
      })
    );

    this.programarGuardadoAutomatico(matriculaId);
  }

  onAsistenciaBlur(matriculaId: number): void {
    this.guardarAsistenciaAutomatica(matriculaId, true);
  }

  moverFocoEnGrilla(event: KeyboardEvent, filaIndex: number): void {
    const tecla = event.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(tecla)) {
      return;
    }

    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('.attendance-grid-input')
    );
    if (!inputs.length) {
      return;
    }

    const siguienteIndex =
      tecla === 'ArrowUp' || tecla === 'ArrowLeft' ? filaIndex - 1 : filaIndex + 1;

    if (siguienteIndex < 0 || siguienteIndex >= inputs.length) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const siguiente = inputs[siguienteIndex];
    siguiente?.focus();
    siguiente?.select();
  }

  bloquearCambioNumero(event: Event): void {
    event.preventDefault();
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

  private prepararFilasAsistencia(
    matriculas: Matricula[],
    asistenciasGuardadas: Record<number, AsistenciaPeriodoEvaluacion>
  ): void {
    this.filasAsistencia.set(
      matriculas.map((matricula) => {
        const asistencia = asistenciasGuardadas[matricula.id];
        return {
          matricula,
          clasesAsistidas: asistencia?.clasesAsistidas?.toString() ?? '',
          porcentajeAsistencia: asistencia?.porcentajeAsistencia ?? null
        };
      })
    );
  }

  private guardarClasesProgramadasGenerales(mostrarError = false): void {
    if (this.globalProgramadasTimer) {
      clearTimeout(this.globalProgramadasTimer);
      this.globalProgramadasTimer = null;
    }

    const valor = this.clasesProgramadasGeneral().trim();
    if (!valor) {
      return;
    }

    const clasesProgramadas = Number(valor);
    if (Number.isNaN(clasesProgramadas) || clasesProgramadas < 0) {
      return;
    }

    const asignacion = this.asignacion();
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    if (!asignacion || !periodoEvaluacionId) {
      return;
    }

    const filasConAsistencia = this.filasAsistencia().filter(
      (fila) => fila.clasesAsistidas.trim() !== ''
    );

    for (const fila of filasConAsistencia) {
      const asistidas = Number(fila.clasesAsistidas);
      if (asistidas > clasesProgramadas) {
        if (mostrarError) {
          this.mostrarAlerta(
            'warning',
            'Asistencia invalida',
            'Las clases asistidas no pueden ser mayores que las programadas.',
            { confirmText: null, autoCloseMs: 3000 }
          );
        }
        return;
      }
    }

    this.asistenciaService
      .guardarConfiguracion(periodoEvaluacionId, asignacion.id, clasesProgramadas)
      .subscribe({
        next: () => {
          for (const fila of filasConAsistencia) {
            this.programarGuardadoAutomatico(fila.matricula.id);
          }
        },
        error: (error) => {
          this.mostrarAlerta(
            'error',
            'No se pudo guardar la configuracion',
            error?.error?.mensaje ?? 'No se pudieron guardar las clases programadas.'
          );
        }
      });
  }

  private programarGuardadoAutomatico(matriculaId: number): void {
    const clave = this.construirClaveAsistencia(matriculaId);
    const timerActual = this.autoSaveTimers.get(clave);
    if (timerActual) {
      clearTimeout(timerActual);
    }

    const timer = setTimeout(() => {
      this.guardarAsistenciaAutomatica(matriculaId);
    }, 700);

    this.autoSaveTimers.set(clave, timer);
  }

  private guardarAsistenciaAutomatica(matriculaId: number, mostrarError = false): void {
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    if (!periodoEvaluacionId) {
      return;
    }

    const clave = this.construirClaveAsistencia(matriculaId);
    const timerActual = this.autoSaveTimers.get(clave);
    if (timerActual) {
      clearTimeout(timerActual);
      this.autoSaveTimers.delete(clave);
    }

    const fila = this.filasAsistencia().find((item) => item.matricula.id === matriculaId);
    if (!fila) {
      return;
    }

    const programadasTexto = this.clasesProgramadasGeneral().trim();
    const asistidasTexto = fila.clasesAsistidas.trim();
    if (!programadasTexto || !asistidasTexto) {
      return;
    }

    const clasesProgramadas = Number(programadasTexto);
    const clasesAsistidas = Number(asistidasTexto);
    if (
      Number.isNaN(clasesProgramadas) ||
      Number.isNaN(clasesAsistidas) ||
      clasesProgramadas < 0 ||
      clasesAsistidas < 0
    ) {
      return;
    }

    if (clasesAsistidas > clasesProgramadas) {
      if (mostrarError) {
        this.mostrarAlerta(
          'warning',
          'Asistencia invalida',
          'Las clases asistidas no pueden ser mayores que las programadas.',
          { confirmText: null, autoCloseMs: 3000 }
        );
      }
      return;
    }

    const huella = `${clasesProgramadas}-${clasesAsistidas}`;
    const guardadoActual = this.asistenciasGuardadas()[matriculaId];
    if (
      guardadoActual &&
      guardadoActual.clasesProgramadas === clasesProgramadas &&
      guardadoActual.clasesAsistidas === clasesAsistidas
    ) {
      return;
    }

    const enCurso = this.autoSaveInFlight.get(clave);
    if (enCurso) {
      if (enCurso !== huella) {
        this.autoSavePending.set(clave, matriculaId);
      }
      return;
    }

    this.autoSaveInFlight.set(clave, huella);

    const payload: AsistenciaPeriodoEvaluacionPayload = {
      matriculaId,
      clasesAsistidas,
      observacion: null
    };

    const asignacion = this.asignacion();
    if (!asignacion) {
      return;
    }

    this.asistenciaService.registrar(periodoEvaluacionId, asignacion.id, [payload]).subscribe({
      next: (response) => {
        this.autoSaveInFlight.delete(clave);
        const asistencia = response[0];
        if (!asistencia) {
          return;
        }

        this.asistenciasGuardadas.update((actual) => ({
          ...actual,
          [matriculaId]: asistencia
        }));

        this.filasAsistencia.update((filas) =>
          filas.map((item) =>
            item.matricula.id === matriculaId
              ? {
                  ...item,
                  clasesProgramadas: asistencia.clasesProgramadas.toString(),
                  clasesAsistidas: asistencia.clasesAsistidas.toString(),
                  porcentajeAsistencia: asistencia.porcentajeAsistencia
                }
              : item
          )
        );

        const pendiente = this.autoSavePending.get(clave);
        if (pendiente) {
          this.autoSavePending.delete(clave);
          this.guardarAsistenciaAutomatica(pendiente);
        }
      },
      error: (error) => {
        this.autoSaveInFlight.delete(clave);
        this.autoSavePending.delete(clave);
        this.mostrarAlerta(
          'error',
          'No se pudo guardar la asistencia',
          error?.error?.mensaje ?? 'No se pudo guardar la asistencia automaticamente.'
        );
      }
      });
  }

  private construirClaveAsistencia(matriculaId: number): string {
    return `${this.periodoEvaluacionSeleccionadoId() ?? 0}-${matriculaId}`;
  }

  private normalizarEntero(valor: string): string {
    const limpio = valor.replace(/[^\d]/g, '');
    if (!limpio) {
      return '';
    }

    return String(Number(limpio));
  }

  private calcularPorcentaje(
    clasesProgramadas: number,
    clasesAsistidas: number
  ): number | null {
    if (
      Number.isNaN(clasesProgramadas) ||
      Number.isNaN(clasesAsistidas) ||
      clasesProgramadas <= 0 ||
      clasesAsistidas < 0 ||
      clasesAsistidas > clasesProgramadas
    ) {
      return null;
    }

    return Math.round((clasesAsistidas / clasesProgramadas) * 10000) / 100;
  }
}
