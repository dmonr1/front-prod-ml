import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { AuthService } from '../../services/auth/auth.service';
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

  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly periodoAcademicoId = signal(1);
  readonly asignaciones = signal<AsignacionDocente[]>([]);

  ngOnInit(): void {
    this.cargarAsignaciones();
  }

  cargarAsignaciones(): void {
    const docenteId = this.usuario()?.docenteId;

    if (!docenteId) {
      this.cargando.set(false);
      this.error.set('Tu usuario no tiene un docente vinculado. Revisa la configuracion del backend.');
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    this.asignacionService
      .listarAsignaciones(docenteId, this.periodoAcademicoId())
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
