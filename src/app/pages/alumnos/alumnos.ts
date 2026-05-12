import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoAcademico } from '../../models/periodo-academico';
import {
  PeriodoAcademicoPayload,
  PeriodoAcademicoService
} from '../../services/academico/periodo-academico.service';

@Component({
  selector: 'app-alumnos',
  imports: [Shell, FormsModule, RouterLink],
  templateUrl: './alumnos.html',
  styleUrl: './alumnos.scss'
})
export class Alumnos {
  private readonly router = inject(Router);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);

  readonly currentYear = new Date().getFullYear();
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly errorPeriodos = signal<string | null>(null);
  readonly modalPeriodoAbierto = signal(false);
  readonly guardandoPeriodo = signal(false);
  readonly errorPeriodoNuevo = signal<string | null>(null);
  readonly exitoPeriodoNuevo = signal<string | null>(null);
  readonly formPeriodo = signal<PeriodoAcademicoPayload>({
    nombre: '',
    anio: this.currentYear,
    fechaInicio: '',
    fechaFin: ''
  });

  constructor() {
    this.cargarPeriodos();
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

  abrirPeriodo(periodoId: number): void {
    void this.router.navigate(['/gestion-estudiantil/periodo', periodoId]);
  }

  abrirModalPeriodo(): void {
    this.errorPeriodoNuevo.set(null);
    this.exitoPeriodoNuevo.set(null);
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
  }

  limpiarFormularioPeriodo(): void {
    this.formPeriodo.set({
      nombre: '',
      anio: this.currentYear,
      fechaInicio: '',
      fechaFin: ''
    });
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

    this.guardandoPeriodo.set(true);

    this.periodoAcademicoService
      .crear({
        nombre: payload.nombre.trim(),
        anio: Number(payload.anio),
        fechaInicio: payload.fechaInicio,
        fechaFin: payload.fechaFin
      })
      .subscribe({
        next: (periodo) => {
          this.guardandoPeriodo.set(false);
          this.periodos.update((actual) => this.ordenarPeriodos([...actual, periodo]));
          this.limpiarFormularioPeriodo();
          this.exitoPeriodoNuevo.set('Periodo academico registrado correctamente.');
        },
        error: (error) => {
          this.guardandoPeriodo.set(false);
          this.errorPeriodoNuevo.set(
            error?.error?.mensaje ?? 'No se pudo registrar el periodo academico.'
          );
        }
      });
  }
}
