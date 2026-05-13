import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { Grado } from '../../models/grado';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { GradoService } from '../../services/academico/grado.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';

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
  selector: 'app-alumnos-periodo',
  imports: [Shell, RouterLink, FormsModule, CustomAlertComponent],
  templateUrl: './alumnos-periodo.html',
  styleUrl: './alumnos-periodo.scss'
})
export class AlumnosPeriodo {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly gradoService = inject(GradoService);
  private readonly seccionService = inject(SeccionService);
  private readonly matriculaService = inject(MatriculaService);

  readonly currentYear = new Date().getFullYear();
  readonly periodoId = Number(this.route.snapshot.paramMap.get('periodoId'));

  readonly periodo = signal<PeriodoAcademico | null>(null);
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly grados = signal<Grado[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly matriculas = signal<Matricula[]>([]);
  readonly nivelSeleccionadoId = signal(1);
  readonly gradoSeleccionadoId = signal<number | null>(null);
  readonly mostrarSeccionesDeshabilitadas = signal(false);
  readonly modalSeccionAbierto = signal(false);
  readonly guardandoSeccion = signal(false);
  readonly actualizandoEstadoSeccionId = signal<number | null>(null);
  readonly cargandoSeccionesAnteriores = signal(false);
  readonly formSeccionNombre = signal('');
  readonly formSeccionCapacidad = signal('');

  readonly cargandoPeriodo = signal(true);
  readonly cargandoGrados = signal(true);
  readonly cargandoSecciones = signal(true);
  readonly cargandoMatriculas = signal(true);

  readonly errorPeriodo = signal<string | null>(null);
  readonly errorGrados = signal<string | null>(null);
  readonly errorSecciones = signal<string | null>(null);
  readonly errorMatriculas = signal<string | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });
  readonly seccionPendienteEstado = signal<{ id: number; activa: boolean } | null>(null);

  readonly esPeriodoEditable = computed(() => {
    const periodo = this.periodo();
    return periodo ? periodo.anio === this.currentYear : false;
  });

  readonly gradosFiltrados = computed(() =>
    this.grados()
      .filter((grado) => grado.nivelId === this.nivelSeleccionadoId())
      .sort((a, b) => a.orden - b.orden)
  );

  readonly gradoSeleccionado = computed(
    () => this.grados().find((grado) => grado.id === this.gradoSeleccionadoId()) ?? null
  );

  readonly seccionesDelGrado = computed(() =>
    this.secciones()
      .filter(
        (seccion) =>
          seccion.gradoId === this.gradoSeleccionadoId() &&
          (this.mostrarSeccionesDeshabilitadas() || (seccion.estado ?? 'ACTIVO') === 'ACTIVO')
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  );

  readonly periodoAnterior = computed(() => {
    const actual = this.periodo();
    if (!actual) {
      return null;
    }

    return [...this.periodos()]
      .filter((periodo) => periodo.anio < actual.anio)
      .sort((a, b) => b.anio - a.anio)[0] ?? null;
  });

  constructor() {
    this.cargarTodo();
  }

  cargarTodo(): void {
    this.cargarPeriodo();
    this.cargarGrados();
    this.cargarSecciones();
    this.cargarMatriculas();
  }

  cargarPeriodo(): void {
    this.cargandoPeriodo.set(true);
    this.errorPeriodo.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        this.periodos.set(response);
        this.periodo.set(response.find((item) => item.id === this.periodoId) ?? null);
        this.cargandoPeriodo.set(false);
      },
      error: () => {
        this.errorPeriodo.set('No se pudo cargar el periodo academico.');
        this.cargandoPeriodo.set(false);
      }
    });
  }

  cargarGrados(): void {
    this.cargandoGrados.set(true);
    this.errorGrados.set(null);

    this.gradoService.listar().subscribe({
      next: (response) => {
        this.grados.set(response);
        this.cargandoGrados.set(false);
      },
      error: () => {
        this.errorGrados.set('No se pudieron cargar los grados.');
        this.cargandoGrados.set(false);
      }
    });
  }

  cargarSecciones(): void {
    this.cargandoSecciones.set(true);
    this.errorSecciones.set(null);

    this.seccionService.listar(this.periodoId).subscribe({
      next: (response) => {
        this.secciones.set(response);
        this.cargandoSecciones.set(false);
      },
      error: () => {
        this.errorSecciones.set('No se pudieron cargar las secciones.');
        this.cargandoSecciones.set(false);
      }
    });
  }

  cargarMatriculas(): void {
    this.cargandoMatriculas.set(true);
    this.errorMatriculas.set(null);

    this.matriculaService.listar(this.periodoId).subscribe({
      next: (response) => {
        this.matriculas.set(response);
        this.cargandoMatriculas.set(false);
      },
      error: () => {
        this.errorMatriculas.set('No se pudieron cargar las matriculas del periodo.');
        this.cargandoMatriculas.set(false);
      }
    });
  }

  seleccionarNivel(nivelId: number): void {
    this.nivelSeleccionadoId.set(nivelId);
    this.gradoSeleccionadoId.set(null);
    this.mostrarSeccionesDeshabilitadas.set(false);
  }

  seleccionarGrado(gradoId: number): void {
    this.gradoSeleccionadoId.set(this.gradoSeleccionadoId() === gradoId ? null : gradoId);
  }

  toggleMostrarSeccionesDeshabilitadas(): void {
    this.mostrarSeccionesDeshabilitadas.update((valor) => !valor);
    
  }

  abrirSeccion(seccionId: number): void {
    void this.router.navigate(['/gestion-estudiantil/periodo', this.periodoId, 'seccion', seccionId]);
  }

  abrirModalSeccion(): void {
    this.modalSeccionAbierto.set(true);
  }

  cerrarModalSeccion(): void {
    this.modalSeccionAbierto.set(false);
  }

  guardarSeccion(): void {
    const gradoId = this.gradoSeleccionadoId();
    const nombre = this.formSeccionNombre().trim();
    const capacidad = this.formSeccionCapacidad().trim();

    if (!gradoId) {
      this.mostrarAlerta(
        'warning',
        'Selecciona un grado',
        'Selecciona un grado antes de crear una seccion.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    if (!nombre) {
      this.mostrarAlerta(
        'warning',
        'Falta el nombre',
        'Ingresa el nombre de la seccion.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.guardandoSeccion.set(true);

    this.seccionService
      .crear({
        gradoId,
        periodoAcademicoId: this.periodoId,
        nombre,
        capacidad: capacidad ? Number(capacidad) : null
      })
      .subscribe({
        next: (seccion) => {
          this.guardandoSeccion.set(false);
          this.secciones.update((actual) => [...actual, seccion]);
          this.formSeccionNombre.set('');
          this.formSeccionCapacidad.set('');
          this.cerrarModalSeccion();
          this.mostrarAlerta(
            'success',
            'Seccion registrada',
            'Seccion registrada correctamente para este periodo.',
            { confirmText: null, autoCloseMs: 3000 }
          );
        },
        error: (error) => {
          this.guardandoSeccion.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            error?.error?.mensaje ?? 'No se pudo registrar la seccion.'
          );
        }
      });
  }

  cargarSeccionesPeriodoAnterior(): void {
    const gradoId = this.gradoSeleccionadoId();

    if (!gradoId) {
      this.mostrarAlerta(
        'warning',
        'Selecciona un grado',
        'Selecciona un grado antes de cargar secciones.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    if (!this.periodoAnterior()) {
      this.mostrarAlerta(
        'warning',
        'No hay periodo anterior',
        'No existe un periodo anterior para copiar secciones.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.cargandoSeccionesAnteriores.set(true);

    this.seccionService
      .copiarPeriodoAnterior({
        gradoId,
        periodoAcademicoId: this.periodoId
      })
      .subscribe({
        next: (secciones) => {
          this.cargandoSeccionesAnteriores.set(false);
          this.secciones.update((actual) => [...actual, ...secciones]);
          this.mostrarAlerta(
            'success',
            'Secciones cargadas',
            'Secciones del periodo anterior cargadas correctamente.',
            { confirmText: null, autoCloseMs: 3000 }
          );
        },
        error: (error) => {
          this.cargandoSeccionesAnteriores.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudieron cargar',
            error?.error?.mensaje ?? 'No se pudieron cargar las secciones del periodo anterior.'
          );
        }
      });
  }

  deshabilitarSeccion(seccionId: number): void {
    this.actualizarEstadoSeccion(seccionId, false);
  }

  toggleEstadoSeccion(seccion: Seccion): void {
    const activa = (seccion.estado ?? 'ACTIVO') === 'ACTIVO';

    if (activa) {
      this.seccionPendienteEstado.set({ id: seccion.id, activa: false });
      this.mostrarAlerta(
        'warning',
        'Deshabilitar seccion',
        'Esta seguro que quiere deshabilitar esta seccion para este periodo?',
        {
          confirmText: 'Deshabilitar',
          cancelText: 'Cancelar'
        }
      );
      return;
    }

    this.actualizarEstadoSeccion(seccion.id, true);
  }

  confirmarCambioEstadoSeccion(): void {
    const pendiente = this.seccionPendienteEstado();
    if (!pendiente) {
      this.cerrarAlerta();
      return;
    }

    this.cerrarAlerta();
    this.actualizarEstadoSeccion(pendiente.id, pendiente.activa);
    this.seccionPendienteEstado.set(null);
  }

  cancelarCambioEstadoSeccion(): void {
    this.seccionPendienteEstado.set(null);
    this.cerrarAlerta();
  }

  private actualizarEstadoSeccion(seccionId: number, activa: boolean): void {
    this.actualizandoEstadoSeccionId.set(seccionId);

    this.seccionService.actualizarEstado(seccionId, activa).subscribe({
      next: (seccionActualizada) => {
        this.actualizandoEstadoSeccionId.set(null);
        this.secciones.update((actual) =>
          actual.map((seccion) => (seccion.id === seccionId ? seccionActualizada : seccion))
        );
        this.mostrarAlerta(
          'success',
          activa ? 'Seccion habilitada' : 'Seccion deshabilitada',
          activa
            ? 'Seccion habilitada correctamente para este periodo.'
            : 'Seccion deshabilitada correctamente para este periodo.',
          { confirmText: null, autoCloseMs: 3000 }
        );
      },
      error: (error) => {
        this.actualizandoEstadoSeccionId.set(null);
        this.mostrarAlerta(
          'error',
          activa ? 'No se pudo habilitar' : 'No se pudo deshabilitar',
          error?.error?.mensaje ??
          (activa ? 'No se pudo habilitar la seccion.' : 'No se pudo deshabilitar la seccion.')
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

  totalMatriculadosGrado(gradoId: number): number {
    return this.matriculas().filter((matricula) => matricula.gradoId === gradoId).length;
  }

  totalSeccionesGrado(gradoId: number): number {
    return this.secciones().filter(
      (seccion) => seccion.gradoId === gradoId && (seccion.estado ?? 'ACTIVO') === 'ACTIVO'
    ).length;
  }

  totalMatriculadosSeccion(seccionId: number): number {
    return this.matriculas().filter((matricula) => matricula.seccionId === seccionId).length;
  }
}
