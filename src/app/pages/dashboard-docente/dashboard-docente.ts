import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Shell } from '../../layouts/shell/shell';
import { AlumnoService } from '../../services/academico/alumno.service';
import { CursoPeriodoAcademicoService } from '../../services/academico/curso-periodo-academico.service';
import { CursoService } from '../../services/academico/curso.service';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { Seccion } from '../../models/seccion';
import { SeccionService } from '../../services/academico/seccion.service';
import { PrediccionService, ResumenPrediccion } from '../../services/prediccion/prediccion.service';

type KpiTone = 'blue' | 'violet' | 'sky' | 'mint' | 'amber' | 'rose';

interface DashboardKpi {
  label: string;
  value: string;
  icon: string;
  tone: KpiTone;
  detail: string;
}

interface DashboardProgress {
  label: string;
  value: string;
  width: string;
}

interface DashboardActivity {
  time: string;
  title: string;
  detail: string;
  icon: string;
}

interface DashboardPending {
  text: string;
}

@Component({
  selector: 'app-dashboard-docente',
  imports: [Shell, RouterLink],
  templateUrl: './dashboard-docente.html',
  styleUrl: './dashboard-docente.scss'
})
export class DashboardDocente implements OnInit {
  private readonly alumnoService = inject(AlumnoService);
  private readonly docenteService = inject(DocenteService);
  private readonly cursoService = inject(CursoService);
  private readonly cursoPeriodoAcademicoService = inject(CursoPeriodoAcademicoService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly seccionService = inject(SeccionService);
  private readonly prediccionService = inject(PrediccionService);

  readonly kpis = signal<DashboardKpi[]>([]);
  readonly avances = signal<DashboardProgress[]>([]);
  readonly actividad = signal<DashboardActivity[]>([]);
  readonly pendientes = signal<DashboardPending[]>([]);

  readonly accesos = [
    { label: 'Mis asignaciones', path: '/mis-asignaciones', icon: 'fa-solid fa-book-bookmark' },
    { label: 'Seccion tutorada', path: '/seccion-tutorada', icon: 'fa-solid fa-users-viewfinder' },
    { label: 'Asistencias', path: '/asistencias', icon: 'fa-solid fa-calendar-check' },
    { label: 'Predicciones', path: '/predicciones', icon: 'fa-solid fa-chart-line' },
    { label: 'Hallazgos', path: '/hallazgos', icon: 'fa-solid fa-magnifying-glass-chart' },
    { label: 'Perfil alumno', path: '/predicciones', icon: 'fa-solid fa-id-badge' }
  ] as const;

  ngOnInit(): void {
    this.cargarDashboard();
  }

  private cargarDashboard(): void {
    forkJoin({
      periodosAcademicos: this.periodoAcademicoService.listar().pipe(catchError(() => of([]))),
      periodosEvaluacion: this.periodoEvaluacionService.listar().pipe(catchError(() => of([]))),
      alumnos: this.alumnoService.listar().pipe(catchError(() => of([]))),
      docentes: this.docenteService.listar().pipe(catchError(() => of([]))),
      cursosBase: this.cursoService.listar().pipe(catchError(() => of([])))
    })
      .pipe(
        switchMap((base) => {
          const periodoActivo = this.resolverPeriodoActivo(base.periodosAcademicos);
          const periodoEvaluacionActivo = this.resolverPeriodoEvaluacionActivo(
            base.periodosEvaluacion,
            periodoActivo?.id ?? null
          );

          if (!periodoActivo) {
            return of({
              ...base,
              periodoActivo: null,
              periodoEvaluacionActivo,
              secciones: [] as Seccion[],
              cursosPeriodo: [],
              resumenes: [] as Array<ResumenPrediccion | null>
            });
          }

          return forkJoin({
            secciones: this.seccionService.listar(periodoActivo.id).pipe(catchError(() => of([]))),
            cursosPeriodo: this.cursoPeriodoAcademicoService
              .listar(periodoActivo.id)
              .pipe(catchError(() => of([])))
          }).pipe(
            switchMap((extra) => {
              if (!periodoEvaluacionActivo || !extra.secciones.length) {
                return of({
                  ...base,
                  periodoActivo,
                  periodoEvaluacionActivo,
                  ...extra,
                  resumenes: [] as Array<ResumenPrediccion | null>
                });
              }

              return forkJoin(
                extra.secciones.map((seccion) =>
                  this.prediccionService
                    .obtenerResumen(periodoEvaluacionActivo.id, seccion.id)
                    .pipe(catchError(() => of(null)))
                )
              ).pipe(
                map((resumenes) => ({
                  ...base,
                  periodoActivo,
                  periodoEvaluacionActivo,
                  ...extra,
                  resumenes
                }))
              );
            })
          );
        })
      )
      .subscribe((data) => this.aplicarDashboard(data));
  }

  private aplicarDashboard(data: {
    periodosAcademicos: PeriodoAcademico[];
    periodosEvaluacion: PeriodoEvaluacion[];
    alumnos: { id: number }[];
    docentes: { id: number }[];
    cursosBase: { id: number }[];
    periodoActivo: PeriodoAcademico | null;
    periodoEvaluacionActivo: PeriodoEvaluacion | null;
    secciones: Seccion[];
    cursosPeriodo: { id: number }[];
    resumenes: Array<ResumenPrediccion | null>;
  }): void {
    const totalAlumnos = data.alumnos.length;
    const totalDocentes = data.docentes.length;
    const totalCursos = data.cursosBase.length;
    const totalSecciones = data.secciones.length;
    const totalCursosPeriodo = data.cursosPeriodo.length;
    const resumenesValidos = data.resumenes.filter((item): item is ResumenPrediccion => item !== null);
    const seccionesConPrediccion = resumenesValidos.filter((item) => item.totalPredicciones > 0).length;
    const totalPredicciones = resumenesValidos.reduce((acc, item) => acc + (item.totalPredicciones ?? 0), 0);
    const totalRiesgoAlto = resumenesValidos.reduce((acc, item) => acc + (item.totalRiesgoAlto ?? 0), 0);
    const promedioRiesgo =
      resumenesValidos.length > 0
        ? resumenesValidos.reduce((acc, item) => acc + Number(item.promedioPuntajeRiesgo ?? 0), 0) /
          resumenesValidos.length
        : 0;

    const coberturaSecciones = totalSecciones > 0 ? Math.round((seccionesConPrediccion / totalSecciones) * 100) : 0;
    const coberturaAlumnos = totalAlumnos > 0 ? Math.round((totalPredicciones / totalAlumnos) * 100) : 0;
    const coberturaCursos = totalCursos > 0 ? Math.round((totalCursosPeriodo / totalCursos) * 100) : 0;
    const coberturaPeriodos =
      data.periodoActivo
        ? Math.round(
            (data.periodosEvaluacion.filter((item) => item.periodoAcademicoId === data.periodoActivo!.id).length /
              Math.max(
                data.periodosEvaluacion.filter((item) => item.periodoAcademicoId === data.periodoActivo!.id).length,
                1
              )) *
              100
          )
        : 0;

    this.kpis.set([
      {
        label: 'Periodo academico',
        value: data.periodoActivo?.anio?.toString() ?? '--',
        icon: 'fa-regular fa-calendar',
        tone: 'blue',
        detail: data.periodoActivo?.nombre ?? 'Sin periodo activo'
      },
      {
        label: 'Periodo evaluacion',
        value: data.periodoEvaluacionActivo?.nombre ?? '--',
        icon: 'fa-regular fa-clock',
        tone: 'violet',
        detail: data.periodoEvaluacionActivo
          ? `Corte ${data.periodoEvaluacionActivo.numero}`
          : 'Sin corte activo'
      },
      {
        label: 'Alumnos registrados',
        value: `${totalAlumnos}`,
        icon: 'fa-solid fa-user-graduate',
        tone: 'sky',
        detail: 'Alumnos visibles en el sistema'
      },
      {
        label: 'Docentes activos',
        value: `${totalDocentes}`,
        icon: 'fa-solid fa-chalkboard-user',
        tone: 'mint',
        detail: 'Docentes registrados'
      },
      {
        label: 'Secciones activas',
        value: `${totalSecciones}`,
        icon: 'fa-solid fa-layer-group',
        tone: 'amber',
        detail: 'Secciones del periodo activo'
      },
      {
        label: 'Cursos configurados',
        value: `${totalCursosPeriodo}`,
        icon: 'fa-solid fa-book-open',
        tone: 'rose',
        detail: 'Cursos ligados al periodo actual'
      }
    ]);

    this.avances.set([
      {
        label: 'Secciones con predicciones',
        value: `${coberturaSecciones}%`,
        width: `${coberturaSecciones}%`
      },
      {
        label: 'Alumnos con ficha predictiva',
        value: `${coberturaAlumnos}%`,
        width: `${coberturaAlumnos}%`
      },
      {
        label: 'Cursos configurados en el periodo',
        value: `${coberturaCursos}%`,
        width: `${coberturaCursos}%`
      },
      {
        label: 'Periodos de evaluacion listos',
        value: `${coberturaPeriodos}%`,
        width: `${coberturaPeriodos}%`
      }
    ]);

    this.actividad.set([
      {
        time: data.periodoActivo?.fechaInicio?.slice(0, 10) ?? '--',
        title: 'Periodo academico detectado',
        detail: data.periodoActivo
          ? `${data.periodoActivo.nombre} ${data.periodoActivo.anio} se encuentra disponible en el dashboard.`
          : 'Aun no se detecta un periodo academico activo.',
        icon: 'fa-regular fa-calendar'
      },
      {
        time: data.periodoEvaluacionActivo?.fechaInicio?.slice(5, 10) ?? '--',
        title: 'Periodo de evaluacion activo',
        detail: data.periodoEvaluacionActivo
          ? `${data.periodoEvaluacionActivo.nombre} es el corte usado para la vista general.`
          : 'No hay un periodo de evaluacion activo para consolidar resumenes.',
        icon: 'fa-regular fa-clock'
      },
      {
        time: `${seccionesConPrediccion}/${totalSecciones || 0}`,
        title: 'Cobertura de secciones',
        detail: 'Resume cuantas secciones ya tienen informacion suficiente para mostrar predicciones.',
        icon: 'fa-solid fa-layer-group'
      },
      {
        time: `${Math.round(promedioRiesgo)}%`,
        title: 'Promedio de riesgo disponible',
        detail: `Se consolidaron ${totalPredicciones} predicciones y ${totalRiesgoAlto} casos de riesgo alto en el corte actual.`,
        icon: 'fa-solid fa-chart-line'
      }
    ]);

    const pendientes: DashboardPending[] = [];
    if (!data.periodoActivo) {
      pendientes.push({ text: 'No se detecta un periodo academico activo para consolidar el tablero.' });
    }
    if (!data.periodoEvaluacionActivo) {
      pendientes.push({ text: 'No hay un periodo de evaluacion activo para calcular el resumen general.' });
    }
    if (totalSecciones > seccionesConPrediccion) {
      pendientes.push({
        text: `${totalSecciones - seccionesConPrediccion} secciones aun no cuentan con resumen predictivo disponible.`
      });
    }
    if (totalAlumnos > totalPredicciones) {
      pendientes.push({
        text: `${Math.max(totalAlumnos - totalPredicciones, 0)} alumnos aun no tienen ficha predictiva del corte actual.`
      });
    }
    if (totalCursosPeriodo === 0) {
      pendientes.push({ text: 'El periodo activo aun no muestra cursos configurados para operar en el dashboard.' });
    }
    if (pendientes.length === 0) {
      pendientes.push({ text: 'No hay pendientes criticos detectados con la informacion disponible actualmente.' });
    }

    this.pendientes.set(pendientes);
  }

  private resolverPeriodoActivo(periodos: PeriodoAcademico[]): PeriodoAcademico | null {
    const hoy = new Date();
    const porEstado = periodos.find((item) => (item.estado ?? '').toUpperCase() === 'ACTIVO');
    if (porEstado) {
      return porEstado;
    }

    const porFecha = periodos.find((item) => {
      const inicio = new Date(item.fechaInicio);
      const fin = new Date(item.fechaFin);
      return inicio <= hoy && hoy <= fin;
    });
    if (porFecha) {
      return porFecha;
    }

    return [...periodos].sort((a, b) => b.anio - a.anio)[0] ?? null;
  }

  private resolverPeriodoEvaluacionActivo(
    periodos: PeriodoEvaluacion[],
    periodoAcademicoId: number | null
  ): PeriodoEvaluacion | null {
    const hoy = new Date();
    const base = periodoAcademicoId
      ? periodos.filter((item) => item.periodoAcademicoId === periodoAcademicoId)
      : periodos;

    const porEstado = base.find((item) => (item.estado ?? '').toUpperCase() === 'ACTIVO');
    if (porEstado) {
      return porEstado;
    }

    const porFecha = base.find((item) => {
      const inicio = new Date(item.fechaInicio);
      const fin = new Date(item.fechaFin);
      return inicio <= hoy && hoy <= fin;
    });
    if (porFecha) {
      return porFecha;
    }

    return [...base].sort((a, b) => a.numero - b.numero)[0] ?? null;
  }
}
