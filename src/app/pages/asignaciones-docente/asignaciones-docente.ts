import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { CursoPeriodoAcademico } from '../../models/curso-periodo-academico';
import { Docente } from '../../models/docente';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { Tutoria } from '../../models/tutoria';
import { CursoPeriodoAcademicoService } from '../../services/academico/curso-periodo-academico.service';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';

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
export class AsignacionesTutorias {
  private readonly docenteService = inject(DocenteService);
  private readonly cursoPeriodoAcademicoService = inject(CursoPeriodoAcademicoService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly currentYear = new Date().getFullYear();
  readonly vistaActiva = signal<'asignaciones' | 'tutorias'>('asignaciones');

  readonly docentes = signal<Docente[]>([]);
  readonly cargandoDocentes = signal(true);
  readonly errorDocentes = signal<string | null>(null);

  readonly cursos = signal<Curso[]>([]);
  readonly cursosPeriodo = signal<CursoPeriodoAcademico[]>([]);
  readonly cargandoCursos = signal(true);
  readonly errorCursos = signal<string | null>(null);

  readonly secciones = signal<Seccion[]>([]);
  readonly cargandoSecciones = signal(true);
  readonly errorSecciones = signal<string | null>(null);

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly errorPeriodos = signal<string | null>(null);
  readonly tutorias = signal<Tutoria[]>([]);
  readonly cargandoTutorias = signal(true);
  readonly errorTutorias = signal<string | null>(null);
  readonly guardandoTutoria = signal(false);
  readonly guardandoAsignacion = signal(false);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly cargandoAsignaciones = signal(true);
  readonly errorAsignaciones = signal<string | null>(null);
  readonly actualizandoEstadoAsignacionId = signal<number | null>(null);
  readonly actualizandoEstadoTutoriaId = signal<number | null>(null);
  readonly cargaPendienteAlerta = signal<'asignaciones' | 'tutorias' | null>(null);
  readonly modalCargaPendiente = signal<'docentes' | 'cursos' | 'secciones' | 'periodos' | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });
  readonly tutoriaPendienteEstado = signal<{ id: number; activa: boolean } | null>(null);
  readonly asignacionPendienteEstado = signal<{ id: number; activa: boolean } | null>(null);

  readonly asignacionDocente = signal<Docente | null>(null);
  readonly tutoriaDocente = signal<Docente | null>(null);
  readonly asignacionCurso = signal<Curso | null>(null);
  readonly asignacionSecciones = signal<Seccion[]>([]);
  readonly tutoriaSeccion = signal<Seccion | null>(null);
  readonly asignacionPeriodo = signal<PeriodoAcademico | null>(null);
  readonly tutoriaPeriodo = signal<PeriodoAcademico | null>(null);

  readonly asignacionQuery = signal('');
  readonly tutoriaQuery = signal('');
  readonly cursoQuery = signal('');
  readonly asignacionSeccionQuery = signal('');
  readonly tutoriaSeccionQuery = signal('');
  readonly asignacionPeriodoQuery = signal('');
  readonly tutoriaPeriodoQuery = signal('');

  readonly dropdownActivo = signal<'asignacion' | 'tutoria' | null>(null);
  readonly modalContexto = signal<'asignacion' | 'tutoria' | null>(null);
  readonly modalBusqueda = signal('');

  readonly cursoModalAbierto = signal(false);
  readonly cursoNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');
  readonly cursoModalBusqueda = signal('');

  readonly seccionModalContexto = signal<'asignacion' | 'tutoria' | null>(null);
  readonly seccionNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');
  readonly seccionModalBusqueda = signal('');

  readonly periodoModalContexto = signal<'asignacion' | 'tutoria' | null>(null);
  readonly periodoModalBusqueda = signal('');

  readonly docentesModalFiltrados = computed(() => {
    const query = this.modalBusqueda().trim().toLowerCase();
    return this.docentes().filter((docente) => this.coincideDocente(docente, query));
  });

  readonly cursosModalFiltrados = computed(() => {
    const nivel = this.cursoNivelActivo();
    const query = this.cursoModalBusqueda().trim().toLowerCase();

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
    const query = this.seccionModalBusqueda().trim().toLowerCase();

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
    const query = this.periodoModalBusqueda().trim().toLowerCase();

    return [...this.periodos()]
      .filter((periodo) => {
        if (!query) {
          return true;
        }

        return [periodo.nombre, periodo.anio.toString()].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => a.anio - b.anio);
  });

  readonly esTutoriaEditable = computed(() => {
    const periodo = this.tutoriaPeriodo();
    return periodo ? periodo.anio === this.currentYear : false;
  });

  constructor() {
    this.cargarDocentes();
    this.cargarCursos();
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
        this.modalCargaPendiente.set('docentes');
        this.mostrarAlerta(
          'error',
          'Sin conexion con el servicio',
          'No se pudo cargar la lista de docentes. Puedes cerrar este aviso o volver a intentar.',
          {
            confirmText: 'Volver a intentar',
            cancelText: 'Cerrar',
            autoCloseMs: null
          }
        );
      }
    });
  }

  cargarCursos(): void {
    this.cargandoCursos.set(true);
    this.errorCursos.set(null);
    this.cursos.set([]);
    this.cursosPeriodo.set([]);
    this.asignacionCurso.set(null);
    this.cursoQuery.set('');

    this.cursoPeriodoAcademicoService.listar(this.asignacionPeriodo()?.id ?? null).subscribe({
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
              portadaColor: null,
              portadaIcono: null,
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
        this.modalCargaPendiente.set('cursos');
        this.mostrarAlerta(
          'error',
          'Sin conexion con el servicio',
          'No se pudo cargar la lista de cursos. Puedes cerrar este aviso o volver a intentar.',
          {
            confirmText: 'Volver a intentar',
            cancelText: 'Cerrar',
            autoCloseMs: null
          }
        );
      }
    });
  }

  cargarSecciones(periodoAcademicoId?: number | null): void {
    this.cargandoSecciones.set(true);
    this.errorSecciones.set(null);

    this.seccionService.listar(periodoAcademicoId ?? undefined).subscribe({
      next: (response) => {
        this.secciones.set(response);
        this.cargandoSecciones.set(false);
      },
      error: () => {
        this.errorSecciones.set('No se pudieron cargar las secciones.');
        this.cargandoSecciones.set(false);
        this.modalCargaPendiente.set('secciones');
        this.mostrarAlerta(
          'error',
          'Sin conexion con el servicio',
          'No se pudo cargar la lista de secciones. Puedes cerrar este aviso o volver a intentar.',
          {
            confirmText: 'Volver a intentar',
            cancelText: 'Cerrar',
            autoCloseMs: null
          }
        );
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

        if ((!this.tutoriaPeriodo() || !this.asignacionPeriodo()) && periodosOrdenados.length) {
          const periodoActual =
            periodosOrdenados.find((periodo) => periodo.anio === this.currentYear) ??
            [...periodosOrdenados].sort((a, b) => b.anio - a.anio)[0];

          if (periodoActual) {
            if (!this.asignacionPeriodo()) {
              this.seleccionarPeriodo('asignacion', periodoActual);
            }
            this.seleccionarPeriodo('tutoria', periodoActual);
          }
          return;
        }

        this.cargarSecciones(this.tutoriaPeriodo()?.id ?? null);
        this.cargarCursos();
        this.cargarAsignaciones();
        this.cargarTutorias();
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.errorAsignaciones.set('No se pudieron cargar las asignaciones del periodo.');
        this.errorTutorias.set('No se pudieron cargar las tutorias del periodo.');
        this.cargandoPeriodos.set(false);
        this.cargandoAsignaciones.set(false);
        this.cargandoTutorias.set(false);
        this.cargaPendienteAlerta.set(this.vistaActiva() === 'asignaciones' ? 'asignaciones' : 'tutorias');
        this.mostrarAlerta(
          'error',
          'Sin conexion con el servicio',
          'No se pudo cargar la configuracion base de periodos. Puedes cerrar este aviso o volver a intentar.',
          {
            confirmText: 'Volver a intentar',
            cancelText: 'Cerrar',
            autoCloseMs: null
          }
        );
      }
    });
  }

  cargarAsignaciones(): void {
    const periodo = this.asignacionPeriodo();

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
        this.cargaPendienteAlerta.set('asignaciones');
        this.mostrarAlerta(
          'error',
          'Sin conexion con el servicio',
          'No se pudo cargar la tabla de asignaciones. Puedes cerrar este aviso o volver a intentar.',
          {
            confirmText: 'Volver a intentar',
            cancelText: 'Cerrar',
            autoCloseMs: null
          }
        );
      }
    });
  }

  cargarTutorias(): void {
    const periodo = this.tutoriaPeriodo();

    if (!periodo) {
      this.tutorias.set([]);
      this.cargandoTutorias.set(false);
      return;
    }

    this.cargandoTutorias.set(true);
    this.errorTutorias.set(null);

    this.tutoriaService.listarPorPeriodo(periodo.id).subscribe({
      next: (response) => {
        this.tutorias.set(response);
        this.cargandoTutorias.set(false);
      },
      error: (error) => {
        this.errorTutorias.set(
          error?.error?.mensaje ?? 'No se pudieron cargar las tutorias del periodo.'
        );
        this.cargandoTutorias.set(false);
        this.cargaPendienteAlerta.set('tutorias');
        this.mostrarAlerta(
          'error',
          'Sin conexion con el servicio',
          'No se pudo cargar la tabla de tutorias. Puedes cerrar este aviso o volver a intentar.',
          {
            confirmText: 'Volver a intentar',
            cancelText: 'Cerrar',
            autoCloseMs: null
          }
        );
      }
    });
  }

  onDocenteInput(contexto: 'asignacion' | 'tutoria', value: string): void {
    if (contexto === 'asignacion') {
      this.asignacionQuery.set(value);
      this.asignacionDocente.set(null);
    } else {
      this.tutoriaQuery.set(value);
      this.tutoriaDocente.set(null);
    }

    this.dropdownActivo.set(contexto);
  }

  docentesFiltrados(contexto: 'asignacion' | 'tutoria'): Docente[] {
    const query = (contexto === 'asignacion' ? this.asignacionQuery() : this.tutoriaQuery())
      .trim()
      .toLowerCase();

    return this.docentes()
      .filter((docente) => this.coincideDocente(docente, query))
      .slice(0, 6);
  }

  seleccionarDocente(contexto: 'asignacion' | 'tutoria', docente: Docente): void {
    const etiqueta = this.formatearDocente(docente);

    if (contexto === 'asignacion') {
      this.asignacionDocente.set(docente);
      this.asignacionQuery.set(etiqueta);
    } else {
      this.tutoriaDocente.set(docente);
      this.tutoriaQuery.set(etiqueta);
    }

    this.dropdownActivo.set(null);
    this.modalContexto.set(null);
  }

  abrirModal(contexto: 'asignacion' | 'tutoria'): void {
    this.modalContexto.set(contexto);
    this.modalBusqueda.set('');
    this.dropdownActivo.set(null);
  }

  cerrarModal(): void {
    this.modalContexto.set(null);
  }

  abrirModalCurso(): void {
    this.cursoModalAbierto.set(true);
    this.cursoModalBusqueda.set('');
  }

  cerrarModalCurso(): void {
    this.cursoModalAbierto.set(false);
  }

  seleccionarCurso(curso: Curso): void {
    this.asignacionCurso.set(curso);
    this.cursoQuery.set(curso.nombre);
    this.cursoModalAbierto.set(false);
  }

  abrirModalSeccion(contexto: 'asignacion' | 'tutoria'): void {
    this.seccionModalContexto.set(contexto);
    this.seccionModalBusqueda.set('');
    this.cargarSecciones(
      contexto === 'asignacion' ? this.asignacionPeriodo()?.id ?? null : this.tutoriaPeriodo()?.id ?? null
    );
  }

  cerrarModalSeccion(): void {
    this.seccionModalContexto.set(null);
  }

  seleccionarSeccion(contexto: 'asignacion' | 'tutoria', seccion: Seccion): void {
    const etiqueta = `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim();

    if (contexto === 'asignacion') {
      const seleccionadas = this.asignacionSecciones();
      const existe = seleccionadas.some((item) => item.id === seccion.id);
      const siguiente = existe
        ? seleccionadas.filter((item) => item.id !== seccion.id)
        : [...seleccionadas, seccion];

      this.asignacionSecciones.set(siguiente);
      this.asignacionSeccionQuery.set(this.formatearSeccionesAsignacion(siguiente));
    } else {
      this.tutoriaSeccion.set(seccion);
      this.tutoriaSeccionQuery.set(etiqueta);
      this.seccionModalContexto.set(null);
    }
  }

  confirmarSeleccionSeccionesAsignacion(): void {
    this.seccionModalContexto.set(null);
  }

  limpiarSeccionesAsignacion(): void {
    this.asignacionSecciones.set([]);
    this.asignacionSeccionQuery.set('');
  }

  seccionAsignacionSeleccionada(seccionId: number): boolean {
    return this.asignacionSecciones().some((seccion) => seccion.id === seccionId);
  }

  abrirModalPeriodo(contexto: 'asignacion' | 'tutoria'): void {
    this.periodoModalContexto.set(contexto);
    this.periodoModalBusqueda.set('');
  }

  cerrarModalPeriodo(): void {
    this.periodoModalContexto.set(null);
  }

  seleccionarPeriodo(contexto: 'asignacion' | 'tutoria', periodo: PeriodoAcademico): void {
    if (!this.esPeriodoSeleccionable(periodo)) {
      return;
    }

    const etiqueta = this.formatearPeriodo(periodo);

    if (contexto === 'asignacion') {
      this.asignacionPeriodo.set(periodo);
      this.asignacionPeriodoQuery.set(etiqueta);
      this.limpiarSeccionesAsignacion();
      this.cargarSecciones(periodo.id);
      this.cargarCursos();
      this.cargarAsignaciones();
    } else {
      this.tutoriaPeriodo.set(periodo);
      this.tutoriaPeriodoQuery.set(etiqueta);
      this.tutoriaSeccion.set(null);
      this.tutoriaSeccionQuery.set('');
      this.cargarSecciones(periodo.id);
      this.cargarTutorias();
    }

    this.periodoModalContexto.set(null);
  }

  esPeriodoSeleccionable(periodo: PeriodoAcademico): boolean {
    return periodo.anio === this.currentYear;
  }

  limpiarAsignacion(): void {
    this.asignacionDocente.set(null);
    this.asignacionCurso.set(null);
    this.asignacionSecciones.set([]);
    this.asignacionQuery.set('');
    this.cursoQuery.set('');
    this.asignacionSeccionQuery.set('');
    this.dropdownActivo.set(null);
  }

  guardarAsignacion(): void {
    const docente = this.asignacionDocente();
    const curso = this.asignacionCurso();
    const secciones = this.asignacionSecciones();
    const periodo = this.asignacionPeriodo();

    if (!periodo || periodo.anio !== this.currentYear) {
      this.mostrarAlerta(
        'warning',
        'Periodo historico',
        'Solo puedes registrar asignaciones en el periodo academico del anio actual.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    if (!docente || !curso || !secciones.length) {
      this.mostrarAlerta(
        'warning',
        'Completa la asignacion',
        'Selecciona docente, curso, una o varias secciones y periodo antes de guardar la asignacion.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.guardandoAsignacion.set(true);

    forkJoin(
      secciones.map((seccion) =>
        this.asignacionAcademicaService.crear({
          docenteId: docente.id,
          cursoId: curso.id,
          seccionId: seccion.id,
          periodoAcademicoId: periodo.id
        })
      )
    )
      .subscribe({
        next: () => {
          this.guardandoAsignacion.set(false);
          this.limpiarAsignacion();
          this.asignacionPeriodoQuery.set(this.formatearPeriodo(periodo));
          this.mostrarAlerta(
            'success',
            'Asignacion registrada',
            secciones.length === 1
              ? 'La asignacion docente se registro correctamente.'
              : `Se registraron ${secciones.length} asignaciones para las secciones seleccionadas.`,
            { confirmText: null, autoCloseMs: 3000 }
          );
          this.cargarAsignaciones();
        },
        error: (error) => {
          this.guardandoAsignacion.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            error?.error?.mensaje ?? 'No se pudo registrar la asignacion docente.'
          );
        }
      });
  }

  limpiarTutoria(): void {
    this.tutoriaDocente.set(null);
    this.tutoriaSeccion.set(null);
    this.tutoriaQuery.set('');
    this.tutoriaSeccionQuery.set('');
    this.dropdownActivo.set(null);
  }

  guardarTutoria(): void {
    const docente = this.tutoriaDocente();
    const seccion = this.tutoriaSeccion();
    const periodo = this.tutoriaPeriodo();

    if (!this.esTutoriaEditable()) {
      this.mostrarAlerta(
        'warning',
        'Periodo historico',
        'Solo puedes registrar tutorias en el periodo academico del anio actual.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    if (!docente || !seccion || !periodo) {
      this.mostrarAlerta(
        'warning',
        'Completa la tutoria',
        'Selecciona docente tutor, seccion y periodo antes de guardar la tutoria.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.guardandoTutoria.set(true);

    this.tutoriaService
      .crear({
        docenteId: docente.id,
        seccionId: seccion.id,
        periodoAcademicoId: periodo.id
      })
      .subscribe({
        next: () => {
          this.guardandoTutoria.set(false);
          this.limpiarTutoria();
          this.tutoriaPeriodoQuery.set(this.formatearPeriodo(periodo));
          this.mostrarAlerta(
            'success',
            'Tutoria registrada',
            'La tutoria se registro correctamente.',
            { confirmText: null, autoCloseMs: 3000 }
          );
          this.cargarTutorias();
        },
        error: (error) => {
          this.guardandoTutoria.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            error?.error?.mensaje ?? 'No se pudo registrar la tutoria.'
          );
        }
      });
  }

  toggleEstadoTutoria(tutoria: Tutoria): void {
    const activa = (tutoria.estado ?? 'ACTIVO') === 'ACTIVO';

    if (activa) {
      this.tutoriaPendienteEstado.set({ id: tutoria.id, activa: false });
      this.mostrarAlerta(
        'warning',
        'Deshabilitar tutoria',
        'Esta seguro que quiere deshabilitar esta tutoria para este periodo?',
        {
          confirmText: 'Deshabilitar',
          cancelText: 'Cancelar'
        }
      );
      return;
    }

    this.actualizarEstadoTutoria(tutoria.id, true);
  }

  toggleEstadoAsignacion(asignacion: AsignacionDocente): void {
    const activa = (asignacion.estado ?? 'ACTIVO') === 'ACTIVO';

    if (activa) {
      this.asignacionPendienteEstado.set({ id: asignacion.id, activa: false });
      this.mostrarAlerta(
        'warning',
        'Deshabilitar asignacion',
        'Esta seguro que quiere deshabilitar esta asignacion para este periodo?',
        {
          confirmText: 'Deshabilitar',
          cancelText: 'Cancelar'
        }
      );
      return;
    }

    this.actualizarEstadoAsignacion(asignacion.id, true);
  }

  confirmarCambioEstadoTutoria(): void {
    const modalPendiente = this.modalCargaPendiente();
    if (modalPendiente) {
      this.modalCargaPendiente.set(null);
      this.cerrarAlerta();
      if (modalPendiente === 'docentes') {
        this.cargarDocentes();
      } else if (modalPendiente === 'cursos') {
        this.cargarCursos();
      } else if (modalPendiente === 'secciones') {
        this.cargarSecciones(
          this.seccionModalContexto() === 'asignacion'
            ? this.asignacionPeriodo()?.id ?? null
            : this.tutoriaPeriodo()?.id ?? null
        );
      } else if (modalPendiente === 'periodos') {
        this.cargarPeriodos();
      }
      return;
    }

    const cargaPendiente = this.cargaPendienteAlerta();
    if (cargaPendiente) {
      this.cargaPendienteAlerta.set(null);
      this.cerrarAlerta();
      if (cargaPendiente === 'asignaciones') {
        this.cargarAsignaciones();
      } else {
        this.cargarTutorias();
      }
      return;
    }

    const asignacionPendiente = this.asignacionPendienteEstado();
    if (asignacionPendiente) {
      this.cerrarAlerta();
      this.actualizarEstadoAsignacion(asignacionPendiente.id, asignacionPendiente.activa);
      this.asignacionPendienteEstado.set(null);
      return;
    }

    const pendiente = this.tutoriaPendienteEstado();
    if (!pendiente) {
      this.cerrarAlerta();
      return;
    }

    this.cerrarAlerta();
    this.actualizarEstadoTutoria(pendiente.id, pendiente.activa);
    this.tutoriaPendienteEstado.set(null);
  }

  cancelarCambioEstadoTutoria(): void {
    this.modalCargaPendiente.set(null);
    this.cargaPendienteAlerta.set(null);
    this.asignacionPendienteEstado.set(null);
    this.tutoriaPendienteEstado.set(null);
    this.cerrarAlerta();
  }

  private actualizarEstadoAsignacion(asignacionId: number, activa: boolean): void {
    this.actualizandoEstadoAsignacionId.set(asignacionId);

    this.asignacionAcademicaService.actualizarEstado(asignacionId, activa).subscribe({
      next: (asignacionActualizada) => {
        this.actualizandoEstadoAsignacionId.set(null);
        this.asignaciones.update((actual) =>
          actual.map((asignacion) =>
            asignacion.id === asignacionId ? asignacionActualizada : asignacion
          )
        );
        this.mostrarAlerta(
          'success',
          activa ? 'Asignacion habilitada' : 'Asignacion deshabilitada',
          activa
            ? 'Asignacion habilitada correctamente para este periodo.'
            : 'Asignacion deshabilitada correctamente para este periodo.',
          { confirmText: null, autoCloseMs: 3000 }
        );
      },
      error: (error) => {
        this.actualizandoEstadoAsignacionId.set(null);
        this.mostrarAlerta(
          'error',
          activa ? 'No se pudo habilitar' : 'No se pudo deshabilitar',
          error?.error?.mensaje ??
            (activa
              ? 'No se pudo habilitar la asignacion.'
              : 'No se pudo deshabilitar la asignacion.')
        );
      }
    });
  }

  private actualizarEstadoTutoria(tutoriaId: number, activa: boolean): void {
    this.actualizandoEstadoTutoriaId.set(tutoriaId);

    this.tutoriaService.actualizarEstado(tutoriaId, activa).subscribe({
      next: (tutoriaActualizada) => {
        this.actualizandoEstadoTutoriaId.set(null);
        this.tutorias.update((actual) =>
          actual.map((tutoria) => (tutoria.id === tutoriaId ? tutoriaActualizada : tutoria))
        );
        this.mostrarAlerta(
          'success',
          activa ? 'Tutoria habilitada' : 'Tutoria deshabilitada',
          activa
            ? 'Tutoria habilitada correctamente para este periodo.'
            : 'Tutoria deshabilitada correctamente para este periodo.',
          { confirmText: null, autoCloseMs: 3000 }
        );
      },
      error: (error) => {
        this.actualizandoEstadoTutoriaId.set(null);
        this.mostrarAlerta(
          'error',
          activa ? 'No se pudo habilitar' : 'No se pudo deshabilitar',
          error?.error?.mensaje ??
            (activa ? 'No se pudo habilitar la tutoria.' : 'No se pudo deshabilitar la tutoria.')
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

  formatearSeccionesAsignacion(secciones: Seccion[]): string {
    if (!secciones.length) {
      return '';
    }

    if (secciones.length === 1) {
      return `${secciones[0].gradoNombre ?? ''} - ${secciones[0].nombre}`.trim();
    }

    if (secciones.length === 2) {
      return secciones
        .map((seccion) => `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim())
        .join(', ');
    }

    const primera = `${secciones[0].gradoNombre ?? ''} - ${secciones[0].nombre}`.trim();
    return `${primera} y ${secciones.length - 1} mas`;
  }

  removerSeccionAsignacion(seccionId: number): void {
    const siguiente = this.asignacionSecciones().filter((seccion) => seccion.id !== seccionId);
    this.asignacionSecciones.set(siguiente);
    this.asignacionSeccionQuery.set(this.formatearSeccionesAsignacion(siguiente));
  }

  etiquetaSeccion(seccion: Seccion): string {
    return `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim();
  }

  obtenerResumenAsignacion(asignacion: AsignacionDocente): string {
    return `${asignacion.grado} · Seccion ${asignacion.seccion}`;
  }

  private coincideDocente(docente: Docente, query: string): boolean {
    if (!query) {
      return true;
    }

    const texto = [
      docente.nombres,
      docente.apellidos,
      docente.dni ?? '',
      docente.especialidad ?? '',
      docente.username ?? ''
    ]
      .join(' ')
      .toLowerCase();

    return texto.includes(query);
  }
}
