import { Component, computed, inject, signal } from '@angular/core';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { CursoPeriodoAcademico } from '../../models/curso-periodo-academico';
import { Docente } from '../../models/docente';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { CursoPeriodoAcademicoService } from '../../services/academico/curso-periodo-academico.service';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';

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
  selector: 'app-asignaciones-docente',
  imports: [Shell, CustomAlertComponent],
  templateUrl: './asignaciones-docente.html',
  styleUrl: './asignaciones-docente.scss'
})
export class AsignacionesDocente {
  private readonly docenteService = inject(DocenteService);
  private readonly cursoPeriodoAcademicoService = inject(CursoPeriodoAcademicoService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);
  readonly currentYear = new Date().getFullYear();

  readonly docentes = signal<Docente[]>([]);
  readonly cursos = signal<Curso[]>([]);
  readonly cursosPeriodo = signal<CursoPeriodoAcademico[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly asignaciones = signal<AsignacionDocente[]>([]);

  readonly cargandoDocentes = signal(true);
  readonly cargandoCursos = signal(true);
  readonly cargandoSecciones = signal(true);
  readonly cargandoPeriodos = signal(true);
  readonly cargandoAsignaciones = signal(true);
  readonly guardando = signal(false);

  readonly errorDocentes = signal<string | null>(null);
  readonly errorCursos = signal<string | null>(null);
  readonly errorSecciones = signal<string | null>(null);
  readonly errorPeriodos = signal<string | null>(null);
  readonly errorAsignaciones = signal<string | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });

  readonly docenteSeleccionado = signal<Docente | null>(null);
  readonly cursoSeleccionado = signal<Curso | null>(null);
  readonly seccionSeleccionada = signal<Seccion | null>(null);
  readonly periodoSeleccionado = signal<PeriodoAcademico | null>(null);

  readonly docenteQuery = signal('');
  readonly cursoQuery = signal('');
  readonly seccionQuery = signal('');
  readonly periodoQuery = signal('');

  readonly dropdownActivo = signal(false);
  readonly modalDocenteAbierto = signal(false);
  readonly modalCursoAbierto = signal(false);
  readonly modalSeccionAbierto = signal(false);
  readonly modalPeriodoAbierto = signal(false);

  readonly modalBusquedaDocente = signal('');
  readonly modalBusquedaCurso = signal('');
  readonly modalBusquedaSeccion = signal('');
  readonly modalBusquedaPeriodo = signal('');

  readonly cursoNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');
  readonly seccionNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');

  readonly docentesFiltrados = computed(() => {
    const query = this.docenteQuery().trim().toLowerCase();
    return this.docentes().filter((docente) => this.coincideDocente(docente, query)).slice(0, 6);
  });

  readonly docentesModalFiltrados = computed(() => {
    const query = this.modalBusquedaDocente().trim().toLowerCase();
    return this.docentes().filter((docente) => this.coincideDocente(docente, query));
  });

  readonly cursosModalFiltrados = computed(() => {
    const nivel = this.cursoNivelActivo();
    const query = this.modalBusquedaCurso().trim().toLowerCase();

    return this.cursos().filter((curso) => {
      if (curso.nivelNombre !== nivel) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [curso.nombre, curso.descripcion ?? ''].join(' ').toLowerCase().includes(query);
    });
  });

  readonly seccionesModalFiltradas = computed(() => {
    const nivel = this.seccionNivelActivo();
    const query = this.modalBusquedaSeccion().trim().toLowerCase();

    return this.secciones().filter((seccion) => {
      if (seccion.nivelNombre !== nivel) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        seccion.nombre,
        seccion.gradoNombre ?? '',
        seccion.nivelNombre ?? '',
        seccion.capacidad?.toString() ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  readonly periodosModalFiltrados = computed(() => {
    const query = this.modalBusquedaPeriodo().trim().toLowerCase();

    return [...this.periodos()]
      .filter((periodo) => {
        if (!query) {
          return true;
        }

        return [periodo.nombre, periodo.anio.toString()].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => a.anio - b.anio);
  });

  readonly esPeriodoEditable = computed(() => {
    const periodo = this.periodoSeleccionado();
    return periodo ? periodo.anio === this.currentYear : false;
  });

  constructor() {
    this.cargarCatalogos();
  }

  cargarCatalogos(): void {
    this.cargarDocentes();
    this.cargarPeriodos();
  }

  cargarDocentes(): void {
    this.cargandoDocentes.set(true);
    this.errorDocentes.set(null);

    this.docenteService.listar().subscribe({
      next: (response) => {
        this.docentes.set(response);
        this.cargandoDocentes.set(false);
      },
      error: () => {
        this.errorDocentes.set('No se pudieron cargar los docentes.');
        this.cargandoDocentes.set(false);
      }
    });
  }

  cargarCursos(periodoAcademicoId?: number | null): void {
    this.cargandoCursos.set(true);
    this.errorCursos.set(null);
    this.cursos.set([]);
    this.cursoSeleccionado.set(null);
    this.cursoQuery.set('');

    this.cursoPeriodoAcademicoService.listar(periodoAcademicoId).subscribe({
      next: (response) => {
        this.cursosPeriodo.set(response);
        this.cursos.set(
          response
            .filter((cursoPeriodo) => cursoPeriodo.estado !== 'INACTIVO')
            .map((cursoPeriodo) => ({
              id: cursoPeriodo.cursoId,
              nivelId: cursoPeriodo.nivelId,
              nivelNombre: cursoPeriodo.nivelNombre,
              nombre: cursoPeriodo.cursoNombre,
              descripcion: cursoPeriodo.cursoDescripcion,
              estado: cursoPeriodo.estado
            }))
            .sort(
              (a, b) =>
                a.nivelNombre.localeCompare(b.nivelNombre) ||
                a.nombre.localeCompare(b.nombre)
            )
        );
        this.cargandoCursos.set(false);
      },
      error: () => {
        this.errorCursos.set('No se pudieron cargar los cursos habilitados para este periodo.');
        this.cargandoCursos.set(false);
      }
    });
  }

  cargarSecciones(periodoAcademicoId?: number | null): void {
    this.cargandoSecciones.set(true);
    this.errorSecciones.set(null);
    this.secciones.set([]);
    this.seccionSeleccionada.set(null);
    this.seccionQuery.set('');

    this.seccionService.listar(periodoAcademicoId).subscribe({
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

  cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.errorPeriodos.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        const periodosOrdenados = [...response].sort((a, b) => a.anio - b.anio);
        this.periodos.set(periodosOrdenados);
        this.cargandoPeriodos.set(false);

        if (!this.periodoSeleccionado() && periodosOrdenados.length) {
          const periodoActual =
            periodosOrdenados.find((periodo) => periodo.anio === this.currentYear) ??
            [...periodosOrdenados].sort((a, b) => b.anio - a.anio)[0];

          if (periodoActual) {
            this.seleccionarPeriodo(periodoActual);
          }
          return;
        }

        this.cargarCursos(this.periodoSeleccionado()?.id ?? null);
        this.cargarSecciones(this.periodoSeleccionado()?.id ?? null);
        this.cargarAsignaciones();
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
        this.cargandoAsignaciones.set(false);
      }
    });
  }

  cargarAsignaciones(): void {
    const periodo = this.periodoSeleccionado();

    if (!periodo) {
      this.asignaciones.set([]);
      this.cargandoAsignaciones.set(false);
      return;
    }

    this.cargandoAsignaciones.set(true);
    this.errorAsignaciones.set(null);

    this.asignacionAcademicaService.listarPorPeriodo(periodo.id).subscribe({
      next: (response) => {
        this.asignaciones.set(response);
        this.cargandoAsignaciones.set(false);
      },
      error: (error) => {
        this.errorAsignaciones.set(
          error?.error?.mensaje ?? 'No se pudieron cargar las asignaciones del periodo.'
        );
        this.cargandoAsignaciones.set(false);
      }
    });
  }

  onDocenteInput(value: string): void {
    this.docenteQuery.set(value);
    this.docenteSeleccionado.set(null);
    this.dropdownActivo.set(true);
  }

  seleccionarDocente(docente: Docente): void {
    this.docenteSeleccionado.set(docente);
    this.docenteQuery.set(this.formatearDocente(docente));
    this.dropdownActivo.set(false);
    this.modalDocenteAbierto.set(false);
  }

  abrirModalDocente(): void {
    this.dropdownActivo.set(false);
    this.modalBusquedaDocente.set('');
    this.modalDocenteAbierto.set(true);
  }

  cerrarModalDocente(): void {
    this.modalDocenteAbierto.set(false);
  }

  abrirModalCurso(): void {
    this.modalBusquedaCurso.set('');
    this.modalCursoAbierto.set(true);
  }

  cerrarModalCurso(): void {
    this.modalCursoAbierto.set(false);
  }

  seleccionarCurso(curso: Curso): void {
    this.cursoSeleccionado.set(curso);
    this.cursoQuery.set(curso.nombre);
    this.modalCursoAbierto.set(false);
  }

  abrirModalSeccion(): void {
    this.modalBusquedaSeccion.set('');
    this.seccionNivelActivo.set('PRIMARIA');
    this.cargarSecciones(this.periodoSeleccionado()?.id ?? null);
    this.modalSeccionAbierto.set(true);
  }

  cerrarModalSeccion(): void {
    this.modalSeccionAbierto.set(false);
  }

  seleccionarSeccion(seccion: Seccion): void {
    this.seccionSeleccionada.set(seccion);
    this.seccionQuery.set(`${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim());
    this.modalSeccionAbierto.set(false);
  }

  abrirModalPeriodo(): void {
    this.modalBusquedaPeriodo.set('');
    this.modalPeriodoAbierto.set(true);
  }

  cerrarModalPeriodo(): void {
    this.modalPeriodoAbierto.set(false);
  }

  seleccionarPeriodo(periodo: PeriodoAcademico): void {
    if (periodo.anio !== this.currentYear) {
      return;
    }

    this.periodoSeleccionado.set(periodo);
    this.periodoQuery.set(this.formatearPeriodo(periodo));
    this.modalPeriodoAbierto.set(false);
    this.seccionNivelActivo.set('PRIMARIA');
    this.cargarCursos(periodo.id);
    this.cargarSecciones(periodo.id);
    this.cargarAsignaciones();
  }

  esPeriodoSeleccionable(periodo: PeriodoAcademico): boolean {
    return periodo.anio === this.currentYear;
  }

  limpiarFormulario(): void {
    this.docenteSeleccionado.set(null);
    this.cursoSeleccionado.set(null);
    this.seccionSeleccionada.set(null);
    this.docenteQuery.set('');
    this.cursoQuery.set('');
    this.seccionQuery.set('');
    this.dropdownActivo.set(false);
  }

  guardarAsignacion(): void {
    const docente = this.docenteSeleccionado();
    const curso = this.cursoSeleccionado();
    const seccion = this.seccionSeleccionada();
    const periodo = this.periodoSeleccionado();

    if (!this.esPeriodoEditable()) {
      this.mostrarAlerta(
        'warning',
        'Periodo historico',
        'Solo puedes registrar asignaciones en el periodo academico del anio actual.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    if (!docente || !curso || !seccion || !periodo) {
      this.mostrarAlerta(
        'warning',
        'Completa la asignacion',
        'Selecciona docente, curso, seccion y periodo antes de guardar la asignacion.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.guardando.set(true);

    this.asignacionAcademicaService
      .crear({
        docenteId: docente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        periodoAcademicoId: periodo.id
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.limpiarFormulario();
          this.periodoQuery.set(this.formatearPeriodo(periodo));
          this.mostrarAlerta(
            'success',
            'Asignacion registrada',
            'La asignacion docente se registro correctamente.',
            { confirmText: null, autoCloseMs: 3000 }
          );
          this.cargarAsignaciones();
        },
        error: (error) => {
          this.guardando.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            error?.error?.mensaje ?? 'No se pudo registrar la asignacion docente.'
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

  formatearDocente(docente: Docente): string {
    return `${docente.apellidos}, ${docente.nombres}`;
  }

  formatearPeriodo(periodo: PeriodoAcademico): string {
    return `${periodo.nombre} (${periodo.anio})`;
  }

  obtenerResumenFila(asignacion: AsignacionDocente): string {
    return `${asignacion.grado} · Seccion ${asignacion.seccion}`;
  }

  private coincideDocente(docente: Docente, query: string): boolean {
    if (!query) {
      return true;
    }

    return [
      docente.nombres,
      docente.apellidos,
      docente.dni ?? '',
      docente.especialidad ?? '',
      docente.username ?? ''
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
