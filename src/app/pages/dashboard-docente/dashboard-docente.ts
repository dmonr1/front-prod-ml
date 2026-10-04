import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Shell } from '../../layouts/shell/shell';
import { AuthService } from '../../services/auth/auth.service';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { AsignacionDocente } from '../../models/asignacion';
import { HorarioService } from '../../services/academico/horario.service';
import { DiaSemana, HorarioSemanal } from '../../models/horario';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import { Tutoria } from '../../models/tutoria';
import { AlertaAcademicaService } from '../../services/alerta/alerta-academica.service';
import { AlertaAcademica } from '../../models/alerta-academica';
import { PrediccionService, PrediccionRiesgo } from '../../services/prediccion/prediccion.service';

type KpiTone = 'blue' | 'violet' | 'sky' | 'mint' | 'amber' | 'rose';

interface DashboardKpi {
  label: string;
  value: string;
  icon: string;
  tone: KpiTone;
  detail: string;
}

@Component({
  selector: 'app-dashboard-docente',
  imports: [Shell, RouterLink, SlicePipe],
  templateUrl: './dashboard-docente.html',
  styleUrl: './dashboard-docente.scss'
})
export class DashboardDocente implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly asignacionService = inject(AsignacionAcademicaService);
  private readonly horarioService = inject(HorarioService);
  private readonly tutoriaService = inject(TutoriaService);
  private readonly alertaService = inject(AlertaAcademicaService);
  private readonly prediccionService = inject(PrediccionService);

  readonly kpis = signal<DashboardKpi[]>([]);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly horariosMios = signal<HorarioSemanal[]>([]);
  readonly clasesHoy = signal<HorarioSemanal[]>([]);
  readonly proximaClase = signal<HorarioSemanal | null>(null);
  readonly alertas = signal<AlertaAcademica[]>([]);
  readonly tutorias = signal<Tutoria[]>([]);
  readonly alumnosEnRiesgo = signal<PrediccionRiesgo[]>([]);
  readonly periodoActivoLabel = signal<string>('--');
  readonly periodoEvaluacionLabel = signal<string>('--');
  readonly nombreUsuario = signal<string>('Docente');
  readonly esTutor = signal<boolean>(false);
  readonly diaHoyNombre = signal<string>('Lunes');

  readonly accesos = [
    { label: 'Mis cursos y notas', path: '/mis-asignaciones', icon: 'fa-solid fa-book-bookmark' },
    { label: 'Control de asistencia', path: '/asistencias', icon: 'fa-solid fa-calendar-check' },
    { label: 'Mi horario semanal', path: '/mi-horario', icon: 'fa-regular fa-calendar-days' },
    { label: 'Mi sección tutorada', path: '/seccion-tutorada', icon: 'fa-solid fa-users-viewfinder' },
    { label: 'Predicción de riesgo', path: '/predicciones', icon: 'fa-solid fa-chart-line' },
    { label: 'Hallazgos y recomendaciones', path: '/hallazgos', icon: 'fa-solid fa-magnifying-glass-chart' }
  ] as const;

  ngOnInit(): void {
    const user = this.authService.obtenerUsuario();
    if (user) {
      this.nombreUsuario.set(user.username);
      this.esTutor.set(user.esTutor);
    }
    this.cargarDashboard();
  }

  private cargarDashboard(): void {
    const user = this.authService.obtenerUsuario();
    const docenteId = user?.docenteId ?? 0;

    forkJoin({
      periodosAcademicos: this.periodoAcademicoService.listar().pipe(catchError(() => of([]))),
      periodosEvaluacion: this.periodoEvaluacionService.listar().pipe(catchError(() => of([]))),
      alertas: this.alertaService.listar('PENDIENTE').pipe(catchError(() => of([])))
    })
      .pipe(
        switchMap((base) => {
          const periodoActivo = this.resolverPeriodoActivo(base.periodosAcademicos);
          const periodoEvaluacionActivo = this.resolverPeriodoEvaluacionActivo(
            base.periodosEvaluacion,
            periodoActivo?.id ?? null
          );

          if (!periodoActivo || !docenteId) {
            return of({
              ...base,
              periodoActivo,
              periodoEvaluacionActivo,
              asignaciones: [] as AsignacionDocente[],
              horarios: [] as HorarioSemanal[],
              tutorias: [] as Tutoria[],
              predicciones: [] as PrediccionRiesgo[]
            });
          }

          return forkJoin({
            asignaciones: this.asignacionService
              .listarAsignaciones(docenteId, periodoActivo.id)
              .pipe(catchError(() => of([]))),
            horarios: this.horarioService
              .listarMios(periodoActivo.id)
              .pipe(catchError(() => of([]))),
            tutorias: this.tutoriaService
              .listarPorDocente(docenteId, periodoActivo.id)
              .pipe(catchError(() => of([])))
          }).pipe(
            switchMap((extra) => {
              const seccionIds = Array.from(new Set(extra.asignaciones.map((a) => a.seccionId)));

              if (!periodoEvaluacionActivo || seccionIds.length === 0) {
                return of({
                  ...base,
                  periodoActivo,
                  periodoEvaluacionActivo,
                  ...extra,
                  predicciones: [] as PrediccionRiesgo[]
                });
              }

              // Consultar predicciones de las secciones a su cargo
              return forkJoin(
                seccionIds.map((seccionId) =>
                  this.prediccionService
                    .listarCursos(periodoEvaluacionActivo.id, seccionId)
                    .pipe(catchError(() => of([])))
                )
              ).pipe(
                map((resultados) => ({
                  ...base,
                  periodoActivo,
                  periodoEvaluacionActivo,
                  ...extra,
                  predicciones: resultados.flat()
                }))
              );
            })
          );
        })
      )
      .subscribe((data) => this.aplicarDashboard(data));
  }

  private aplicarDashboard(data: {
    periodoActivo: PeriodoAcademico | null;
    periodoEvaluacionActivo: PeriodoEvaluacion | null;
    alertas: AlertaAcademica[];
    asignaciones: AsignacionDocente[];
    horarios: HorarioSemanal[];
    tutorias: Tutoria[];
    predicciones: PrediccionRiesgo[];
  }): void {
    this.asignaciones.set(data.asignaciones);
    this.horariosMios.set(data.horarios);
    this.alertas.set(data.alertas);
    this.tutorias.set(data.tutorias);

    this.periodoActivoLabel.set(
      data.periodoActivo ? `${data.periodoActivo.nombre} ${data.periodoActivo.anio}` : 'Sin período'
    );
    this.periodoEvaluacionLabel.set(
      data.periodoEvaluacionActivo ? data.periodoEvaluacionActivo.nombre : 'Sin corte'
    );

    // Detección del día actual
    const diasSemanaMap: Record<number, { dia: DiaSemana; label: string }> = {
      1: { dia: 'LUNES', label: 'Lunes' },
      2: { dia: 'MARTES', label: 'Martes' },
      3: { dia: 'MIERCOLES', label: 'Miércoles' },
      4: { dia: 'JUEVES', label: 'Jueves' },
      5: { dia: 'VIERNES', label: 'Viernes' }
    };
    const diaIndex = new Date().getDay();
    const configDia = diasSemanaMap[diaIndex] ?? { dia: 'LUNES', label: 'Lunes' };
    this.diaHoyNombre.set(configDia.label);

    // Clases del día de hoy
    const clasesDeHoy = data.horarios
      .filter((h) => h.diaSemana === configDia.dia)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    this.clasesHoy.set(clasesDeHoy);

    // Próxima clase
    const ahoraMinutos = new Date().getHours() * 60 + new Date().getMinutes();
    const proxima =
      clasesDeHoy.find((c) => {
        const finMinutos =
          Number(c.horaFin.slice(0, 2)) * 60 + Number(c.horaFin.slice(3, 5));
        return finMinutos >= ahoraMinutos;
      }) ??
      clasesDeHoy[0] ??
      null;
    this.proximaClase.set(proxima);

    // Alumnos en riesgo en las secciones del docente
    const alumnosRiesgoMap = new Map<number, PrediccionRiesgo>();
    data.predicciones
      .filter((p) => p.nivelRiesgo === 'ALTO' || p.nivelRiesgo === 'MEDIO')
      .forEach((p) => {
        const actual = alumnosRiesgoMap.get(p.alumnoId);
        if (!actual || p.puntajeRiesgo > actual.puntajeRiesgo) {
          alumnosRiesgoMap.set(p.alumnoId, p);
        }
      });

    const listaRiesgo = Array.from(alumnosRiesgoMap.values()).sort(
      (a, b) => b.puntajeRiesgo - a.puntajeRiesgo
    );
    this.alumnosEnRiesgo.set(listaRiesgo.slice(0, 5));

    const totalRiesgoAlto = listaRiesgo.filter((p) => p.nivelRiesgo === 'ALTO').length;
    const asistenciasPendientes = data.alertas.filter(
      (a) => a.tipo === 'ASISTENCIA_PENDIENTE'
    ).length;
    const notasPendientes = data.alertas.filter(
      (a) => a.tipo === 'NOTAS_PENDIENTES'
    ).length;

    const seccionesUnicas = new Set(data.asignaciones.map((a) => a.seccionId)).size;

    this.kpis.set([
      {
        label: 'Mis cursos activos',
        value: `${data.asignaciones.length}`,
        icon: 'fa-solid fa-chalkboard-user',
        tone: 'blue',
        detail: `${seccionesUnicas} secciones a cargo`
      },
      {
        label: 'Próxima clase hoy',
        value: proxima ? proxima.horaInicio.slice(0, 5) : 'Completado',
        icon: 'fa-regular fa-calendar-check',
        tone: 'mint',
        detail: proxima ? `${proxima.curso} · ${proxima.seccion}` : 'Sin más clases hoy'
      },
      {
        label: 'Alumnos en riesgo alto',
        value: `${totalRiesgoAlto}`,
        icon: 'fa-solid fa-triangle-exclamation',
        tone: 'rose',
        detail: 'Requieren apoyo preventivo'
      },
      {
        label: 'Asistencias por registrar',
        value: `${asistenciasPendientes}`,
        icon: 'fa-solid fa-user-clock',
        tone: 'amber',
        detail: 'Sesiones con registro pendiente'
      },
      {
        label: 'Notas por calificar',
        value: `${notasPendientes}`,
        icon: 'fa-solid fa-pen-to-square',
        tone: 'violet',
        detail: 'Evaluaciones del corte activo'
      }
    ]);
  }

  private resolverPeriodoActivo(periodos: PeriodoAcademico[]): PeriodoAcademico | null {
    const hoy = new Date();
    const porEstado = periodos.find((item) => (item.estado ?? '').toUpperCase() === 'ACTIVO');
    if (porEstado) return porEstado;

    const porFecha = periodos.find((item) => {
      const inicio = new Date(item.fechaInicio);
      const fin = new Date(item.fechaFin);
      return inicio <= hoy && hoy <= fin;
    });
    if (porFecha) return porFecha;

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
    if (porEstado) return porEstado;

    const porFecha = base.find((item) => {
      const inicio = new Date(item.fechaInicio);
      const fin = new Date(item.fechaFin);
      return inicio <= hoy && hoy <= fin;
    });
    if (porFecha) return porFecha;

    return [...base].sort((a, b) => a.numero - b.numero)[0] ?? null;
  }
}
