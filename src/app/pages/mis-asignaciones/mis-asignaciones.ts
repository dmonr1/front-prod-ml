import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { CustomAlertComponent } from '../../components/custom-alert/custom-alert';
import { AsignacionDocente } from '../../models/asignacion';
import { Tutoria } from '../../models/tutoria';
import { AuthService } from '../../services/auth/auth.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-mis-asignaciones',
  imports: [Shell, RouterLink, CustomAlertComponent],
  templateUrl: './mis-asignaciones.html',
  styleUrl: './mis-asignaciones.scss'
})
export class MisAsignaciones implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly asignacionService = inject(AsignacionAcademicaService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mostrarError = signal(true);
  readonly currentYear = new Date().getFullYear();
  readonly periodoAcademicoId = signal<number | null>(null);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly seccionesTutoradas = signal<Tutoria[]>([]);
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());

  ngOnInit(): void {
    this.resolverPeriodoYCargarAsignaciones();
  }

  reintentarCarga(): void {
    this.mostrarError.set(false);
    this.error.set('');
    this.resolverPeriodoYCargarAsignaciones();
  }

  cerrarError(): void {
    this.mostrarError.set(false);
  }

  private resolverPeriodoYCargarAsignaciones(): void {
    this.cargando.set(true);
    this.error.set('');
    this.mostrarError.set(false);

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        const periodoActual =
          periodos.find((periodo) => periodo.anio === this.currentYear) ??
          [...periodos].sort((a, b) => b.anio - a.anio)[0] ??
          null;

        if (!periodoActual) {
          this.cargando.set(true);
          this.error.set('No existe un periodo academico configurado para cargar asignaciones.');
          this.mostrarError.set(true);
          return;
        }

        this.periodoAcademicoId.set(periodoActual.id);
        this.cargarAsignaciones();
      },
      error: (error) => {
        this.cargando.set(true);
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo resolver el periodo academico actual.'
        );
        this.mostrarError.set(true);
      }
    });
  }

  cargarAsignaciones(): void {
    const docenteId = this.usuario()?.docenteId;
    const periodoAcademicoId = this.periodoAcademicoId();

    if (!docenteId) {
      this.cargando.set(true);
      this.error.set('Tu usuario no tiene un docente vinculado. Revisa la configuracion del backend.');
      this.mostrarError.set(true);
      return;
    }

    if (!periodoAcademicoId) {
      this.cargando.set(true);
      this.error.set('No se pudo identificar el periodo academico actual.');
      this.mostrarError.set(true);
      return;
    }

    this.cargando.set(true);
    this.error.set('');
    this.mostrarError.set(false);

    forkJoin({
      asignaciones: this.asignacionService.listarAsignaciones(docenteId, periodoAcademicoId),
      tutorias: this.tutoriaService.listarPorDocente(docenteId, periodoAcademicoId)
    }).subscribe({
      next: ({ asignaciones, tutorias }) => {
        this.asignaciones.set(asignaciones);
        this.seccionesTutoradas.set(
          tutorias.filter((tutoria) => (tutoria.estado ?? 'ACTIVO') === 'ACTIVO')
        );
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(
          error?.error?.mensaje ?? 'No se pudieron cargar las asignaciones del docente.'
        );
        this.cargando.set(true);
        this.mostrarError.set(true);
      }
    });
  }

  obtenerDescripcion(asignacion: AsignacionDocente): string {
    return `${asignacion.grado} - Seccion ${asignacion.seccion}`;
  }

  obtenerDescripcionTutoria(tutoria: Tutoria): string {
    return `${tutoria.grado} - Seccion ${tutoria.seccion}`;
  }
}
