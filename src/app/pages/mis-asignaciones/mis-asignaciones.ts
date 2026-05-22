import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { CustomAlertComponent } from '../../components/custom-alert/custom-alert';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { Seccion } from '../../models/seccion';
import { Tutoria } from '../../models/tutoria';
import { AuthService } from '../../services/auth/auth.service';
import { CursoService } from '../../services/academico/curso.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { SeccionService } from '../../services/academico/seccion.service';
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
  private readonly cursoService = inject(CursoService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly matriculaService = inject(MatriculaService);
  private readonly seccionService = inject(SeccionService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mostrarError = signal(true);
  readonly currentYear = new Date().getFullYear();
  readonly periodoAcademicoId = signal<number | null>(null);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly cursosCatalogo = signal<Curso[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly matriculasPorSeccion = signal<Record<number, number>>({});
  readonly seccionesTutoradas = signal<Tutoria[]>([]);
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());
  readonly periodoAcademicoAnio = computed(() => this.asignaciones()[0]?.anioAcademico ?? this.seccionesTutoradas()[0]?.anioAcademico ?? null);

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
      tutorias: this.tutoriaService.listarPorDocente(docenteId, periodoAcademicoId),
      cursos: this.cursoService.listar(),
      secciones: this.seccionService.listar(periodoAcademicoId)
    }).subscribe({
      next: ({ asignaciones, tutorias, cursos, secciones }) => {
        this.asignaciones.set(asignaciones);
        this.cursosCatalogo.set(cursos);
        this.secciones.set(secciones);
        this.seccionesTutoradas.set(
          tutorias.filter((tutoria) => (tutoria.estado ?? 'ACTIVO') === 'ACTIVO')
        );
        this.cargarMatriculasPorSeccion(periodoAcademicoId);
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

  obtenerAnioPeriodo(etiqueta: string): string {
    const match = etiqueta.match(/\b(20\d{2})\b/);
    return match?.[1] ?? etiqueta;
  }

  obtenerDescripcionTutoria(tutoria: Tutoria): string {
    return `${tutoria.grado} - Seccion ${tutoria.seccion}`;
  }

  obtenerResumenAlumnosTutoria(tutoria: Tutoria): string {
    const matriculados = this.matriculasPorSeccion()[tutoria.seccionId] ?? 0;
    const capacidad = this.secciones().find((seccion) => seccion.id === tutoria.seccionId)?.capacidad ?? null;

    if (capacidad && capacidad > 0) {
      return `${matriculados}/${capacidad} alumnos`;
    }

    return `${matriculados} alumnos`;
  }

  obtenerCursoCatalogo(cursoId: number): Curso | null {
    return this.cursosCatalogo().find((curso) => curso.id === cursoId) ?? null;
  }

  estiloPortada(asignacion: AsignacionDocente): string {
    return this.obtenerCursoCatalogo(asignacion.cursoId)?.portadaColor ?? '#C96A1B';
  }

  imagenPortada(asignacion: AsignacionDocente): string | null {
    return this.obtenerCursoCatalogo(asignacion.cursoId)?.portadaImagen ?? null;
  }

  iconoPortada(asignacion: AsignacionDocente): string {
    return this.obtenerCursoCatalogo(asignacion.cursoId)?.portadaIcono ?? 'fa-solid fa-book-open';
  }

  private cargarMatriculasPorSeccion(periodoAcademicoId: number): void {
    const seccionesTutoradas = this.seccionesTutoradas();

    if (!seccionesTutoradas.length) {
      this.matriculasPorSeccion.set({});
      this.cargando.set(false);
      return;
    }

    const solicitudes = seccionesTutoradas.map((tutoria) =>
      this.matriculaService.listar(periodoAcademicoId, tutoria.seccionId)
    );

    forkJoin(solicitudes).subscribe({
      next: (resultados) => {
        const resumen: Record<number, number> = {};
        seccionesTutoradas.forEach((tutoria, index) => {
          resumen[tutoria.seccionId] = resultados[index]?.length ?? 0;
        });
        this.matriculasPorSeccion.set(resumen);
        this.cargando.set(false);
      },
      error: () => {
        this.matriculasPorSeccion.set({});
        this.cargando.set(false);
      }
    });
  }
}
