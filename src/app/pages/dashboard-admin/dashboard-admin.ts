import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Shell } from '../../layouts/shell/shell';
import { AlumnoService } from '../../services/academico/alumno.service';
import { CursoPeriodoAcademicoService } from '../../services/academico/curso-periodo-academico.service';
import { CursoService } from '../../services/academico/curso.service';
import { DocenteService } from '../../services/academico/docente.service';
import { HorarioService } from '../../services/academico/horario.service';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { Seccion } from '../../models/seccion';
import { SeccionService } from '../../services/academico/seccion.service';
import { PrediccionService, ResumenPrediccion } from '../../services/prediccion/prediccion.service';
import { AuditoriaService, RegistroAuditoria, EstadisticasAuditoria } from '../../services/auditoria/auditoria.service';
import { MlAdminService, ComparativaModelos, PlanificadorReentrenamiento } from '../../services/ml/ml-admin.service';
import { AlertaAcademicaService } from '../../services/alerta/alerta-academica.service';

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

export interface DashboardMlStatus {
  algoritmoActivo: string;
  f1Score: number | null;
  precision: number | null;
  recall: number | null;
  totalModelos: number;
  proximoReentrenamiento: string;
  cadencia: string;
  estado: string;
}

export interface DashboardRiesgoDistribucion {
  alto: number;
  medio: number;
  bajo: number;
  total: number;
  porcentajeAlto: number;
  porcentajeMedio: number;
  porcentajeBajo: number;
}

@Component({
  selector: 'app-dashboard-admin',
  imports: [Shell, RouterLink, SlicePipe],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.scss'
})
export class DashboardAdmin implements OnInit {
  private readonly alumnoService = inject(AlumnoService);
  private readonly docenteService = inject(DocenteService);
  private readonly cursoService = inject(CursoService);
  private readonly cursoPeriodoAcademicoService = inject(CursoPeriodoAcademicoService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly seccionService = inject(SeccionService);
  private readonly prediccionService = inject(PrediccionService);
  private readonly horarioService = inject(HorarioService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly mlAdminService = inject(MlAdminService);
  private readonly alertaService = inject(AlertaAcademicaService);

  readonly kpis = signal<DashboardKpi[]>([]);
  readonly avances = signal<DashboardProgress[]>([]);
  readonly actividad = signal<DashboardActivity[]>([]);
  readonly pendientes = signal<DashboardPending[]>([]);
  readonly mlStatus = signal<DashboardMlStatus | null>(null);
  readonly riesgoDistribucion = signal<DashboardRiesgoDistribucion>({
    alto: 0,
    medio: 0,
    bajo: 0,
    total: 0,
    porcentajeAlto: 0,
    porcentajeMedio: 0,
    porcentajeBajo: 0
  });
  readonly auditoriaReciente = signal<RegistroAuditoria[]>([]);
  readonly auditoriaStats = signal<EstadisticasAuditoria | null>(null);
  readonly totalAlertasPendientes = signal<number>(0);
  readonly periodoActivoLabel = signal<string>('--');
  readonly periodoEvaluacionLabel = signal<string>('--');

  readonly accesos = [
    { label: 'Períodos y alumnos', path: '/gestion-estudiantil', icon: 'fa-solid fa-users-gear' },
    { label: 'Catálogo de cursos', path: '/cursos', icon: 'fa-solid fa-book-open-reader' },
    { label: 'Docentes y accesos', path: '/docentes-accesos', icon: 'fa-solid fa-id-card' },
    { label: 'Asignaciones docentes', path: '/asignaciones-docente', icon: 'fa-solid fa-chalkboard-user' },
    { label: 'Tutorías por sección', path: '/tutorias-seccion', icon: 'fa-solid fa-people-roof' },
    { label: 'Horarios y programación', path: '/horarios', icon: 'fa-regular fa-calendar-days' },
    { label: 'Predicción de riesgo', path: '/predicciones', icon: 'fa-solid fa-chart-line' },
    { label: 'Predictores y modelos ML', path: '/modelos-ml', icon: 'fa-solid fa-brain' },
    { label: 'Auditoría del sistema', path: '/auditoria', icon: 'fa-solid fa-shield-halved' }
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
      cursosBase: this.cursoService.listar().pipe(catchError(() => of([]))),
      auditoriaLogs: this.auditoriaService.listarLogs({ limite: 4 }).pipe(catchError(() => of([]))),
      auditoriaStats: this.auditoriaService.obtenerEstadisticas().pipe(catchError(() => of(null))),
      comparativaMl: this.mlAdminService.obtenerComparativaModelos().pipe(catchError(() => of(null))),
      planificadorMl: this.mlAdminService.obtenerPlanificadorReentrenamiento().pipe(catchError(() => of(null))),
      alertasCount: this.alertaService.contarPendientes().pipe(catchError(() => of(0)))
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
              horarios: [],
              resumenes: [] as Array<ResumenPrediccion | null>
            });
          }

          return forkJoin({
            secciones: this.seccionService.listar(periodoActivo.id).pipe(catchError(() => of([]))),
            cursosPeriodo: this.cursoPeriodoAcademicoService
              .listar(periodoActivo.id)
              .pipe(catchError(() => of([]))),
            horarios: this.horarioService.listar(periodoActivo.id).pipe(catchError(() => of([])))
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
    auditoriaLogs: RegistroAuditoria[];
    auditoriaStats: EstadisticasAuditoria | null;
    comparativaMl: ComparativaModelos | null;
    planificadorMl: PlanificadorReentrenamiento | null;
    alertasCount: number;
    periodoActivo: PeriodoAcademico | null;
    periodoEvaluacionActivo: PeriodoEvaluacion | null;
    secciones: Seccion[];
    cursosPeriodo: { id: number }[];
    horarios: Array<{ seccionId?: number }>;
    resumenes: Array<ResumenPrediccion | null>;
  }): void {
    const totalAlumnos = data.alumnos.length;
    const totalDocentes = data.docentes.length;
    const totalCursos = data.cursosBase.length;
    const totalSecciones = data.secciones.length;
    const totalCursosPeriodo = data.cursosPeriodo.length;

    const seccionesConHorario = new Set(
      data.horarios.map((h) => h.seccionId).filter((id): id is number => typeof id === 'number')
    );
    const coberturaHorarios =
      totalSecciones > 0 ? Math.round((seccionesConHorario.size / totalSecciones) * 100) : 0;

    const resumenesValidos = data.resumenes.filter((item): item is ResumenPrediccion => item !== null);
    const seccionesConPrediccion = resumenesValidos.filter((item) => item.totalPredicciones > 0).length;
    const totalPredicciones = resumenesValidos.reduce((acc, item) => acc + (item.totalPredicciones ?? 0), 0);
    const totalRiesgoAlto = resumenesValidos.reduce((acc, item) => acc + (item.totalRiesgoAlto ?? 0), 0);
    const totalRiesgoMedio = resumenesValidos.reduce((acc, item) => acc + (item.totalRiesgoMedio ?? 0), 0);
    const totalRiesgoBajo = resumenesValidos.reduce((acc, item) => acc + (item.totalRiesgoBajo ?? 0), 0);
    const totalEvaluadosRiesgo = totalRiesgoAlto + totalRiesgoMedio + totalRiesgoBajo;
    const promedioRiesgo =
      resumenesValidos.length > 0
        ? resumenesValidos.reduce((acc, item) => acc + Number(item.promedioPuntajeRiesgo ?? 0), 0) /
          resumenesValidos.length
        : 0;

    const porcentajeAlto = totalEvaluadosRiesgo > 0 ? Math.round((totalRiesgoAlto / totalEvaluadosRiesgo) * 100) : 0;
    const porcentajeMedio = totalEvaluadosRiesgo > 0 ? Math.round((totalRiesgoMedio / totalEvaluadosRiesgo) * 100) : 0;
    const porcentajeBajo = totalEvaluadosRiesgo > 0 ? Math.round((totalRiesgoBajo / totalEvaluadosRiesgo) * 100) : 0;

    this.riesgoDistribucion.set({
      alto: totalRiesgoAlto,
      medio: totalRiesgoMedio,
      bajo: totalRiesgoBajo,
      total: totalEvaluadosRiesgo,
      porcentajeAlto,
      porcentajeMedio,
      porcentajeBajo
    });

    const activeAlgo =
      data.comparativaMl?.algoritmos.find((a) => a.estado === 'ACTIVO') ??
      data.comparativaMl?.algoritmos[0] ??
      null;

    const f1ScoreVal = activeAlgo ? Math.round(activeAlgo.f1Score * 100) : null;
    const precisionVal = activeAlgo ? Math.round(activeAlgo.precision * 100) : null;
    const recallVal = activeAlgo ? Math.round(activeAlgo.recall * 100) : null;

    this.mlStatus.set({
      algoritmoActivo: activeAlgo?.nombre ?? 'Evaluación no disponible',
      f1Score: f1ScoreVal,
      precision: precisionVal,
      recall: recallVal,
      totalModelos: data.comparativaMl?.algoritmos.length ?? 0,
      proximoReentrenamiento: data.planificadorMl?.proximaEjecucionProgramada ?? 'No disponible',
      cadencia: data.planificadorMl?.cadencia ?? 'No disponible',
      estado: activeAlgo?.estado ?? 'NO_DISPONIBLE'
    });

    this.auditoriaReciente.set(data.auditoriaLogs.slice(0, 4));
    this.auditoriaStats.set(data.auditoriaStats);
    this.totalAlertasPendientes.set(data.alertasCount);
    this.periodoActivoLabel.set(data.periodoActivo ? `${data.periodoActivo.nombre} ${data.periodoActivo.anio}` : 'Sin período activo');
    this.periodoEvaluacionLabel.set(data.periodoEvaluacionActivo ? data.periodoEvaluacionActivo.nombre : 'Sin corte');

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

    const totalCriticosAuditoria = data.auditoriaStats?.totalCriticos ?? 0;
    const totalEventosAuditoria = data.auditoriaStats?.totalEventos ?? data.auditoriaLogs.length;

    this.kpis.set([
      {
        label: 'Alumnos registrados',
        value: `${totalAlumnos}`,
        icon: 'fa-solid fa-user-graduate',
        tone: 'sky',
        detail: 'Población estudiantil activa'
      },
      {
        label: 'Docentes activos',
        value: `${totalDocentes}`,
        icon: 'fa-solid fa-chalkboard-user',
        tone: 'blue',
        detail: 'Docentes registrados'
      },
      {
        label: 'Horarios de secciones',
        value: `${seccionesConHorario.size}/${totalSecciones}`,
        icon: 'fa-regular fa-calendar-days',
        tone: 'mint',
        detail: `${coberturaHorarios}% con horario programado`
      },
      {
        label: 'Alumnos en riesgo alto',
        value: `${totalRiesgoAlto}`,
        icon: 'fa-solid fa-triangle-exclamation',
        tone: 'rose',
        detail: `${porcentajeAlto}% de la muestra evaluada`
      },
      {
        label: 'Modelo ML en producción',
        value: `${f1ScoreVal}% F1`,
        icon: 'fa-solid fa-brain',
        tone: 'violet',
        detail: activeAlgo?.nombre ?? 'Random Forest Classifier'
      },
      {
        label: 'Eventos de auditoría',
        value: `${totalEventosAuditoria}`,
        icon: 'fa-solid fa-shield-halved',
        tone: 'amber',
        detail: `${totalCriticosAuditoria} eventos críticos registrados`
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
        label: 'Cursos configurados en el período',
        value: `${coberturaCursos}%`,
        width: `${coberturaCursos}%`
      },
      {
        label: 'Períodos de evaluación listos',
        value: `${coberturaPeriodos}%`,
        width: `${coberturaPeriodos}%`
      }
    ]);

    this.actividad.set([
      {
        time: data.periodoActivo?.fechaInicio?.slice(0, 10) ?? '--',
        title: 'Período académico detectado',
        detail: data.periodoActivo
          ? `${data.periodoActivo.nombre} ${data.periodoActivo.anio} se encuentra disponible en el dashboard.`
          : 'Aún no se detecta un período académico activo.',
        icon: 'fa-regular fa-calendar'
      },
      {
        time: data.periodoEvaluacionActivo?.fechaInicio?.slice(5, 10) ?? '--',
        title: 'Período de evaluación activo',
        detail: data.periodoEvaluacionActivo
          ? `${data.periodoEvaluacionActivo.nombre} es el corte usado para la vista general.`
          : 'No hay un período de evaluación activo para consolidar resúmenes.',
        icon: 'fa-regular fa-clock'
      },
      {
        time: `${seccionesConPrediccion}/${totalSecciones || 0}`,
        title: 'Cobertura de secciones',
        detail: 'Resume cuántas secciones ya tienen información suficiente para mostrar predicciones.',
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
      pendientes.push({ text: 'No se detecta un período académico activo para consolidar el tablero.' });
    }
    if (!data.periodoEvaluacionActivo) {
      pendientes.push({ text: 'No hay un período de evaluación activo para calcular el resumen general.' });
    }
    if (totalSecciones > seccionesConPrediccion) {
      pendientes.push({
        text: `${totalSecciones - seccionesConPrediccion} secciones aún no cuentan con resumen predictivo disponible.`
      });
    }
    if (totalAlumnos > totalPredicciones) {
      pendientes.push({
        text: `${Math.max(totalAlumnos - totalPredicciones, 0)} alumnos aún no tienen ficha predictiva del corte actual.`
      });
    }
    if (totalCursosPeriodo === 0) {
      pendientes.push({ text: 'El período activo aún no muestra cursos configurados para operar en el dashboard.' });
    }
    if (pendientes.length === 0) {
      pendientes.push({ text: 'No hay pendientes críticos detectados con la información disponible actualmente.' });
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
