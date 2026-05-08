import { Component, computed, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';

type NivelRiesgo = 'ALTO' | 'MEDIO' | 'BAJO';
type VistaPrediccion = 'global' | 'curso';

interface FiltroOption {
  label: string;
  value: string;
}

interface PrediccionMock {
  id: number;
  alumno: string;
  codigo: string;
  seccion: string;
  bimestre: string;
  indiceRiesgo: number;
  nivel: NivelRiesgo;
  asistencia: number;
  promedioAcademico: number;
  cursosRiesgo: number;
  curso?: string;
  alerta: string;
  recomendacion: string;
  factores: string[];
  tendencia: 'Sube' | 'Estable' | 'Baja';
}

@Component({
  selector: 'app-predicciones',
  imports: [Shell],
  templateUrl: './predicciones.html',
  styleUrl: './predicciones.scss'
})
export class Predicciones {
  readonly vistaActiva = signal<VistaPrediccion>('global');
  readonly periodoSeleccionado = signal('2026');
  readonly bimestreSeleccionado = signal('II BIMESTRE');
  readonly seccionSeleccionada = signal('TODAS');
  readonly busqueda = signal('');
  readonly prediccionSeleccionadaId = signal<number>(101);

  readonly periodos: FiltroOption[] = [
    { label: '2026', value: '2026' },
    { label: '2025', value: '2025' }
  ];

  readonly bimestres: FiltroOption[] = [
    { label: 'I BIMESTRE', value: 'I BIMESTRE' },
    { label: 'II BIMESTRE', value: 'II BIMESTRE' },
    { label: 'III BIMESTRE', value: 'III BIMESTRE' },
    { label: 'IV BIMESTRE', value: 'IV BIMESTRE' }
  ];

  readonly secciones: FiltroOption[] = [
    { label: 'Todas', value: 'TODAS' },
    { label: '5TO A', value: '5TO A' },
    { label: '5TO B', value: '5TO B' },
    { label: '3RO A', value: '3RO A' }
  ];

  readonly prediccionesGlobales = signal<PrediccionMock[]>([
    {
      id: 101,
      alumno: 'Luis Ramirez Soto',
      codigo: 'AL-0051',
      seccion: '5TO A',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 87,
      nivel: 'ALTO',
      asistencia: 68,
      promedioAcademico: 10.9,
      cursosRiesgo: 4,
      alerta: 'Riesgo alto por baja asistencia y 4 cursos con rendimiento critico.',
      recomendacion: 'Coordinar entrevista con tutor y reforzamiento en Matematica y Comunicacion.',
      factores: ['Asistencia menor a 70%', 'Promedio general bajo', 'Multiples cursos desaprobados'],
      tendencia: 'Sube'
    },
    {
      id: 102,
      alumno: 'Maria Fernandez Rojas',
      codigo: 'AL-0058',
      seccion: '5TO A',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 64,
      nivel: 'MEDIO',
      asistencia: 81,
      promedioAcademico: 12.7,
      cursosRiesgo: 2,
      alerta: 'Rendimiento irregular en el bimestre y descenso en cursos clave.',
      recomendacion: 'Monitoreo quincenal y seguimiento del plan lector.',
      factores: ['Descenso frente al bimestre anterior', 'Dos cursos en observacion', 'Participacion inestable'],
      tendencia: 'Estable'
    },
    {
      id: 103,
      alumno: 'Jose Quispe Huaman',
      codigo: 'AL-0064',
      seccion: '5TO B',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 42,
      nivel: 'BAJO',
      asistencia: 91,
      promedioAcademico: 15.8,
      cursosRiesgo: 0,
      alerta: 'Sin alerta critica. Seguimiento ordinario.',
      recomendacion: 'Mantener acompanamiento y reconocer constancia.',
      factores: ['Asistencia estable', 'Promedio favorable', 'Sin cursos desaprobados'],
      tendencia: 'Baja'
    },
    {
      id: 104,
      alumno: 'Ana Lucero Vega',
      codigo: 'AL-0033',
      seccion: '3RO A',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 79,
      nivel: 'ALTO',
      asistencia: 73,
      promedioAcademico: 11.6,
      cursosRiesgo: 3,
      alerta: 'Comportamiento academico en deterioro sostenido.',
      recomendacion: 'Reunion con familia y plan de accion por curso.',
      factores: ['Tendencia descendente', 'Tres cursos en riesgo', 'Asistencia vulnerable'],
      tendencia: 'Sube'
    }
  ]);

  readonly prediccionesCurso = signal<PrediccionMock[]>([
    {
      id: 201,
      alumno: 'Luis Ramirez Soto',
      codigo: 'AL-0051',
      seccion: '5TO A',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 92,
      nivel: 'ALTO',
      asistencia: 68,
      promedioAcademico: 9.4,
      cursosRiesgo: 1,
      curso: 'MATEMATICA',
      alerta: 'Riesgo alto en Matematica por acumulacion de evaluaciones desaprobadas.',
      recomendacion: 'Refuerzo inmediato en aritmetica y razonamiento matematico.',
      factores: ['Promedio de curso menor a 10', 'Pocas evaluaciones aprobadas', 'Baja asistencia'],
      tendencia: 'Sube'
    },
    {
      id: 202,
      alumno: 'Maria Fernandez Rojas',
      codigo: 'AL-0058',
      seccion: '5TO A',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 71,
      nivel: 'MEDIO',
      asistencia: 81,
      promedioAcademico: 11.8,
      cursosRiesgo: 1,
      curso: 'COMUNICACION',
      alerta: 'Riesgo medio en Comunicacion por desempeno irregular.',
      recomendacion: 'Trabajar comprension lectora y revision de cuaderno.',
      factores: ['Variacion de notas', 'Plan lector inconsistente', 'Participacion media'],
      tendencia: 'Estable'
    },
    {
      id: 203,
      alumno: 'Jose Quispe Huaman',
      codigo: 'AL-0064',
      seccion: '5TO B',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 39,
      nivel: 'BAJO',
      asistencia: 91,
      promedioAcademico: 16.2,
      cursosRiesgo: 0,
      curso: 'INGLES',
      alerta: 'Sin alerta critica para el curso.',
      recomendacion: 'Continuar seguimiento regular.',
      factores: ['Buen promedio', 'Asistencia estable', 'Sin incidencias'],
      tendencia: 'Baja'
    },
    {
      id: 204,
      alumno: 'Ana Lucero Vega',
      codigo: 'AL-0033',
      seccion: '3RO A',
      bimestre: 'II BIMESTRE',
      indiceRiesgo: 84,
      nivel: 'ALTO',
      asistencia: 73,
      promedioAcademico: 10.7,
      cursosRiesgo: 1,
      curso: 'CIENCIA Y TECNOLOGIA',
      alerta: 'Riesgo alto por bajo promedio y tareas incompletas.',
      recomendacion: 'Plan de recuperacion y monitoreo semanal.',
      factores: ['Entregas incompletas', 'Promedio de curso bajo', 'Asistencia justa'],
      tendencia: 'Sube'
    }
  ]);

  readonly datasetActivo = computed(() =>
    this.vistaActiva() === 'global' ? this.prediccionesGlobales() : this.prediccionesCurso()
  );

  readonly prediccionesFiltradas = computed(() => {
    const query = this.busqueda().trim().toLowerCase();
    const seccion = this.seccionSeleccionada();
    const bimestre = this.bimestreSeleccionado();

    return this.datasetActivo().filter((item) => {
      const coincideSeccion = seccion === 'TODAS' || item.seccion === seccion;
      const coincideBimestre = item.bimestre === bimestre;
      const coincideBusqueda =
        !query ||
        [item.alumno, item.codigo, item.seccion, item.curso ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query);

      return coincideSeccion && coincideBimestre && coincideBusqueda;
    });
  });

  readonly prediccionSeleccionada = computed(
    () =>
      this.prediccionesFiltradas().find((item) => item.id === this.prediccionSeleccionadaId()) ??
      this.prediccionesFiltradas()[0] ??
      null
  );

  readonly resumen = computed(() => {
    const registros = this.prediccionesFiltradas();
    const total = registros.length;
    const alto = registros.filter((item) => item.nivel === 'ALTO').length;
    const medio = registros.filter((item) => item.nivel === 'MEDIO').length;
    const bajo = registros.filter((item) => item.nivel === 'BAJO').length;
    const promedio = total
      ? Math.round((registros.reduce((acc, item) => acc + item.indiceRiesgo, 0) / total) * 10) / 10
      : 0;

    return { total, alto, medio, bajo, promedio };
  });

  readonly distribucion = computed(() => {
    const { alto, medio, bajo, total } = this.resumen();
    const porcentaje = (valor: number) => (total ? Math.round((valor / total) * 100) : 0);

    return [
      { label: 'Riesgo alto', value: alto, percent: porcentaje(alto), tone: 'high' },
      { label: 'Riesgo medio', value: medio, percent: porcentaje(medio), tone: 'medium' },
      { label: 'Riesgo bajo', value: bajo, percent: porcentaje(bajo), tone: 'low' }
    ];
  });

  readonly tendencias = [
    { label: 'Asistencia baja', value: '31%', tone: 'high' },
    { label: 'Cursos criticos', value: '18 cursos', tone: 'medium' },
    { label: 'Alumnos estables', value: '42%', tone: 'low' }
  ];

  cambiarVista(vista: VistaPrediccion): void {
    this.vistaActiva.set(vista);
    const primerRegistro = (vista === 'global' ? this.prediccionesGlobales() : this.prediccionesCurso())[0];
    if (primerRegistro) {
      this.prediccionSeleccionadaId.set(primerRegistro.id);
    }
  }

  seleccionarPrediccion(id: number): void {
    this.prediccionSeleccionadaId.set(id);
  }
}
