import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { ConfiguracionEvaluacion, DetalleNotaEvaluacion, Evaluacion } from '../../models/evaluacion';
import { Matricula } from '../../models/matricula';
import { AuthService } from '../../services/auth/auth.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { EvaluacionService } from '../../services/evaluacion/evaluacion.service';

interface NotaFila {
  matricula: Matricula;
  nota: string;
  observacion: string;
}

@Component({
  selector: 'app-carga-notas',
  imports: [Shell, RouterLink],
  templateUrl: './carga-notas.html',
  styleUrl: './carga-notas.scss'
})
export class CargaNotas implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly asignacionService = inject(AsignacionAcademicaService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly matriculaService = inject(MatriculaService);
  private readonly evaluacionService = inject(EvaluacionService);

  readonly asignacionId = Number(this.route.snapshot.paramMap.get('asignacionId'));
  readonly cargando = signal(true);
  readonly guardandoEvaluacion = signal(false);
  readonly guardandoNotas = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);

  readonly asignacion = signal<AsignacionDocente | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionSeleccionadoId = signal<number | null>(null);
  readonly configuraciones = signal<ConfiguracionEvaluacion[]>([]);
  readonly configuracionSeleccionadaId = signal<number | null>(null);
  readonly evaluaciones = signal<Evaluacion[]>([]);
  readonly evaluacionSeleccionadaId = signal<number | null>(null);
  readonly matriculas = signal<Matricula[]>([]);
  readonly notasRegistradas = signal<DetalleNotaEvaluacion[]>([]);
  readonly filasNotas = signal<NotaFila[]>([]);

  readonly nombreEvaluacion = signal('');
  readonly numeroEvaluacion = signal('1');
  readonly fechaEvaluacion = signal(new Date().toISOString().slice(0, 10));

  readonly periodosEvaluacionPeriodo = computed(() =>
    this.periodosEvaluacion()
      .filter((periodoEvaluacion) => periodoEvaluacion.periodoAcademicoId === this.asignacion()?.periodoAcademicoId)
      .sort((a, b) => a.numero - b.numero)
  );

  readonly configuracionSeleccionada = computed(
    () => this.configuraciones().find((item) => item.id === this.configuracionSeleccionadaId()) ?? null
  );

  readonly evaluacionSeleccionada = computed(
    () => this.evaluaciones().find((item) => item.id === this.evaluacionSeleccionadaId()) ?? null
  );

  readonly resumenNotas = computed(() => {
    const notas = this.filasNotas()
      .map((fila) => Number(fila.nota))
      .filter((nota) => !Number.isNaN(nota));
    const promedio = notas.length
      ? Math.round((notas.reduce((acc, nota) => acc + nota, 0) / notas.length) * 100) / 100
      : 0;

    return {
      total: this.filasNotas().length,
      registradas: notas.length,
      promedio
    };
  });

  ngOnInit(): void {
    this.cargarBase();
  }

  cargarBase(): void {
    const docenteId = this.authService.obtenerUsuario()?.docenteId;

    if (!docenteId) {
      this.cargando.set(false);
      this.error.set('Tu usuario no tiene un docente vinculado.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.mensaje.set(null);

    forkJoin({
      asignaciones: this.asignacionService.listarAsignaciones(docenteId, 1),
      periodosEvaluacion: this.periodoEvaluacionService.listar()
    }).subscribe({
      next: ({ asignaciones, periodosEvaluacion }) => {
        const asignacion = asignaciones.find((item) => item.id === this.asignacionId) ?? null;
        this.asignacion.set(asignacion);
        this.periodosEvaluacion.set(periodosEvaluacion);
        this.cargando.set(false);

        if (!asignacion) {
          this.error.set('No se encontro la asignacion seleccionada para tu usuario.');
          return;
        }

        const primerPeriodoEvaluacion = periodosEvaluacion
          .filter((item) => item.periodoAcademicoId === asignacion.periodoAcademicoId)
          .sort((a, b) => a.numero - b.numero)[0];

        if (primerPeriodoEvaluacion) {
          this.seleccionarPeriodoEvaluacion(primerPeriodoEvaluacion.id);
        }
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la informacion inicial.');
      }
    });
  }

  seleccionarPeriodoEvaluacion(periodoEvaluacionId: number): void {
    const asignacion = this.asignacion();
    if (!asignacion) {
      return;
    }

    this.periodoEvaluacionSeleccionadoId.set(periodoEvaluacionId);
    this.configuracionSeleccionadaId.set(null);
    this.evaluacionSeleccionadaId.set(null);
    this.configuraciones.set([]);
    this.evaluaciones.set([]);
    this.notasRegistradas.set([]);
    this.filasNotas.set([]);
    this.error.set(null);
    this.mensaje.set(null);

    forkJoin({
      configuraciones: this.evaluacionService.listarConfiguraciones(periodoEvaluacionId, asignacion.cursoId),
      evaluaciones: this.evaluacionService.listarEvaluaciones(asignacion.id, periodoEvaluacionId),
      matriculas: this.matriculaService.listar(asignacion.periodoAcademicoId, asignacion.seccionId)
    }).subscribe({
      next: ({ configuraciones, evaluaciones, matriculas }) => {
        this.configuraciones.set(configuraciones);
        this.evaluaciones.set(evaluaciones);
        this.matriculas.set(matriculas);
        this.configuracionSeleccionadaId.set(configuraciones[0]?.id ?? null);
        this.evaluacionSeleccionadaId.set(evaluaciones[0]?.id ?? null);
        this.prepararFilasNotas(matriculas, []);

        if (evaluaciones[0]) {
          this.cargarNotas(evaluaciones[0].id);
        }
      },
      error: (error) => {
        this.error.set(error?.error?.mensaje ?? 'No se pudo cargar la configuracion del periodo de evaluacion.');
      }
    });
  }

  seleccionarConfiguracion(configuracionId: number): void {
    const configuracion = this.configuraciones().find((item) => item.id === configuracionId);
    this.configuracionSeleccionadaId.set(configuracionId);
    this.numeroEvaluacion.set('1');
    if (configuracion) {
      this.nombreEvaluacion.set(`${configuracion.nombreTipoEvaluacion} 1`);
    }
  }

  seleccionarEvaluacion(evaluacionId: number): void {
    this.evaluacionSeleccionadaId.set(evaluacionId);
    this.cargarNotas(evaluacionId);
  }

  guardarEvaluacion(): void {
    const asignacion = this.asignacion();
    const periodoEvaluacionId = this.periodoEvaluacionSeleccionadoId();
    const configuracion = this.configuracionSeleccionada();
    const numero = Number(this.numeroEvaluacion());
    const nombre = this.nombreEvaluacion().trim();

    this.error.set(null);
    this.mensaje.set(null);

    if (!asignacion || !periodoEvaluacionId || !configuracion || !Number.isInteger(numero) || numero < 1 || !nombre) {
      this.error.set('Selecciona una configuracion y completa los datos de la evaluacion.');
      return;
    }

    this.guardandoEvaluacion.set(true);
    this.evaluacionService
      .crearEvaluacion({
        configuracionEvaluacionId: configuracion.id,
        docenteCursoSeccionId: asignacion.id,
        periodoEvaluacionId,
        tipoEvaluacionId: configuracion.tipoEvaluacionId,
        numeroEvaluacion: numero,
        nombre,
        fechaEvaluacion: this.fechaEvaluacion() || null
      })
      .subscribe({
        next: (evaluacion) => {
          this.guardandoEvaluacion.set(false);
          this.evaluaciones.update((actual) => [...actual, evaluacion]);
          this.evaluacionSeleccionadaId.set(evaluacion.id);
          this.mensaje.set('Evaluacion creada. Ya puedes registrar notas.');
          this.prepararFilasNotas(this.matriculas(), []);
        },
        error: (error) => {
          this.guardandoEvaluacion.set(false);
          this.error.set(error?.error?.mensaje ?? 'No se pudo crear la evaluacion.');
        }
      });
  }

  cargarNotas(evaluacionId: number): void {
    this.evaluacionService.listarNotas(evaluacionId).subscribe({
      next: (notas) => {
        this.notasRegistradas.set(notas);
        this.prepararFilasNotas(this.matriculas(), notas);
      },
      error: (error) => {
        this.error.set(error?.error?.mensaje ?? 'No se pudieron cargar las notas.');
      }
    });
  }

  actualizarNota(matriculaId: number, nota: string): void {
    this.filasNotas.update((filas) =>
      filas.map((fila) => (fila.matricula.id === matriculaId ? { ...fila, nota } : fila))
    );
  }

  actualizarObservacion(matriculaId: number, observacion: string): void {
    this.filasNotas.update((filas) =>
      filas.map((fila) => (fila.matricula.id === matriculaId ? { ...fila, observacion } : fila))
    );
  }

  guardarNotas(): void {
    const evaluacionId = this.evaluacionSeleccionadaId();
    if (!evaluacionId) {
      this.error.set('Selecciona o crea una evaluacion antes de guardar notas.');
      return;
    }

    const notas = this.filasNotas()
      .filter((fila) => fila.nota.trim() !== '')
      .map((fila) => ({
        matriculaId: fila.matricula.id,
        nota: Number(fila.nota),
        observacion: fila.observacion.trim() || null
      }));

    if (!notas.length || notas.some((item) => Number.isNaN(item.nota) || item.nota < 0 || item.nota > 20)) {
      this.error.set('Ingresa notas validas entre 0 y 20 antes de guardar.');
      return;
    }

    this.guardandoNotas.set(true);
    this.error.set(null);
    this.mensaje.set(null);

    this.evaluacionService.registrarNotas(evaluacionId, notas).subscribe({
      next: (response) => {
        this.guardandoNotas.set(false);
        this.notasRegistradas.set(response);
        this.prepararFilasNotas(this.matriculas(), response);
        this.mensaje.set('Notas guardadas y promedio bimestral recalculado.');
      },
      error: (error) => {
        this.guardandoNotas.set(false);
        this.error.set(error?.error?.mensaje ?? 'No se pudieron guardar las notas.');
      }
    });
  }

  private prepararFilasNotas(matriculas: Matricula[], notas: DetalleNotaEvaluacion[]): void {
    const notasPorMatricula = new Map(notas.map((nota) => [nota.matriculaId, nota]));
    this.filasNotas.set(
      matriculas.map((matricula) => {
        const nota = notasPorMatricula.get(matricula.id);
        return {
          matricula,
          nota: nota?.nota?.toString() ?? '',
          observacion: nota?.observacion ?? ''
        };
      })
    );
  }
}
