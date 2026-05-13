import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { AuthService } from '../../services/auth/auth.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';

@Component({
  selector: 'app-mis-asignaciones',
  imports: [Shell, RouterLink],
  templateUrl: './mis-asignaciones.html',
  styleUrl: './mis-asignaciones.scss'
})
export class MisAsignaciones implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly asignacionService = inject(AsignacionAcademicaService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);

  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly currentYear = new Date().getFullYear();
  readonly periodoAcademicoId = signal<number | null>(null);
  readonly asignaciones = signal<AsignacionDocente[]>([]);

  ngOnInit(): void {
    this.resolverPeriodoYCargarAsignaciones();
  }

  private resolverPeriodoYCargarAsignaciones(): void {
    this.cargando.set(true);
    this.error.set('');

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual =
          periodos.find((periodo) => periodo.anio === this.currentYear) ??
          [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
          null;

        if (!periodoActual) {
          this.cargando.set(false);
          this.error.set('No existe un periodo academico configurado para cargar asignaciones.');
          return;
        }

        this.periodoAcademicoId.set(periodoActual.id);
        this.cargarAsignaciones();
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo resolver el periodo academico actual.'
        );
      }
    });
  }

  cargarAsignaciones(): void {
    const docenteId = this.usuario()?.docenteId;
    const periodoAcademicoId = this.periodoAcademicoId();

    if (!docenteId) {
      this.cargando.set(false);
      this.error.set('Tu usuario no tiene un docente vinculado. Revisa la configuracion del backend.');
      return;
    }

    if (!periodoAcademicoId) {
      this.cargando.set(false);
      this.error.set('No se pudo identificar el periodo academico actual.');
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    this.asignacionService
      .listarAsignaciones(docenteId, periodoAcademicoId)
      .subscribe({
        next: (asignaciones) => {
          this.asignaciones.set(asignaciones);
          this.cargando.set(false);
        },
        error: (error) => {
          this.error.set(
            error?.error?.mensaje ?? 'No se pudieron cargar las asignaciones del docente.'
          );
          this.cargando.set(false);
        }
      });
  }

  obtenerDescripcion(asignacion: AsignacionDocente): string {
    return `${asignacion.grado} - Seccion ${asignacion.seccion}`;
  }
}
