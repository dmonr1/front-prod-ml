import { Component, computed, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Bimestre } from '../../models/bimestre';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { BimestrePayload, BimestreService } from '../../services/academico/bimestre.service';
import {
  PeriodoAcademicoPayload,
  PeriodoAcademicoService
} from '../../services/academico/periodo-academico.service';

@Component({
  selector: 'app-periodos-academicos',
  imports: [Shell],
  templateUrl: './periodos-academicos.html',
  styleUrl: './periodos-academicos.scss'
})
export class PeriodosAcademicos {
  private readonly periodoService = inject(PeriodoAcademicoService);
  private readonly bimestreService = inject(BimestreService);

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly errorPeriodos = signal<string | null>(null);

  readonly bimestres = signal<Bimestre[]>([]);
  readonly cargandoBimestres = signal(true);
  readonly errorBimestres = signal<string | null>(null);

  readonly periodoSeleccionadoId = signal<number | null>(null);

  readonly periodoNombre = signal('');
  readonly periodoAnio = signal('');
  readonly periodoFechaInicio = signal('');
  readonly periodoFechaFin = signal('');
  readonly guardandoPeriodo = signal(false);
  readonly mensajePeriodo = signal<string | null>(null);
  readonly errorGuardarPeriodo = signal<string | null>(null);

  readonly bimestreNombre = signal('');
  readonly bimestreNumero = signal('');
  readonly bimestreFechaInicio = signal('');
  readonly bimestreFechaFin = signal('');
  readonly guardandoBimestre = signal(false);
  readonly mensajeBimestre = signal<string | null>(null);
  readonly errorGuardarBimestre = signal<string | null>(null);

  readonly periodoSeleccionado = computed(
    () => this.periodos().find((periodo) => periodo.id === this.periodoSeleccionadoId()) ?? null
  );

  readonly bimestresDelPeriodo = computed(() =>
    this.bimestres().filter((bimestre) => bimestre.periodoAcademicoId === this.periodoSeleccionadoId())
  );

  constructor() {
    this.cargarPeriodos();
    this.cargarBimestres();
  }

  private ordenarPeriodos(periodos: PeriodoAcademico[]): PeriodoAcademico[] {
    return [...periodos].sort((a, b) => a.anio - b.anio || a.nombre.localeCompare(b.nombre));
  }

  cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.errorPeriodos.set(null);

    this.periodoService.listar().subscribe({
      next: (response) => {
        const ordenados = this.ordenarPeriodos(response);
        this.periodos.set(ordenados);
        this.cargandoPeriodos.set(false);

        if (!this.periodoSeleccionadoId() && ordenados.length) {
          this.periodoSeleccionadoId.set(ordenados[0].id);
        }

        const seleccionado = this.periodoSeleccionadoId();
        if (seleccionado && !ordenados.some((periodo) => periodo.id === seleccionado)) {
          this.periodoSeleccionadoId.set(ordenados[0]?.id ?? null);
        }
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
      }
    });
  }

  cargarBimestres(): void {
    this.cargandoBimestres.set(true);
    this.errorBimestres.set(null);

    this.bimestreService.listar().subscribe({
      next: (response) => {
        this.bimestres.set(response);
        this.cargandoBimestres.set(false);
      },
      error: () => {
        this.errorBimestres.set('No se pudieron cargar los bimestres.');
        this.cargandoBimestres.set(false);
      }
    });
  }

  seleccionarPeriodo(periodoId: number): void {
    this.periodoSeleccionadoId.set(periodoId);
    this.mensajeBimestre.set(null);
    this.errorGuardarBimestre.set(null);
  }

  guardarPeriodo(): void {
    this.mensajePeriodo.set(null);
    this.errorGuardarPeriodo.set(null);

    const nombre = this.periodoNombre().trim();
    const anio = Number(this.periodoAnio());
    const fechaInicio = this.periodoFechaInicio();
    const fechaFin = this.periodoFechaFin();

    if (!nombre || !Number.isInteger(anio) || !fechaInicio || !fechaFin) {
      this.errorGuardarPeriodo.set('Completa todos los datos del periodo academico.');
      return;
    }

    const payload: PeriodoAcademicoPayload = {
      nombre,
      anio,
      fechaInicio,
      fechaFin
    };

    this.guardandoPeriodo.set(true);

    this.periodoService.crear(payload).subscribe({
      next: (periodo) => {
        this.guardandoPeriodo.set(false);
        this.periodoNombre.set('');
        this.periodoAnio.set('');
        this.periodoFechaInicio.set('');
        this.periodoFechaFin.set('');
        this.mensajePeriodo.set('Periodo academico registrado correctamente.');
        this.periodos.update((actual) => this.ordenarPeriodos([...actual, periodo]));
        this.periodoSeleccionadoId.set(periodo.id);
      },
      error: (error) => {
        this.guardandoPeriodo.set(false);
        this.errorGuardarPeriodo.set(
          error?.error?.mensaje ?? 'No se pudo guardar el periodo academico.'
        );
      }
    });
  }

  guardarBimestre(): void {
    this.mensajeBimestre.set(null);
    this.errorGuardarBimestre.set(null);

    const periodoId = this.periodoSeleccionadoId();
    const nombre = this.bimestreNombre().trim();
    const numero = Number(this.bimestreNumero());
    const fechaInicio = this.bimestreFechaInicio();
    const fechaFin = this.bimestreFechaFin();

    if (!periodoId) {
      this.errorGuardarBimestre.set('Selecciona un periodo academico antes de registrar bimestres.');
      return;
    }

    if (!nombre || !Number.isInteger(numero) || !fechaInicio || !fechaFin) {
      this.errorGuardarBimestre.set('Completa todos los datos del bimestre.');
      return;
    }

    const payload: BimestrePayload = {
      periodoAcademicoId: periodoId,
      nombre,
      numero,
      fechaInicio,
      fechaFin
    };

    this.guardandoBimestre.set(true);

    this.bimestreService.crear(payload).subscribe({
      next: (bimestre) => {
        this.guardandoBimestre.set(false);
        this.bimestreNombre.set('');
        this.bimestreNumero.set('');
        this.bimestreFechaInicio.set('');
        this.bimestreFechaFin.set('');
        this.mensajeBimestre.set('Bimestre registrado correctamente.');
        this.bimestres.update((actual) =>
          [...actual, bimestre].sort((a, b) => {
            if ((a.anioAcademico ?? 0) !== (b.anioAcademico ?? 0)) {
              return (b.anioAcademico ?? 0) - (a.anioAcademico ?? 0);
            }
            return a.numero - b.numero;
          })
        );
      },
      error: (error) => {
        this.guardandoBimestre.set(false);
        this.errorGuardarBimestre.set(error?.error?.mensaje ?? 'No se pudo guardar el bimestre.');
      }
    });
  }
}
