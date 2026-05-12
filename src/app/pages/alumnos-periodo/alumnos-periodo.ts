import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { Grado } from '../../models/grado';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { GradoService } from '../../services/academico/grado.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';

@Component({
  selector: 'app-alumnos-periodo',
  imports: [Shell, RouterLink, FormsModule],
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
  readonly modalSeccionAbierto = signal(false);
  readonly guardandoSeccion = signal(false);
  readonly cargandoSeccionesAnteriores = signal(false);
  readonly errorGuardarSeccion = signal<string | null>(null);
  readonly exitoGuardarSeccion = signal<string | null>(null);
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
      .filter((seccion) => seccion.gradoId === this.gradoSeleccionadoId())
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
  }

  seleccionarGrado(gradoId: number): void {
    this.gradoSeleccionadoId.set(this.gradoSeleccionadoId() === gradoId ? null : gradoId);
    this.errorGuardarSeccion.set(null);
    this.exitoGuardarSeccion.set(null);
  }

  abrirSeccion(seccionId: number): void {
    void this.router.navigate(['/gestion-estudiantil/periodo', this.periodoId, 'seccion', seccionId]);
  }

  abrirModalSeccion(): void {
    this.errorGuardarSeccion.set(null);
    this.exitoGuardarSeccion.set(null);
    this.modalSeccionAbierto.set(true);
  }

  cerrarModalSeccion(): void {
    this.modalSeccionAbierto.set(false);
  }

  guardarSeccion(): void {
    const gradoId = this.gradoSeleccionadoId();
    const nombre = this.formSeccionNombre().trim();
    const capacidad = this.formSeccionCapacidad().trim();

    this.errorGuardarSeccion.set(null);
    this.exitoGuardarSeccion.set(null);

    if (!gradoId) {
      this.errorGuardarSeccion.set('Selecciona un grado antes de crear una seccion.');
      return;
    }

    if (!nombre) {
      this.errorGuardarSeccion.set('Ingresa el nombre de la seccion.');
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
          this.exitoGuardarSeccion.set('Seccion registrada correctamente para este periodo.');
        },
        error: (error) => {
          this.guardandoSeccion.set(false);
          this.errorGuardarSeccion.set(
            error?.error?.mensaje ?? 'No se pudo registrar la seccion.'
          );
        }
      });
  }

  cargarSeccionesPeriodoAnterior(): void {
    const gradoId = this.gradoSeleccionadoId();

    this.errorGuardarSeccion.set(null);
    this.exitoGuardarSeccion.set(null);

    if (!gradoId) {
      this.errorGuardarSeccion.set('Selecciona un grado antes de cargar secciones.');
      return;
    }

    if (!this.periodoAnterior()) {
      this.errorGuardarSeccion.set('No existe un periodo anterior para copiar secciones.');
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
          this.exitoGuardarSeccion.set('Secciones del periodo anterior cargadas correctamente.');
        },
        error: (error) => {
          this.cargandoSeccionesAnteriores.set(false);
          this.errorGuardarSeccion.set(
            error?.error?.mensaje ?? 'No se pudieron cargar las secciones del periodo anterior.'
          );
        }
      });
  }

  totalMatriculadosGrado(gradoId: number): number {
    return this.matriculas().filter((matricula) => matricula.gradoId === gradoId).length;
  }

  totalSeccionesGrado(gradoId: number): number {
    return this.secciones().filter((seccion) => seccion.gradoId === gradoId).length;
  }

  totalMatriculadosSeccion(seccionId: number): number {
    return this.matriculas().filter((matricula) => matricula.seccionId === seccionId).length;
  }
}
