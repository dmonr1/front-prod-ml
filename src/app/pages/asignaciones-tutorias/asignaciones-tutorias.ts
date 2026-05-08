import { Component, computed, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Curso } from '../../models/curso';
import { Docente } from '../../models/docente';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { CursoService } from '../../services/academico/curso.service';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';

@Component({
  selector: 'app-asignaciones-tutorias',
  imports: [Shell],
  templateUrl: './asignaciones-tutorias.html',
  styleUrl: './asignaciones-tutorias.scss'
})
export class AsignacionesTutorias {
  private readonly docenteService = inject(DocenteService);
  private readonly cursoService = inject(CursoService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);

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

  readonly asignacionDocente = signal<Docente | null>(null);
  readonly tutoriaDocente = signal<Docente | null>(null);
  readonly asignacionCurso = signal<Curso | null>(null);
  readonly asignacionSeccion = signal<Seccion | null>(null);
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

    return this.periodos().filter((periodo) => {
      if (!query) {
        return true;
      }

      return [periodo.nombre, periodo.anio.toString()].join(' ').toLowerCase().includes(query);
    });
  });

  constructor() {
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
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
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
  }

  cerrarModalSeccion(): void {
    this.seccionModalContexto.set(null);
  }

  seleccionarSeccion(contexto: 'asignacion' | 'tutoria', seccion: Seccion): void {
    const etiqueta = `${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim();

    if (contexto === 'asignacion') {
      this.asignacionSeccion.set(seccion);
      this.asignacionSeccionQuery.set(etiqueta);
    } else {
      this.tutoriaSeccion.set(seccion);
      this.tutoriaSeccionQuery.set(etiqueta);
    }

    this.seccionModalContexto.set(null);
  }

  abrirModalPeriodo(contexto: 'asignacion' | 'tutoria'): void {
    this.periodoModalContexto.set(contexto);
    this.periodoModalBusqueda.set('');
  }

  cerrarModalPeriodo(): void {
    this.periodoModalContexto.set(null);
  }

  seleccionarPeriodo(contexto: 'asignacion' | 'tutoria', periodo: PeriodoAcademico): void {
    const etiqueta = this.formatearPeriodo(periodo);

    if (contexto === 'asignacion') {
      this.asignacionPeriodo.set(periodo);
      this.asignacionPeriodoQuery.set(etiqueta);
    } else {
      this.tutoriaPeriodo.set(periodo);
      this.tutoriaPeriodoQuery.set(etiqueta);
    }

    this.periodoModalContexto.set(null);
  }

  formatearDocente(docente: Docente): string {
    return `${docente.apellidos}, ${docente.nombres}`;
  }

  formatearPeriodo(periodo: PeriodoAcademico): string {
    return `${periodo.nombre} (${periodo.anio})`;
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
