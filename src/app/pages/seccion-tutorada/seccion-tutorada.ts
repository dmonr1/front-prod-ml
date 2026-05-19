import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { Tutoria } from '../../models/tutoria';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { AuthService } from '../../services/auth/auth.service';
import { CustomAlertComponent } from '../../components/custom-alert/custom-alert';
import {
  CursoAlumnoTutoriaResumen,
  TutoriaResumenAcademico,
  TutoriaService
} from '../../services/asignaciones/tutoria.service';

@Component({
  selector: 'app-seccion-tutorada',
  imports: [Shell, RouterLink, CustomAlertComponent],
  templateUrl: './seccion-tutorada.html',
  styleUrl: './seccion-tutorada.scss'
})
export class SeccionTutorada implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly tutoriaIdRuta = Number(this.route.snapshot.paramMap.get('tutoriaId'));
  readonly currentYear = new Date().getFullYear();
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly tutoria = signal<Tutoria | null>(null);
  readonly tutoriasDisponibles = signal<Tutoria[]>([]);
  readonly tutoriaIdActiva = signal<number | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly resumenAcademico = signal<TutoriaResumenAcademico | null>(null);

  readonly mostrarError = signal(true);
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());

  reintentarCarga(): void {
    this.mostrarError.set(false);
    this.error.set(null);
  
    const periodoId = this.periodoEvaluacionSeleccionadoId();
  
    if (periodoId) {
      this.seleccionarPeriodoEvaluacion(periodoId);
    } else {
      this.cargarVista();
    }
  }
  
  cerrarError(): void {
    this.mostrarError.set(false);
  }

  readonly periodosEvaluacionTutoria = computed(() =>
    this.periodosEvaluacion()
      .filter((periodo) => periodo.periodoAcademicoId === this.tutoria()?.periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero)
  );

  readonly indicePeriodoEvaluacionSeleccionado = computed(() =>
    this.periodosEvaluacionTutoria().findIndex(
      (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
    )
  );

  readonly periodoEvaluacionSeleccionado = computed(
    () =>
      this.periodosEvaluacionTutoria().find(
        (periodo) => periodo.id === this.periodoEvaluacionSeleccionadoId()
      ) ?? null
  );

  readonly resumenVista = computed(() => {
    const resumen = this.resumenAcademico();
    const alumnos = resumen?.alumnos ?? [];
    const promedios = alumnos
      .map((fila) => fila.promedioGeneral)
      .filter((promedio): promedio is number => promedio !== null);

    const promedioSeccion = promedios.length
      ? Math.round((promedios.reduce((acc, item) => acc + item, 0) / promedios.length) * 100) / 100
      : null;

    return {
      alumnos: alumnos.length,
      cursos: resumen?.cursos.length ?? 0,
      promedioSeccion,
      registros: alumnos.reduce(
        (acc, fila) =>
          acc +
          fila.cursos.reduce((subtotal, curso) => subtotal + (curso.evaluacionesRegistradas || 0), 0),
        0
      )
    };
  });

  ngOnInit(): void {
    this.cargarVista();
  }

  cargarVista(): void {
    const docenteId = this.authService.obtenerUsuario()?.docenteId;

    if (!docenteId) {
      this.cargando.set(true);
      this.error.set('Tu usuario no tiene un docente vinculado.');
      this.mostrarError.set(true);
      return;
    }

    this.error.set(null);
    this.mostrarError.set(false);
    this.cargando.set(true);

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual =
          periodos.find((periodo) => periodo.anio === this.currentYear) ??
          [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
          null;

        if (!periodoActual) {
          this.cargando.set(true);
          this.error.set('No existe un periodo academico configurado para cargar la seccion tutorada.');
          this.mostrarError.set(true);
          return;
        }

        forkJoin({
          tutorias: this.tutoriaService.listarPorDocente(docenteId, periodoActual.id),
          periodosEvaluacion: this.periodoEvaluacionService.listar()
        }).subscribe({
          next: ({ tutorias, periodosEvaluacion }) => {
            const tutoriasActivas = tutorias.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
            const tutoria =
              tutoriasActivas.find((item) => item.id === this.tutoriaIdRuta) ??
              tutoriasActivas[0] ??
              null;

            if (!tutoria) {
              this.cargando.set(true);
              this.error.set('No tienes una seccion tutorada activa en el periodo actual.');
              this.mostrarError.set(true);
              return;
            }

            this.tutoriasDisponibles.set(tutoriasActivas);
            this.tutoria.set(tutoria);
            this.tutoriaIdActiva.set(tutoria.id);
            this.periodosEvaluacion.set(periodosEvaluacion);
            this.cargando.set(false);

            this.cargarPrimerPeriodoDisponible();
          },
          error: (error) => {
            this.error.set(
              error?.error?.mensaje ??
              'No se pudo cargar el resumen academico de la seccion tutorada.'
            );

            this.resumenAcademico.set(null);

            this.mostrarError.set(true);

            this.cargando.set(true);
          }
        });
      },
      error: (error) => {
        this.cargando.set(true);
        this.error.set(error?.error?.mensaje ?? 'No se pudo resolver el periodo academico actual.');
        this.resumenAcademico.set(null);
        this.mostrarError.set(true);
      }
    });
  }

  seleccionarPeriodoEvaluacion(periodoEvaluacionId: number): void {
    const tutoriaId = this.tutoriaIdActiva();
    if (!tutoriaId) {
      this.error.set('No se pudo identificar la tutoria activa.');
      return;
    }

    this.periodoEvaluacionSeleccionadoId.set(periodoEvaluacionId);
    this.error.set(null);
    this.cargando.set(true);

    this.tutoriaService.obtenerResumenAcademico(tutoriaId, periodoEvaluacionId).subscribe({
      next: (resumen) => {
        this.resumenAcademico.set(resumen);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo cargar el resumen academico de la seccion tutorada.'
        );
        this.resumenAcademico.set(null);
        this.mostrarError.set(true);
        this.cargando.set(true);
      }
    });
  }

  seleccionarTutoria(tutoria: Tutoria): void {
    if (this.tutoriaIdActiva() === tutoria.id) {
      return;
    }

    this.tutoria.set(tutoria);
    this.tutoriaIdActiva.set(tutoria.id);
    this.resumenAcademico.set(null);
    this.cargarPrimerPeriodoDisponible();
  }

  irPeriodoEvaluacionAnterior(): void {
    const periodos = this.periodosEvaluacionTutoria();
    const indice = this.indicePeriodoEvaluacionSeleccionado();
    if (indice <= 0) {
      return;
    }

    this.seleccionarPeriodoEvaluacion(periodos[indice - 1].id);
  }

  irPeriodoEvaluacionSiguiente(): void {
    const periodos = this.periodosEvaluacionTutoria();
    const indice = this.indicePeriodoEvaluacionSeleccionado();
    if (indice < 0 || indice >= periodos.length - 1) {
      return;
    }

    this.seleccionarPeriodoEvaluacion(periodos[indice + 1].id);
  }

  formatearPromedio(promedio: number | null): string {
    return promedio === null ? 'Sin notas' : promedio.toFixed(2);
  }

  obtenerNotasEtiquetadas(curso: CursoAlumnoTutoriaResumen): Array<{ etiqueta: string; valor: string }> {
    if (curso.detalleNotas?.length) {
      return curso.detalleNotas.map((nota) => ({
        etiqueta: nota.etiqueta,
        valor: nota.nota.toFixed(0)
      }));
    }

    return curso.notas.map((nota, indice) => ({
      etiqueta: `EV${indice + 1}`,
      valor: nota.toFixed(0)
    }));
  }

  obtenerAsistenciaTexto(clasesAsistidas: number, clasesProgramadas: number): string {
    if (!clasesProgramadas) {
      return 'Sin registro';
    }

    return `${clasesAsistidas}/${clasesProgramadas}`;
  }

  obtenerAsistenciaPorcentaje(porcentaje: number | null): string {
    return porcentaje === null ? '--' : `${porcentaje.toFixed(0)}%`;
  }

  private cargarPrimerPeriodoDisponible(): void {
    const primerPeriodo = this.periodosEvaluacionTutoria()[0] ?? null;
    if (primerPeriodo) {
      this.seleccionarPeriodoEvaluacion(primerPeriodo.id);
    } else {
      this.periodoEvaluacionSeleccionadoId.set(null);
      this.resumenAcademico.set(null);
    }
  }
}
