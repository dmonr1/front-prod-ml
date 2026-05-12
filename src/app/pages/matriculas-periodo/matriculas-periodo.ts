import { Component, computed, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Alumno } from '../../models/alumno';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { AlumnoService } from '../../services/academico/alumno.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';

@Component({
  selector: 'app-matriculas-periodo',
  imports: [Shell],
  templateUrl: './matriculas-periodo.html',
  styleUrl: './matriculas-periodo.scss'
})
export class MatriculasPeriodo {
  private readonly alumnoService = inject(AlumnoService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly matriculaService = inject(MatriculaService);

  readonly alumnos = signal<Alumno[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly matriculas = signal<Matricula[]>([]);

  readonly cargandoAlumnos = signal(true);
  readonly cargandoSecciones = signal(true);
  readonly cargandoPeriodos = signal(true);
  readonly cargandoMatriculas = signal(true);
  readonly guardando = signal(false);

  readonly errorAlumnos = signal<string | null>(null);
  readonly errorSecciones = signal<string | null>(null);
  readonly errorPeriodos = signal<string | null>(null);
  readonly errorMatriculas = signal<string | null>(null);
  readonly mensajeFormulario = signal<string | null>(null);
  readonly exitoFormulario = signal<string | null>(null);

  readonly alumnoSeleccionado = signal<Alumno | null>(null);
  readonly seccionSeleccionada = signal<Seccion | null>(null);
  readonly periodoSeleccionado = signal<PeriodoAcademico | null>(null);

  readonly alumnoQuery = signal('');
  readonly seccionQuery = signal('');
  readonly periodoQuery = signal('');

  readonly dropdownActivo = signal(false);
  readonly modalAlumnoAbierto = signal(false);
  readonly modalSeccionAbierto = signal(false);
  readonly modalPeriodoAbierto = signal(false);

  readonly modalBusquedaAlumno = signal('');
  readonly modalBusquedaSeccion = signal('');
  readonly modalBusquedaPeriodo = signal('');
  readonly seccionNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');

  readonly alumnosDisponibles = computed(() => {
    const matriculados = new Set(this.matriculas().map((item) => item.alumnoId));
    return this.alumnos().filter((alumno) => !matriculados.has(alumno.id));
  });

  readonly alumnosFiltrados = computed(() => {
    const query = this.alumnoQuery().trim().toLowerCase();
    return this.alumnosDisponibles().filter((alumno) => this.coincideAlumno(alumno, query)).slice(0, 6);
  });

  readonly alumnosModalFiltrados = computed(() => {
    const query = this.modalBusquedaAlumno().trim().toLowerCase();
    return this.alumnosDisponibles().filter((alumno) => this.coincideAlumno(alumno, query));
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
    this.cargarAlumnos();
    this.cargarSecciones();
    this.cargarPeriodos();
  }

  cargarAlumnos(): void {
    this.cargandoAlumnos.set(true);
    this.errorAlumnos.set(null);

    this.alumnoService.listar().subscribe({
      next: (response) => {
        this.alumnos.set(response);
        this.cargandoAlumnos.set(false);
      },
      error: () => {
        this.errorAlumnos.set('No se pudieron cargar los alumnos.');
        this.cargandoAlumnos.set(false);
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

        this.cargarMatriculas();
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
        this.cargandoMatriculas.set(false);
      }
    });
  }

  cargarMatriculas(): void {
    const periodo = this.periodoSeleccionado();

    if (!periodo) {
      this.matriculas.set([]);
      this.cargandoMatriculas.set(false);
      return;
    }

    this.cargandoMatriculas.set(true);
    this.errorMatriculas.set(null);

    this.matriculaService.listar(periodo.id, this.seccionSeleccionada()?.id ?? null).subscribe({
      next: (response) => {
        this.matriculas.set(response);
        this.cargandoMatriculas.set(false);
      },
      error: (error) => {
        this.errorMatriculas.set(
          error?.error?.mensaje ?? 'No se pudieron cargar las matriculas del periodo.'
        );
        this.cargandoMatriculas.set(false);
      }
    });
  }

  onAlumnoInput(value: string): void {
    this.alumnoQuery.set(value);
    this.alumnoSeleccionado.set(null);
    this.dropdownActivo.set(true);
  }

  seleccionarAlumno(alumno: Alumno): void {
    this.alumnoSeleccionado.set(alumno);
    this.alumnoQuery.set(this.formatearAlumno(alumno));
    this.dropdownActivo.set(false);
    this.modalAlumnoAbierto.set(false);
  }

  abrirModalAlumno(): void {
    this.dropdownActivo.set(false);
    this.modalBusquedaAlumno.set('');
    this.modalAlumnoAbierto.set(true);
  }

  cerrarModalAlumno(): void {
    this.modalAlumnoAbierto.set(false);
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
    this.cargarMatriculas();
  }

  limpiarFiltroSeccion(): void {
    this.seccionSeleccionada.set(null);
    this.seccionQuery.set('');
    this.cargarMatriculas();
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
    this.cargarMatriculas();
  }

  limpiarFormulario(): void {
    this.alumnoSeleccionado.set(null);
    this.alumnoQuery.set('');
    this.mensajeFormulario.set(null);
    this.exitoFormulario.set(null);
    this.dropdownActivo.set(false);
  }

  guardarMatricula(): void {
    const alumno = this.alumnoSeleccionado();
    const seccion = this.seccionSeleccionada();
    const periodo = this.periodoSeleccionado();

    this.mensajeFormulario.set(null);
    this.exitoFormulario.set(null);

    if (!alumno || !seccion || !periodo) {
      this.mensajeFormulario.set(
        'Selecciona alumno, seccion y periodo antes de registrar la matricula.'
      );
      return;
    }

    this.guardando.set(true);

    this.matriculaService
      .crear({
        alumnoId: alumno.id,
        seccionId: seccion.id,
        periodoAcademicoId: periodo.id
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.limpiarFormulario();
          this.exitoFormulario.set('La matricula del alumno se registro correctamente.');
          this.periodoQuery.set(this.formatearPeriodo(periodo));
          this.seccionQuery.set(`${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim());
          this.cargarMatriculas();
        },
        error: (error) => {
          this.guardando.set(false);
          this.mensajeFormulario.set(error?.error?.mensaje ?? 'No se pudo registrar la matricula.');
        }
      });
  }

  formatearAlumno(alumno: Alumno): string {
    return `${alumno.apellidos}, ${alumno.nombres}`;
  }

  formatearPeriodo(periodo: PeriodoAcademico): string {
    return `${periodo.nombre} (${periodo.anio})`;
  }

  private coincideAlumno(alumno: Alumno, query: string): boolean {
    if (!query) {
      return true;
    }

    return [alumno.codigo, alumno.dni ?? '', alumno.nombres, alumno.apellidos]
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
