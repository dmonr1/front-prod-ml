import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { Docente } from '../../models/docente';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { Tutoria } from '../../models/tutoria';
import { CursoService } from '../../services/academico/curso.service';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import { AuthService } from '../../services/auth/auth.service';
import { formatearMensajeError } from '../../utils/error-formatter';

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
  private readonly route = inject(ActivatedRoute);
  private readonly docenteService = inject(DocenteService);
  private readonly cursoService = inject(CursoService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);
  private readonly tutoriaService = inject(TutoriaService);
  private readonly authService = inject(AuthService);

  readonly currentYear = new Date().getFullYear();
  readonly vistaActiva = signal<'asignaciones' | 'tutorias'>('asignaciones');
  readonly modalCreacion = signal<'asignacion' | 'tutoria' | null>(null);

  readonly docentes = signal<Docente[]>([]);
  readonly cargandoDocentes = signal(true);
  readonly errorDocentes = signal<string | null>(null);

  readonly cursos = signal<Curso[]>([]);
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
  readonly busquedaTablaAsignaciones = signal('');
  readonly cursoFiltroAsignaciones = signal('');
  readonly seccionFiltroAsignaciones = signal('');
  readonly busquedaTablaTutorias = signal('');
  readonly nivelFiltroTutorias = signal('');
  readonly estadoFiltroTutorias = signal('');
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

  readonly esAdmin = computed(() => this.authService.esAdministrador());

  readonly asignacionEditando = signal<AsignacionDocente | null>(null);
  readonly guardandoEdicionAsignacion = signal(false);
  readonly edicionAsignacionDocente = signal<Docente | null>(null);
  readonly edicionAsignacionCurso = signal<Curso | null>(null);
  readonly edicionAsignacionSeccion = signal<Seccion | null>(null);
  readonly edicionAsignacionDocenteQuery = signal('');
  readonly edicionAsignacionCursoQuery = signal('');
  readonly edicionAsignacionSeccionQuery = signal('');

  readonly tutoriaEditando = signal<Tutoria | null>(null);
  readonly guardandoEdicionTutoria = signal(false);
  readonly edicionTutoriaDocente = signal<Docente | null>(null);
  readonly edicionTutoriaSeccion = signal<Seccion | null>(null);
  readonly edicionTutoriaDocenteQuery = signal('');
  readonly edicionTutoriaSeccionQuery = signal('');

  readonly dropdownActivo = signal<'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit' | null>(null);
  readonly modalContexto = signal<'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit' | null>(null);
  readonly modalBusqueda = signal('');

  readonly cursoModalAbierto = signal(false);
  readonly cursoNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');
  readonly cursoModalBusqueda = signal('');

  readonly seccionModalContexto = signal<'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit' | null>(null);
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
      if (curso.nivelNombre !== nivel || (curso.estado ?? 'ACTIVO') !== 'ACTIVO') {
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

  readonly cursosFiltroAsignaciones = computed(() => {
    const cursos = new Map<number, string>();
    this.asignaciones().forEach((asignacion) => cursos.set(asignacion.cursoId, asignacion.curso));
    return [...cursos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly seccionesFiltroAsignaciones = computed(() => {
    const cursoId = this.cursoFiltroAsignaciones();
    const secciones = new Map<number, string>();

    this.asignaciones()
      .filter((asignacion) => !cursoId || String(asignacion.cursoId) === cursoId)
      .forEach((asignacion) => {
        secciones.set(
          asignacion.seccionId,
          `${asignacion.grado} ${asignacion.nivel} · Sección ${asignacion.seccion}`
        );
      });

    return [...secciones].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly asignacionesFiltradas = computed(() => {
    const query = this.normalizarTexto(this.busquedaTablaAsignaciones());
    const cursoId = this.cursoFiltroAsignaciones();
    const seccionId = this.seccionFiltroAsignaciones();

    return this.asignaciones().filter((asignacion) => {
      if (cursoId && String(asignacion.cursoId) !== cursoId) return false;
      if (seccionId && String(asignacion.seccionId) !== seccionId) return false;
      if (!query) return true;

      const texto = this.normalizarTexto([
        asignacion.docenteNombreCompleto,
        asignacion.curso,
        asignacion.seccion,
        asignacion.grado,
        asignacion.nivel,
        asignacion.estado ?? 'ACTIVO'
      ].join(' '));

      return texto.includes(query);
    });
  });

  readonly tutoriasFiltradas = computed(() => {
    const query = this.normalizarTexto(this.busquedaTablaTutorias());
    const nivel = this.nivelFiltroTutorias();
    const estado = this.estadoFiltroTutorias();

    return this.tutorias().filter((tutoria) => {
      const estadoTutoria = tutoria.estado ?? 'ACTIVO';
      if (nivel && tutoria.nivel.trim().toUpperCase() !== nivel) return false;
      if (estado && estadoTutoria !== estado) return false;
      if (!query) return true;

      const texto = this.normalizarTexto([
        tutoria.docenteNombreCompleto,
        tutoria.seccion,
        tutoria.grado,
        tutoria.nivel,
        tutoria.periodoAcademico,
        estadoTutoria
      ].join(' '));

      return texto.includes(query);
    });
  });

  readonly esTutoriaEditable = computed(() => {
    const periodo = this.tutoriaPeriodo();
    return periodo ? periodo.anio >= this.currentYear || this.authService.esAdministrador() : false;
  });

  constructor() {
    this.vistaActiva.set(this.route.snapshot.data['vista'] === 'tutorias' ? 'tutorias' : 'asignaciones');
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
    this.asignacionCurso.set(null);
    this.cursoQuery.set('');

    this.cursoService.listar().subscribe({
      next: (response) => {
        this.cursos.set(
          response
            .filter((curso) => (curso.estado ?? 'ACTIVO') === 'ACTIVO')
            .sort(
              (a, b) =>
                a.nivelNombre.localeCompare(b.nivelNombre) ||
                a.nombre.localeCompare(b.nombre)
            )
        );
        this.cargandoCursos.set(false);
      },
      error: () => {
        this.errorCursos.set('No se pudieron cargar los cursos activos del catálogo.');
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
          formatearMensajeError(error, 'No se pudieron cargar las asignaciones del periodo.')
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

  cambiarCursoFiltroAsignaciones(cursoId: string): void {
    this.cursoFiltroAsignaciones.set(cursoId);
    this.seccionFiltroAsignaciones.set('');
  }

  limpiarFiltrosAsignaciones(): void {
    this.busquedaTablaAsignaciones.set('');
    this.cursoFiltroAsignaciones.set('');
    this.seccionFiltroAsignaciones.set('');
  }

  limpiarFiltrosTutorias(): void {
    this.busquedaTablaTutorias.set('');
    this.nivelFiltroTutorias.set('');
    this.estadoFiltroTutorias.set('');
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
          formatearMensajeError(error, 'No se pudieron cargar las tutorias del periodo.')
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

  onDocenteInput(contexto: 'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit', value: string): void {
    if (contexto === 'asignacion') {
      this.asignacionQuery.set(value);
      this.asignacionDocente.set(null);
    } else if (contexto === 'tutoria') {
      this.tutoriaQuery.set(value);
      this.tutoriaDocente.set(null);
    } else if (contexto === 'asignacion-edit') {
      this.edicionAsignacionDocenteQuery.set(value);
      this.edicionAsignacionDocente.set(null);
    } else if (contexto === 'tutoria-edit') {
      this.edicionTutoriaDocenteQuery.set(value);
      this.edicionTutoriaDocente.set(null);
    }

    this.dropdownActivo.set(contexto);
  }

  docentesFiltrados(contexto: 'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit'): Docente[] {
    let query = '';
    if (contexto === 'asignacion') {
      query = this.asignacionQuery();
    } else if (contexto === 'tutoria') {
      query = this.tutoriaQuery();
    } else if (contexto === 'asignacion-edit') {
      query = this.edicionAsignacionDocenteQuery();
    } else if (contexto === 'tutoria-edit') {
      query = this.edicionTutoriaDocenteQuery();
    }

    const normalizedQuery = query.trim().toLowerCase();
    return this.docentes()
      .filter((docente) => this.coincideDocente(docente, normalizedQuery))
      .slice(0, 6);
  }

  seleccionarDocente(contexto: 'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit', docente: Docente): void {
    const etiqueta = this.formatearDocente(docente);

    if (contexto === 'asignacion') {
      this.asignacionDocente.set(docente);
      this.asignacionQuery.set(etiqueta);
    } else if (contexto === 'tutoria') {
      this.tutoriaDocente.set(docente);
      this.tutoriaQuery.set(etiqueta);
    } else if (contexto === 'asignacion-edit') {
      this.edicionAsignacionDocente.set(docente);
      this.edicionAsignacionDocenteQuery.set(etiqueta);
    } else if (contexto === 'tutoria-edit') {
      this.edicionTutoriaDocente.set(docente);
      this.edicionTutoriaDocenteQuery.set(etiqueta);
    }

    this.dropdownActivo.set(null);
    this.modalContexto.set(null);
  }

  abrirModal(contexto: 'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit'): void {
    this.modalContexto.set(contexto);
    this.modalBusqueda.set('');
    this.dropdownActivo.set(null);
  }

  cerrarModal(): void {
    this.modalContexto.set(null);
  }

  abrirModalCurso(): void {
    if (this.asignacionEditando()) {
      const seccion = this.edicionAsignacionSeccion();
      if (seccion?.nivelNombre === 'SECUNDARIA' || seccion?.nivelNombre === 'PRIMARIA') {
        this.cursoNivelActivo.set(seccion.nivelNombre as 'PRIMARIA' | 'SECUNDARIA');
      }
    }
    this.cursoModalAbierto.set(true);
    this.cursoModalBusqueda.set('');
  }

  cerrarModalCurso(): void {
    this.cursoModalAbierto.set(false);
  }

  seleccionarCurso(curso: Curso): void {
    if (this.asignacionEditando()) {
      this.edicionAsignacionCurso.set(curso);
      this.edicionAsignacionCursoQuery.set(curso.nombre);
      const seccion = this.edicionAsignacionSeccion();
      if (seccion && seccion.nivelNombre !== curso.nivelNombre) {
        this.edicionAsignacionSeccion.set(null);
        this.edicionAsignacionSeccionQuery.set('');
      }
    } else {
      this.asignacionCurso.set(curso);
      this.cursoQuery.set(curso.nombre);
    }
    this.cursoModalAbierto.set(false);
  }

  abrirModalSeccion(contexto: 'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit'): void {
    this.seccionModalContexto.set(contexto);
    this.seccionModalBusqueda.set('');
    if (contexto === 'asignacion-edit') {
      const curso = this.edicionAsignacionCurso();
      if (curso?.nivelNombre === 'SECUNDARIA' || curso?.nivelNombre === 'PRIMARIA') {
        this.seccionNivelActivo.set(curso.nivelNombre as 'PRIMARIA' | 'SECUNDARIA');
      }
    }
    this.cargarSecciones(
      (contexto === 'asignacion' || contexto === 'asignacion-edit')
        ? this.asignacionPeriodo()?.id ?? null
        : this.tutoriaPeriodo()?.id ?? null
    );
  }

  cerrarModalSeccion(): void {
    this.seccionModalContexto.set(null);
  }

  seleccionarSeccion(contexto: 'asignacion' | 'tutoria' | 'asignacion-edit' | 'tutoria-edit', seccion: Seccion): void {
    const etiqueta = `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim();

    if (contexto === 'asignacion') {
      const seleccionadas = this.asignacionSecciones();
      const existe = seleccionadas.some((item) => item.id === seccion.id);
      const siguiente = existe
        ? seleccionadas.filter((item) => item.id !== seccion.id)
        : [...seleccionadas, seccion];

      this.asignacionSecciones.set(siguiente);
      this.asignacionSeccionQuery.set(this.formatearSeccionesAsignacion(siguiente));
    } else if (contexto === 'tutoria') {
      this.tutoriaSeccion.set(seccion);
      this.tutoriaSeccionQuery.set(etiqueta);
      this.seccionModalContexto.set(null);
    } else if (contexto === 'asignacion-edit') {
      this.edicionAsignacionSeccion.set(seccion);
      this.edicionAsignacionSeccionQuery.set(etiqueta);
      const curso = this.edicionAsignacionCurso();
      if (curso && curso.nivelNombre !== seccion.nivelNombre) {
        this.edicionAsignacionCurso.set(null);
        this.edicionAsignacionCursoQuery.set('');
      }
      this.seccionModalContexto.set(null);
    } else if (contexto === 'tutoria-edit') {
      this.edicionTutoriaSeccion.set(seccion);
      this.edicionTutoriaSeccionQuery.set(etiqueta);
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
    return periodo.anio >= this.currentYear || this.authService.esAdministrador();
  }

  abrirModalCreacion(tipo: 'asignacion' | 'tutoria'): void {
    if (tipo === 'asignacion') this.limpiarAsignacion();
    else this.limpiarTutoria();
    this.modalCreacion.set(tipo);
  }

  cerrarModalCreacion(): void {
    const tipo = this.modalCreacion();
    if (tipo === 'asignacion') this.limpiarAsignacion();
    if (tipo === 'tutoria') this.limpiarTutoria();
    this.modalCreacion.set(null);
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

    if (!periodo || (periodo.anio < this.currentYear && !this.authService.esAdministrador())) {
      this.mostrarAlerta(
        'warning',
        'Período histórico',
        'Solo puedes registrar asignaciones en períodos académicos vigentes o futuros.'
      );
      return;
    }

    if (!docente || !curso || !secciones.length) {
      this.mostrarAlerta(
        'warning',
        'Completa la asignación',
        'Selecciona docente, curso, una o varias secciones y período antes de guardar la asignación.'
      );
      return;
    }

    const seccionesOcupadas = secciones.filter((seccion) =>
      this.asignaciones().some((asignacion) =>
        asignacion.cursoId === curso.id &&
        asignacion.seccionId === seccion.id &&
        asignacion.periodoAcademicoId === periodo.id &&
        asignacion.estado !== 'INACTIVO'
      )
    );

    if (seccionesOcupadas.length) {
      this.mostrarAlerta(
        'warning',
        'Asignación ya registrada',
        `El curso ${curso.nombre} ya tiene docente asignado en: ${seccionesOcupadas
          .map((seccion) => this.etiquetaSeccion(seccion))
          .join(', ')}.`
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
          this.modalCreacion.set(null);
          this.asignacionPeriodoQuery.set(this.formatearPeriodo(periodo));
          this.mostrarAlerta(
            'success',
            'Asignación registrada',
            secciones.length === 1
              ? 'La asignación docente se registró correctamente.'
              : `Se registraron ${secciones.length} asignaciones para las secciones seleccionadas.`
          );
          this.cargarAsignaciones();
        },
        error: (error) => {
          this.guardandoAsignacion.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            formatearMensajeError(error, 'No se pudo registrar la asignación docente.')
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
        'Período histórico',
        'Solo puedes registrar tutorías en períodos académicos vigentes o futuros.'
      );
      return;
    }

    if (!docente || !seccion || !periodo) {
      this.mostrarAlerta(
        'warning',
        'Completa la tutoría',
        'Selecciona docente tutor, sección y período antes de guardar la tutoría.'
      );
      return;
    }

    const tutoriaActiva = this.tutorias().find(
      (tutoria) =>
        tutoria.seccionId === seccion.id &&
        tutoria.periodoAcademicoId === periodo.id &&
        (tutoria.estado ?? 'ACTIVO') === 'ACTIVO'
    );

    if (tutoriaActiva) {
      this.mostrarAlerta(
        'warning',
        'Tutoría ya registrada',
        `${this.etiquetaSeccion(seccion)} ya tiene como tutor(a) a ${tutoriaActiva.docenteNombreCompleto} en este período.`
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
          this.modalCreacion.set(null);
          this.tutoriaPeriodoQuery.set(this.formatearPeriodo(periodo));
          this.mostrarAlerta(
            'success',
            'Tutoría registrada',
            'La tutoría se registró correctamente.'
          );
          this.cargarTutorias();
        },
        error: (error) => {
          this.guardandoTutoria.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            formatearMensajeError(error, 'No se pudo registrar la tutoría.')
          );
        }
      });
  }

  abrirModalEdicionAsignacion(asignacion: AsignacionDocente): void {
    const docente = this.docentes().find((d) => d.id === asignacion.docenteId) ?? null;
    const curso = this.cursos().find((c) => c.id === asignacion.cursoId) ?? null;
    const seccion = this.secciones().find((s) => s.id === asignacion.seccionId) ?? null;

    this.asignacionEditando.set(asignacion);
    this.edicionAsignacionDocente.set(docente);
    this.edicionAsignacionCurso.set(curso);
    this.edicionAsignacionSeccion.set(seccion);

    this.edicionAsignacionDocenteQuery.set(
      docente ? this.formatearDocente(docente) : asignacion.docenteNombreCompleto
    );
    this.edicionAsignacionCursoQuery.set(curso ? curso.nombre : asignacion.curso);
    this.edicionAsignacionSeccionQuery.set(
      seccion
        ? `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim()
        : `${asignacion.grado} - ${asignacion.seccion}`.trim()
    );
    this.dropdownActivo.set(null);
  }

  cerrarModalEdicionAsignacion(): void {
    this.asignacionEditando.set(null);
    this.edicionAsignacionDocente.set(null);
    this.edicionAsignacionCurso.set(null);
    this.edicionAsignacionSeccion.set(null);
    this.edicionAsignacionDocenteQuery.set('');
    this.edicionAsignacionCursoQuery.set('');
    this.edicionAsignacionSeccionQuery.set('');
    this.dropdownActivo.set(null);
  }

  guardarEdicionAsignacion(): void {
    const asignacion = this.asignacionEditando();
    if (!asignacion) return;

    const periodo = this.asignacionPeriodo();
    if (!periodo || (periodo.anio < this.currentYear && !this.authService.esAdministrador())) {
      this.mostrarAlerta(
        'warning',
        'Período histórico',
        'Solo puedes editar asignaciones en períodos académicos vigentes o futuros.'
      );
      return;
    }

    const docente = this.edicionAsignacionDocente();
    const curso = this.edicionAsignacionCurso();
    const seccion = this.edicionAsignacionSeccion();

    if (!docente || !curso || !seccion) {
      this.mostrarAlerta(
        'warning',
        'Completa la asignación',
        'Debes seleccionar docente, curso y sección para actualizar la asignación.'
      );
      return;
    }

    if (curso.nivelNombre !== seccion.nivelNombre) {
      this.mostrarAlerta(
        'warning',
        'Incompatibilidad de nivel',
        `El curso pertenece al nivel ${curso.nivelNombre} pero la sección es de ${seccion.nivelNombre}.`
      );
      return;
    }

    const existeDuplicado = this.asignaciones().some(
      (item) =>
        item.id !== asignacion.id &&
        item.cursoId === curso.id &&
        item.seccionId === seccion.id &&
        item.periodoAcademicoId === periodo.id &&
        (item.estado ?? 'ACTIVO') === 'ACTIVO'
    );

    if (existeDuplicado) {
      this.mostrarAlerta(
        'warning',
        'Asignación ya registrada',
        `El curso ${curso.nombre} ya tiene docente asignado en la sección ${this.etiquetaSeccion(seccion)} para este período.`
      );
      return;
    }

    this.guardandoEdicionAsignacion.set(true);

    this.asignacionAcademicaService
      .actualizar(asignacion.id, {
        docenteId: docente.id,
        cursoId: curso.id,
        seccionId: seccion.id,
        periodoAcademicoId: periodo.id
      })
      .subscribe({
        next: () => {
          this.guardandoEdicionAsignacion.set(false);
          this.cerrarModalEdicionAsignacion();
          this.mostrarAlerta(
            'success',
            'Asignación actualizada',
            'Los datos de la asignación docente se actualizaron correctamente.'
          );
          this.cargarAsignaciones();
        },
        error: (error) => {
          this.guardandoEdicionAsignacion.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo actualizar',
            formatearMensajeError(error, 'No se pudo actualizar la asignación docente.')
          );
        }
      });
  }

  abrirModalEdicionTutoria(tutoria: Tutoria): void {
    const docente = this.docentes().find((d) => d.id === tutoria.docenteId) ?? null;
    const seccion = this.secciones().find((s) => s.id === tutoria.seccionId) ?? null;

    this.tutoriaEditando.set(tutoria);
    this.edicionTutoriaDocente.set(docente);
    this.edicionTutoriaSeccion.set(seccion);

    this.edicionTutoriaDocenteQuery.set(
      docente ? this.formatearDocente(docente) : tutoria.docenteNombreCompleto
    );
    this.edicionTutoriaSeccionQuery.set(
      seccion
        ? `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim()
        : `${tutoria.grado} - ${tutoria.seccion}`.trim()
    );
    this.dropdownActivo.set(null);
  }

  cerrarModalEdicionTutoria(): void {
    this.tutoriaEditando.set(null);
    this.edicionTutoriaDocente.set(null);
    this.edicionTutoriaSeccion.set(null);
    this.edicionTutoriaDocenteQuery.set('');
    this.edicionTutoriaSeccionQuery.set('');
    this.dropdownActivo.set(null);
  }

  guardarEdicionTutoria(): void {
    const tutoria = this.tutoriaEditando();
    if (!tutoria) return;

    if (!this.esTutoriaEditable()) {
      this.mostrarAlerta(
        'warning',
        'Período histórico',
        'Solo puedes editar tutorías en períodos académicos vigentes o futuros.'
      );
      return;
    }

    const docente = this.edicionTutoriaDocente();
    const seccion = this.edicionTutoriaSeccion();
    const periodo = this.tutoriaPeriodo();

    if (!docente || !seccion || !periodo) {
      this.mostrarAlerta(
        'warning',
        'Completa la tutoría',
        'Selecciona docente tutor y sección antes de guardar los cambios.'
      );
      return;
    }

    const tutoriaActiva = this.tutorias().find(
      (item) =>
        item.id !== tutoria.id &&
        item.seccionId === seccion.id &&
        item.periodoAcademicoId === periodo.id &&
        (item.estado ?? 'ACTIVO') === 'ACTIVO'
    );

    if (tutoriaActiva) {
      this.mostrarAlerta(
        'warning',
        'Tutoría ya registrada',
        `${this.etiquetaSeccion(seccion)} ya tiene como tutor(a) a ${tutoriaActiva.docenteNombreCompleto} en este período.`
      );
      return;
    }

    this.guardandoEdicionTutoria.set(true);

    this.tutoriaService
      .actualizar(tutoria.id, {
        docenteId: docente.id,
        seccionId: seccion.id,
        periodoAcademicoId: periodo.id
      })
      .subscribe({
        next: () => {
          this.guardandoEdicionTutoria.set(false);
          this.cerrarModalEdicionTutoria();
          this.mostrarAlerta(
            'success',
            'Tutoría actualizada',
            'La tutoría se actualizó correctamente.'
          );
          this.cargarTutorias();
        },
        error: (error) => {
          this.guardandoEdicionTutoria.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo actualizar',
            formatearMensajeError(error, 'No se pudo actualizar la tutoría.')
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
        'Deshabilitar tutoría',
        '¿Está seguro de que desea deshabilitar esta tutoría para este período?',
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
        'Deshabilitar asignación',
        '¿Está seguro de que desea deshabilitar esta asignación para este período?',
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
        const ctx = this.seccionModalContexto();
        this.cargarSecciones(
          (ctx === 'asignacion' || ctx === 'asignacion-edit')
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
          activa ? 'Asignación habilitada' : 'Asignación deshabilitada',
          activa
            ? 'Asignación habilitada correctamente para este período.'
            : 'Asignación deshabilitada correctamente para este período.'
        );
      },
      error: (error) => {
        this.actualizandoEstadoAsignacionId.set(null);
        this.mostrarAlerta(
          'error',
          activa ? 'No se pudo habilitar' : 'No se pudo deshabilitar',
          formatearMensajeError(
            error,
            activa
              ? 'No se pudo habilitar la asignación.'
              : 'No se pudo deshabilitar la asignación.'
          )
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
          activa ? 'Tutoría habilitada' : 'Tutoría deshabilitada',
          activa
            ? 'Tutoría habilitada correctamente para este período.'
            : 'Tutoría deshabilitada correctamente para este período.'
        );
      },
      error: (error) => {
        this.actualizandoEstadoTutoriaId.set(null);
        this.mostrarAlerta(
          'error',
          activa ? 'No se pudo habilitar' : 'No se pudo deshabilitar',
          formatearMensajeError(
            error,
            activa ? 'No se pudo habilitar la tutoría.' : 'No se pudo deshabilitar la tutoría.'
          )
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
      confirmText: options?.confirmText ?? 'Entendido',
      cancelText: options?.cancelText ?? null,
      autoCloseMs: null
    });
  }

  formatearDocente(docente: Docente): string {
    return `${docente.apellidos}, ${docente.nombres}`;
  }

  formatearPeriodo(periodo: PeriodoAcademico): string {
    return `${periodo.nombre} (${periodo.anio})`;
  }

  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
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
    return `${primera} y ${secciones.length - 1} más`;
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
    return `${asignacion.grado} · Sección ${asignacion.seccion}`;
  }

  private coincideDocente(docente: Docente, query: string): boolean {
    if (!query) {
      return true;
    }

    const texto = [
      docente.nombres,
      docente.apellidos,
      docente.tipoDocumentoNombre ?? '',
      docente.numeroDocumento ?? '',
      docente.especialidad ?? '',
      docente.username ?? ''
    ]
      .join(' ')
      .toLowerCase();

    return texto.includes(query);
  }
}
