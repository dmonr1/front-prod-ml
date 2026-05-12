import { Component, computed, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { Docente } from '../../models/docente';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { CursoService } from '../../services/academico/curso.service';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';

@Component({
  selector: 'app-asignaciones-docente',
  imports: [Shell],
  templateUrl: './asignaciones-docente.html',
  styleUrl: './asignaciones-docente.scss'
})
export class AsignacionesDocente {
  private readonly docenteService = inject(DocenteService);
  private readonly cursoService = inject(CursoService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly asignacionAcademicaService = inject(AsignacionAcademicaService);

  readonly docentes = signal<Docente[]>([]);
  readonly cursos = signal<Curso[]>([]);
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
  readonly mensajeFormulario = signal<string | null>(null);
  readonly exitoFormulario = signal<string | null>(null);

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

    return this.periodos().filter((periodo) => {
      if (!query) {
        return true;
      }

      return [periodo.nombre, periodo.anio.toString()].join(' ').toLowerCase().includes(query);
    });
  });

  constructor() {
    this.cargarCatalogos();
  }

  cargarCatalogos(): void {
    this.cargarDocentes();
    this.cargarCursos();
    this.cargarSecciones();
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

  cargarCursos(): void {
    this.cargandoCursos.set(true);
    this.errorCursos.set(null);

    this.cursoService.listar().subscribe({
      next: (response) => {
        this.cursos.set(response);
        this.cargandoCursos.set(false);
      },
      error: () => {
        this.errorCursos.set('No se pudieron cargar los cursos.');
        this.cargandoCursos.set(false);
      }
    });
  }

  cargarSecciones(): void {
    this.cargandoSecciones.set(true);
    this.errorSecciones.set(null);

    this.seccionService.listar().subscribe({
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
        this.periodos.set(response);
        this.cargandoPeriodos.set(false);

        if (!this.periodoSeleccionado() && response.length) {
          this.seleccionarPeriodo(response[0]);
          return;
        }

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
    this.periodoSeleccionado.set(periodo);
    this.periodoQuery.set(this.formatearPeriodo(periodo));
    this.modalPeriodoAbierto.set(false);
    this.cargarAsignaciones();
  }

  limpiarFormulario(): void {
    this.docenteSeleccionado.set(null);
    this.cursoSeleccionado.set(null);
    this.seccionSeleccionada.set(null);
    this.docenteQuery.set('');
    this.cursoQuery.set('');
    this.seccionQuery.set('');
    this.mensajeFormulario.set(null);
    this.exitoFormulario.set(null);
    this.dropdownActivo.set(false);
  }

  guardarAsignacion(): void {
    const docente = this.docenteSeleccionado();
    const curso = this.cursoSeleccionado();
    const seccion = this.seccionSeleccionada();
    const periodo = this.periodoSeleccionado();

    this.mensajeFormulario.set(null);
    this.exitoFormulario.set(null);

    if (!docente || !curso || !seccion || !periodo) {
      this.mensajeFormulario.set(
        'Selecciona docente, curso, seccion y periodo antes de guardar la asignacion.'
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
          this.exitoFormulario.set('La asignacion docente se registro correctamente.');
          this.periodoQuery.set(this.formatearPeriodo(periodo));
          this.cargarAsignaciones();
        },
        error: (error) => {
          this.guardando.set(false);
          this.mensajeFormulario.set(
            error?.error?.mensaje ?? 'No se pudo registrar la asignacion docente.'
          );
        }
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
