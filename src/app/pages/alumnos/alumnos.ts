import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacionPayload, PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import {
  PeriodoAcademicoPayload,
  PeriodoAcademicoService
} from '../../services/academico/periodo-academico.service';

type TipoPeriodoEvaluacion = 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

interface EsquemaPeriodoEvaluacion {
  tipo: TipoPeriodoEvaluacion;
  nombre: string;
  cantidad: number;
}

interface PeriodoEvaluacionBorrador {
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

@Component({
  selector: 'app-alumnos',
  imports: [Shell, FormsModule],
  templateUrl: './alumnos.html',
  styleUrl: './alumnos.scss'
})
export class Alumnos {
  private readonly router = inject(Router);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);

  readonly currentYear = new Date().getFullYear();
  readonly esquemasPeriodoEvaluacion: EsquemaPeriodoEvaluacion[] = [
    { tipo: 'BIMESTRAL', nombre: 'Bimestral', cantidad: 4 },
    { tipo: 'TRIMESTRAL', nombre: 'Trimestral', cantidad: 3 },
    { tipo: 'SEMESTRAL', nombre: 'Semestral', cantidad: 2 },
    { tipo: 'ANUAL', nombre: 'Anual', cantidad: 1 }
  ];
  readonly tabActivo = signal<'periodos' | 'periodos-evaluacion'>('periodos');
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly errorPeriodos = signal<string | null>(null);
  readonly periodoSeleccionadoId = signal<number | null>(null);

  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly cargandoPeriodosEvaluacion = signal(true);
  readonly errorPeriodosEvaluacion = signal<string | null>(null);
  readonly periodoEvaluacionNombre = signal('');
  readonly periodoEvaluacionNumero = signal('');
  readonly periodoEvaluacionFechaInicio = signal('');
  readonly periodoEvaluacionFechaFin = signal('');
  readonly guardandoPeriodoEvaluacion = signal(false);
  readonly mensajePeriodoEvaluacion = signal<string | null>(null);
  readonly errorGuardarPeriodoEvaluacion = signal<string | null>(null);

  readonly modalPeriodoAbierto = signal(false);
  readonly guardandoPeriodo = signal(false);
  readonly errorPeriodoNuevo = signal<string | null>(null);
  readonly exitoPeriodoNuevo = signal<string | null>(null);
  readonly tipoPeriodoEvaluacion = signal<TipoPeriodoEvaluacion>('BIMESTRAL');
  readonly periodosEvaluacionBorrador = signal<PeriodoEvaluacionBorrador[]>([]);
  readonly formPeriodo = signal<PeriodoAcademicoPayload>({
    nombre: '',
    anio: this.currentYear,
    fechaInicio: '',
    fechaFin: '',
    tipoPeriodoEvaluacion: 'BIMESTRAL'
  });

  constructor() {
    this.regenerarPeriodosEvaluacionBorrador();
    this.cargarPeriodos();
    this.cargarPeriodosEvaluacion();
  }

  readonly periodoSeleccionado = computed(
    () => this.periodos().find((periodo) => periodo.id === this.periodoSeleccionadoId()) ?? null
  );

  readonly periodosEvaluacionDelPeriodo = computed(() =>
    this.periodosEvaluacion()
      .filter((periodoEvaluacion) => periodoEvaluacion.periodoAcademicoId === this.periodoSeleccionadoId())
      .sort((a, b) => a.numero - b.numero)
  );

  private ordenarPeriodos(periodos: PeriodoAcademico[]): PeriodoAcademico[] {
    return [...periodos].sort((a, b) => a.anio - b.anio || a.nombre.localeCompare(b.nombre));
  }

  cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.errorPeriodos.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        const ordenados = this.ordenarPeriodos(response);
        this.periodos.set(ordenados);
        this.cargandoPeriodos.set(false);
        if (!this.periodoSeleccionadoId() && ordenados.length) {
          this.periodoSeleccionadoId.set(ordenados[0].id);
        }
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
      }
    });
  }

  cargarPeriodosEvaluacion(): void {
    this.cargandoPeriodosEvaluacion.set(true);
    this.errorPeriodosEvaluacion.set(null);

    this.periodoEvaluacionService.listar().subscribe({
      next: (response) => {
        this.periodosEvaluacion.set(response);
        this.cargandoPeriodosEvaluacion.set(false);
      },
      error: () => {
        this.errorPeriodosEvaluacion.set('No se pudieron cargar los periodos de evaluacion.');
        this.cargandoPeriodosEvaluacion.set(false);
      }
    });
  }

  seleccionarPeriodo(periodoId: number): void {
    this.periodoSeleccionadoId.set(periodoId);
    this.mensajePeriodoEvaluacion.set(null);
    this.errorGuardarPeriodoEvaluacion.set(null);
  }

  abrirPeriodo(periodoId: number): void {
    void this.router.navigate(['/gestion-estudiantil/periodo', periodoId]);
  }

  abrirConfiguracionPeriodosEvaluacion(periodoId: number): void {
    this.seleccionarPeriodo(periodoId);
    this.tabActivo.set('periodos-evaluacion');
  }

  totalPeriodosEvaluacionPeriodo(periodoId: number): number {
    return this.periodosEvaluacion().filter((periodoEvaluacion) => periodoEvaluacion.periodoAcademicoId === periodoId).length;
  }

  nombreEsquemaPeriodoEvaluacion(tipo: string | null): string {
    return this.esquemasPeriodoEvaluacion.find((esquema) => esquema.tipo === tipo)?.nombre ?? 'Sin esquema';
  }

  abrirModalPeriodo(): void {
    this.errorPeriodoNuevo.set(null);
    this.exitoPeriodoNuevo.set(null);
    this.regenerarPeriodosEvaluacionBorrador();
    this.modalPeriodoAbierto.set(true);
  }

  cerrarModalPeriodo(): void {
    this.modalPeriodoAbierto.set(false);
  }

  actualizarCampoPeriodo<K extends keyof PeriodoAcademicoPayload>(
    campo: K,
    valor: PeriodoAcademicoPayload[K]
  ): void {
    this.formPeriodo.update((actual) => ({
      ...actual,
      [campo]: valor
    }));

    if (campo === 'fechaInicio' || campo === 'fechaFin') {
      this.regenerarPeriodosEvaluacionBorrador();
    }
  }

  cambiarTipoPeriodoEvaluacion(tipo: TipoPeriodoEvaluacion): void {
    this.tipoPeriodoEvaluacion.set(tipo);
    this.actualizarCampoPeriodo('tipoPeriodoEvaluacion', tipo);
    this.regenerarPeriodosEvaluacionBorrador();
  }

  actualizarFechaBorrador(index: number, campo: 'fechaInicio' | 'fechaFin', valor: string): void {
    this.periodosEvaluacionBorrador.update((actual) =>
      actual.map((periodo, i) => (i === index ? { ...periodo, [campo]: valor } : periodo))
    );
  }

  private regenerarPeriodosEvaluacionBorrador(): void {
    const esquema = this.esquemasPeriodoEvaluacion.find((item) => item.tipo === this.tipoPeriodoEvaluacion());
    const cantidad = esquema?.cantidad ?? 4;
    const { fechaInicio, fechaFin } = this.formPeriodo();
    const rangos = this.calcularRangos(fechaInicio, fechaFin, cantidad);

    this.periodosEvaluacionBorrador.set(
      Array.from({ length: cantidad }, (_, index) => ({
        numero: index + 1,
        nombre: `Periodo ${this.numeroRomano(index + 1)}`,
        fechaInicio: rangos[index]?.fechaInicio ?? '',
        fechaFin: rangos[index]?.fechaFin ?? ''
      }))
    );
  }

  private calcularRangos(fechaInicio: string, fechaFin: string, cantidad: number): Pick<PeriodoEvaluacionBorrador, 'fechaInicio' | 'fechaFin'>[] {
    if (!fechaInicio || !fechaFin || cantidad < 1) {
      return [];
    }

    const inicio = this.parseDate(fechaInicio);
    const fin = this.parseDate(fechaFin);

    if (fin.getTime() < inicio.getTime()) {
      return [];
    }

    const totalDias = Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    const diasBase = Math.floor(totalDias / cantidad);
    const sobrantes = totalDias % cantidad;
    let cursor = new Date(inicio);

    return Array.from({ length: cantidad }, (_, index) => {
      const diasPeriodo = diasBase + (index < sobrantes ? 1 : 0);
      const desde = new Date(cursor);
      const hasta = new Date(cursor);
      hasta.setUTCDate(hasta.getUTCDate() + Math.max(diasPeriodo - 1, 0));
      cursor = new Date(hasta);
      cursor.setUTCDate(cursor.getUTCDate() + 1);

      return {
        fechaInicio: this.formatDate(desde),
        fechaFin: this.formatDate(hasta)
      };
    });
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private numeroRomano(numero: number): string {
    const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanos[numero - 1] ?? String(numero);
  }

  limpiarFormularioPeriodo(): void {
    this.formPeriodo.set({
      nombre: '',
      anio: this.currentYear,
      fechaInicio: '',
      fechaFin: '',
      tipoPeriodoEvaluacion: 'BIMESTRAL'
    });
    this.tipoPeriodoEvaluacion.set('BIMESTRAL');
    this.regenerarPeriodosEvaluacionBorrador();
    this.errorPeriodoNuevo.set(null);
    this.exitoPeriodoNuevo.set(null);
  }

  guardarPeriodo(): void {
    const payload = this.formPeriodo();

    this.errorPeriodoNuevo.set(null);
    this.exitoPeriodoNuevo.set(null);

    if (!payload.nombre.trim() || !payload.anio || !payload.fechaInicio || !payload.fechaFin) {
      this.errorPeriodoNuevo.set('Completa nombre, ano, fecha de inicio y fecha de fin.');
      return;
    }

    const periodosEvaluacion = this.periodosEvaluacionBorrador();
    const tieneFechasIncompletas = periodosEvaluacion.some((periodo) => !periodo.fechaInicio || !periodo.fechaFin);

    if (!periodosEvaluacion.length || tieneFechasIncompletas) {
      this.errorPeriodoNuevo.set('Configura las fechas de todos los periodos de evaluacion.');
      return;
    }

    this.guardandoPeriodo.set(true);

    this.periodoAcademicoService
      .crearConPeriodosEvaluacion({
        nombre: payload.nombre.trim(),
        anio: Number(payload.anio),
        fechaInicio: payload.fechaInicio,
        fechaFin: payload.fechaFin,
        tipoPeriodoEvaluacion: this.tipoPeriodoEvaluacion(),
        periodosEvaluacion
      })
      .subscribe({
        next: ({ periodoAcademico, periodosEvaluacion: creados }) => {
          this.guardandoPeriodo.set(false);
          this.periodos.update((actual) => this.ordenarPeriodos([...actual, periodoAcademico]));
          this.periodosEvaluacion.update((actual) => [...actual, ...creados]);
          this.periodoSeleccionadoId.set(periodoAcademico.id);
          this.limpiarFormularioPeriodo();
          this.exitoPeriodoNuevo.set('Periodo academico y periodos de evaluacion registrados correctamente.');
          this.tabActivo.set('periodos-evaluacion');
        },
        error: (error) => {
          this.guardandoPeriodo.set(false);
          this.errorPeriodoNuevo.set(
            error?.error?.mensaje ?? 'No se pudo registrar el periodo academico.'
          );
        }
      });
  }

  limpiarFormularioPeriodoEvaluacion(): void {
    this.periodoEvaluacionNombre.set('');
    this.periodoEvaluacionNumero.set('');
    this.periodoEvaluacionFechaInicio.set('');
    this.periodoEvaluacionFechaFin.set('');
    this.mensajePeriodoEvaluacion.set(null);
    this.errorGuardarPeriodoEvaluacion.set(null);
  }

  guardarPeriodoEvaluacion(): void {
    this.mensajePeriodoEvaluacion.set(null);
    this.errorGuardarPeriodoEvaluacion.set(null);

    const periodoId = this.periodoSeleccionadoId();
    const nombre = this.periodoEvaluacionNombre().trim();
    const numero = Number(this.periodoEvaluacionNumero());
    const fechaInicio = this.periodoEvaluacionFechaInicio();
    const fechaFin = this.periodoEvaluacionFechaFin();

    if (!periodoId) {
      this.errorGuardarPeriodoEvaluacion.set('Selecciona un periodo academico antes de registrar periodos.');
      return;
    }

    if (!nombre || !Number.isInteger(numero) || !fechaInicio || !fechaFin) {
      this.errorGuardarPeriodoEvaluacion.set('Completa todos los datos del periodo de evaluacion.');
      return;
    }

    const payload: PeriodoEvaluacionPayload = {
      periodoAcademicoId: periodoId,
      nombre,
      numero,
      fechaInicio,
      fechaFin
    };

    this.guardandoPeriodoEvaluacion.set(true);

    this.periodoEvaluacionService.crear(payload).subscribe({
      next: (periodoEvaluacion) => {
        this.guardandoPeriodoEvaluacion.set(false);
        this.limpiarFormularioPeriodoEvaluacion();
        this.mensajePeriodoEvaluacion.set('Periodo de evaluacion registrado correctamente.');
        this.periodosEvaluacion.update((actual) => [...actual, periodoEvaluacion]);
      },
      error: (error) => {
        this.guardandoPeriodoEvaluacion.set(false);
        this.errorGuardarPeriodoEvaluacion.set(error?.error?.mensaje ?? 'No se pudo guardar el periodo de evaluacion.');
      }
    });
  }
}
