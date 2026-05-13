import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { DatePickerComponent } from '../../components/date-picker/date-picker';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
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
  selector: 'app-alumnos',
  imports: [Shell, FormsModule, DatePickerComponent, CustomAlertComponent],
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

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly errorPeriodos = signal<string | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });

  readonly modalPeriodoAbierto = signal(false);
  readonly guardandoPeriodo = signal(false);
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

  private ordenarPeriodos(periodos: PeriodoAcademico[]): PeriodoAcademico[] {
    return [...periodos].sort((a, b) => a.anio - b.anio || a.nombre.localeCompare(b.nombre));
  }

  cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.errorPeriodos.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        this.periodos.set(this.ordenarPeriodos(response));
        this.cargandoPeriodos.set(false);
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
      }
    });
  }

  cargarPeriodosEvaluacion(): void {
    this.periodoEvaluacionService.listar().subscribe({
      next: (response) => {
        this.periodosEvaluacion.set(response);
      },
      error: () => {}
    });
  }

  abrirPeriodo(periodoId: number): void {
    void this.router.navigate(['/gestion-estudiantil/periodo', periodoId]);
  }

  totalPeriodosEvaluacionPeriodo(periodoId: number): number {
    return this.periodosEvaluacion().filter((periodoEvaluacion) => periodoEvaluacion.periodoAcademicoId === periodoId).length;
  }

  nombreEsquemaPeriodoEvaluacion(tipo: string | null): string {
    return this.esquemasPeriodoEvaluacion.find((esquema) => esquema.tipo === tipo)?.nombre ?? 'Sin esquema';
  }

  abrirModalPeriodo(): void {
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

  private calcularRangos(
    fechaInicio: string,
    fechaFin: string,
    cantidad: number
  ): Pick<PeriodoEvaluacionBorrador, 'fechaInicio' | 'fechaFin'>[] {
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

  guardarPeriodo(): void {
    const payload = this.formPeriodo();

    if (!payload.nombre.trim() || !payload.anio || !payload.fechaInicio || !payload.fechaFin) {
      this.mostrarAlerta(
        'warning',
        'Completa los datos',
        'Completa nombre, ano, fecha de inicio y fecha de fin.',
        {
          confirmText: null,
          autoCloseMs: 3000
        }
      );
      return;
    }

    const periodosEvaluacion = this.periodosEvaluacionBorrador();
    const tieneFechasIncompletas = periodosEvaluacion.some((periodo) => !periodo.fechaInicio || !periodo.fechaFin);

    if (!periodosEvaluacion.length || tieneFechasIncompletas) {
      this.mostrarAlerta(
        'warning',
        'Faltan periodos de evaluacion',
        'Configura las fechas de todos los periodos de evaluacion.',
        {
          confirmText: null,
          autoCloseMs: 3000
        }
      );
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
          this.limpiarFormularioPeriodo();
          this.cerrarModalPeriodo();
          this.mostrarAlerta(
            'success',
            'Periodo registrado',
            'El periodo academico y sus periodos de evaluacion se guardaron correctamente.',
            {
              confirmText: null,
              autoCloseMs: 3000
            }
          );
        },
        error: (error) => {
          this.guardandoPeriodo.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo guardar',
            error?.error?.mensaje ?? 'No se pudo registrar el periodo academico.'
          );
        }
      });
  }
}
