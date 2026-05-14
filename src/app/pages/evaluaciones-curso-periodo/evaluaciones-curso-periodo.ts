import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import {
  ConfiguracionEvaluacionCursoDetalle,
  ConfiguracionEvaluacionCursoItem,
  ConfiguracionEvaluacionCursoResumen
} from '../../models/configuracion-evaluacion-curso';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { TipoEvaluacion } from '../../models/tipo-evaluacion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { ConfiguracionEvaluacionCursoService } from '../../services/evaluacion/configuracion-evaluacion-curso.service';
import { TipoEvaluacionService } from '../../services/evaluacion/tipo-evaluacion.service';

interface ConfiguracionCursoEditable extends ConfiguracionEvaluacionCursoItem {
  cantidadActual: number;
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
  selector: 'app-evaluaciones-curso-periodo',
  imports: [Shell, RouterLink, FormsModule, CustomAlertComponent],
  templateUrl: './evaluaciones-curso-periodo.html',
  styleUrl: './evaluaciones-curso-periodo.scss'
})
export class EvaluacionesCursoPeriodo {
  private readonly route = inject(ActivatedRoute);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly tipoEvaluacionService = inject(TipoEvaluacionService);
  private readonly configuracionCursoService = inject(ConfiguracionEvaluacionCursoService);

  readonly periodoId = Number(this.route.snapshot.paramMap.get('periodoId'));
  readonly currentYear = new Date().getFullYear();

  readonly periodo = signal<PeriodoAcademico | null>(null);
  readonly cursos = signal<ConfiguracionEvaluacionCursoResumen[]>([]);
  readonly tiposEvaluacion = signal<TipoEvaluacion[]>([]);
  readonly cursoSeleccionadoId = signal<number | null>(null);
  readonly detalleCurso = signal<ConfiguracionEvaluacionCursoDetalle | null>(null);
  readonly configuracionesEditables = signal<ConfiguracionCursoEditable[]>([]);
  readonly filtroCursos = signal('');
  readonly nivelSeleccionado = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');

  readonly cargandoPeriodo = signal(true);
  readonly cargandoCursos = signal(true);
  readonly cargandoTipos = signal(true);
  readonly cargandoDetalle = signal(false);
  readonly guardando = signal(false);

  readonly errorCursos = signal<string | null>(null);
  readonly errorDetalle = signal<string | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });

  readonly esPeriodoEditable = computed(() => {
    const periodo = this.periodo();
    return periodo ? periodo.anio === this.currentYear : false;
  });

  readonly cursosFiltrados = computed(() => {
    const filtro = this.filtroCursos().trim().toLowerCase();
    const nivel = this.nivelSeleccionado();
    const base = this.cursos().filter((curso) => curso.nivelNombre.toUpperCase().includes(nivel));

    if (!filtro) {
      return base;
    }

    return base.filter((curso) =>
      curso.nombreCurso.toLowerCase().includes(filtro) ||
      (curso.descripcionCurso ?? '').toLowerCase().includes(filtro) ||
      curso.nivelNombre.toLowerCase().includes(filtro)
    );
  });

  readonly cursoSeleccionado = computed(
    () => this.cursos().find((curso) => curso.cursoId === this.cursoSeleccionadoId()) ?? null
  );

  constructor() {
    this.cargarPeriodo();
    this.cargarTiposEvaluacion();
    this.cargarCursos();
  }

  cargarPeriodo(): void {
    this.cargandoPeriodo.set(true);
    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        this.periodo.set(response.find((periodo) => periodo.id === this.periodoId) ?? null);
        this.cargandoPeriodo.set(false);
      },
      error: () => {
        this.cargandoPeriodo.set(false);
      }
    });
  }

  cargarTiposEvaluacion(): void {
    this.cargandoTipos.set(true);
    this.tipoEvaluacionService.listar().subscribe({
      next: (response) => {
        this.tiposEvaluacion.set(
          response
            .filter((tipo) => tipo.estado !== 'INACTIVO')
            .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
        );
        this.cargandoTipos.set(false);
      },
      error: () => {
        this.tiposEvaluacion.set([]);
        this.cargandoTipos.set(false);
      }
    });
  }

  cargarCursos(): void {
    this.cargandoCursos.set(true);
    this.errorCursos.set(null);
    this.configuracionCursoService.listarCursos(this.periodoId).subscribe({
      next: (response) => {
        this.cursos.set(response);
        this.cargandoCursos.set(false);
        if (response.length && !this.cursoSeleccionadoId()) {
          this.seleccionarCurso(response[0].cursoId);
        }
      },
      error: () => {
        this.errorCursos.set('No se pudieron cargar los cursos del periodo.');
        this.cargandoCursos.set(false);
      }
    });
  }

  seleccionarCurso(cursoId: number): void {
    if (this.cursoSeleccionadoId() === cursoId) {
      return;
    }

    this.cursoSeleccionadoId.set(cursoId);
    this.cargarDetalleCurso(cursoId);
  }

  cargarDetalleCurso(cursoId: number): void {
    this.cargandoDetalle.set(true);
    this.errorDetalle.set(null);
    this.configuracionCursoService.obtenerDetalle(this.periodoId, cursoId).subscribe({
      next: (detalle) => {
        this.detalleCurso.set(detalle);
        this.configuracionesEditables.set(this.construirConfiguracionesEditables(detalle));
        this.cargandoDetalle.set(false);
      },
      error: () => {
        this.detalleCurso.set(null);
        this.configuracionesEditables.set([]);
        this.errorDetalle.set('No se pudo cargar la configuracion del curso.');
        this.cargandoDetalle.set(false);
      }
    });
  }

  actualizarFiltroCursos(valor: string): void {
    this.filtroCursos.set(valor);
  }

  seleccionarNivel(nivel: 'PRIMARIA' | 'SECUNDARIA'): void {
    this.nivelSeleccionado.set(nivel);
  }

  actualizarCantidad(tipoEvaluacionId: number, valor: string): void {
    const cantidad = Math.max(0, Number(valor || 0));
    this.configuracionesEditables.update((actual) =>
      actual.map((configuracion) =>
        configuracion.tipoEvaluacionId === tipoEvaluacionId
          ? { ...configuracion, cantidadActual: cantidad }
          : configuracion
      )
    );
  }

  alternarTipo(configuracion: ConfiguracionCursoEditable): void {
    if (configuracion.cantidadActual > 0) {
      this.actualizarCantidad(configuracion.tipoEvaluacionId, '0');
      return;
    }

    const cantidadRestaurada = configuracion.cantidadBasePeriodo > 0 ? configuracion.cantidadBasePeriodo : 1;
    this.actualizarCantidad(configuracion.tipoEvaluacionId, String(cantidadRestaurada));
  }

  restaurarPlantillaGeneral(): void {
    this.configuracionesEditables.update((actual) =>
      actual.map((configuracion) => ({
        ...configuracion,
        cantidadActual: configuracion.cantidadBasePeriodo
      }))
    );
  }

  guardarConfiguracion(): void {
    const detalle = this.detalleCurso();
    if (!detalle) {
      return;
    }

    this.guardando.set(true);
    this.configuracionCursoService.guardar({
      periodoAcademicoId: this.periodoId,
      cursoId: detalle.cursoId,
      configuraciones: this.configuracionesEditables().map((configuracion) => ({
        tipoEvaluacionId: configuracion.tipoEvaluacionId,
        cantidadEvaluaciones: configuracion.cantidadActual,
        calcularEnPromedio: true
      }))
    }).subscribe({
      next: (detalleActualizado) => {
        this.guardando.set(false);
        this.detalleCurso.set(detalleActualizado);
        this.configuracionesEditables.set(this.construirConfiguracionesEditables(detalleActualizado));
        this.cursos.update((actual) =>
          actual.map((curso) =>
            curso.cursoId === detalleActualizado.cursoId
              ? {
                  ...curso,
                  usaConfiguracionPersonalizada: detalleActualizado.usaConfiguracionPersonalizada,
                  totalTiposConfigurados: detalleActualizado.configuraciones.filter((item) => item.cantidadEvaluaciones > 0).length
                }
              : curso
          )
        );
        this.mostrarAlerta('success', 'Configuracion guardada', 'Las evaluaciones del curso se actualizaron correctamente.', {
          confirmText: null,
          autoCloseMs: 2800
        });
      },
      error: (error) => {
        this.guardando.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudo guardar',
          error?.error?.mensaje ?? 'No se pudo guardar la configuracion del curso.'
        );
      }
    });
  }

  private construirConfiguracionesEditables(detalle: ConfiguracionEvaluacionCursoDetalle): ConfiguracionCursoEditable[] {
    const detalleMap = new Map(detalle.configuraciones.map((configuracion) => [configuracion.tipoEvaluacionId, configuracion]));
    return this.tiposEvaluacion().map((tipo) => {
      const actual = detalleMap.get(tipo.id);
      return {
        tipoEvaluacionId: tipo.id,
        nombreTipoEvaluacion: tipo.nombre,
        descripcionTipoEvaluacion: tipo.descripcion,
        cantidadBasePeriodo: actual?.cantidadBasePeriodo ?? 0,
        cantidadEvaluaciones: actual?.cantidadEvaluaciones ?? 0,
        cantidadActual: actual?.cantidadEvaluaciones ?? 0,
        calcularEnPromedio: true
      };
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
}
