import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login').then((m) => m.Login)
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/dashboard-admin/dashboard-admin').then((m) => m.DashboardAdmin)
  },
  {
    path: 'configuracion-academica',
    loadComponent: () =>
      import('./pages/configuracion-academica/configuracion-academica').then(
        (m) => m.ConfiguracionAcademica
      )
  },
  {
    path: 'gestion-estudiantil/periodo/:periodoId/evaluaciones-cursos',
    loadComponent: () =>
      import('./pages/evaluaciones-curso-periodo/evaluaciones-curso-periodo').then(
        (m) => m.EvaluacionesCursoPeriodo
      )
  },
  {
    path: 'gestion-estudiantil/periodo/:periodoId/seccion/:seccionId',
    loadComponent: () =>
      import('./pages/alumnos-seccion/alumnos-seccion').then((m) => m.AlumnosSeccion)
  },
  {
    path: 'gestion-estudiantil/periodo/:periodoId',
    loadComponent: () =>
      import('./pages/alumnos-periodo/alumnos-periodo').then((m) => m.AlumnosPeriodo)
  },
  {
    path: 'gestion-estudiantil',
    loadComponent: () => import('./pages/alumnos/alumnos').then((m) => m.Alumnos)
  },
  {
    path: 'alumnos/periodo/:periodoId/seccion/:seccionId',
    redirectTo: 'gestion-estudiantil/periodo/:periodoId/seccion/:seccionId',
    pathMatch: 'full'
  },
  {
    path: 'alumnos/periodo/:periodoId',
    redirectTo: 'gestion-estudiantil/periodo/:periodoId',
    pathMatch: 'full'
  },
  {
    path: 'alumnos',
    redirectTo: 'gestion-estudiantil',
    pathMatch: 'full'
  },
  {
    path: 'periodos-academicos',
    redirectTo: 'gestion-estudiantil',
    pathMatch: 'full'
  },
  {
    path: 'periodos-evaluacion',
    redirectTo: 'gestion-estudiantil',
    pathMatch: 'full'
  },
  {
    path: 'estructura-academica',
    redirectTo: 'configuracion-academica',
    pathMatch: 'full'
  },
  {
    path: 'cursos',
    loadComponent: () => import('./pages/cursos/cursos').then((m) => m.Cursos)
  },
  {
    path: 'docentes-accesos',
    loadComponent: () =>
      import('./pages/docentes-accesos/docentes-accesos').then((m) => m.DocentesAccesos)
  },
  {
    path: 'asignaciones-docente',
    loadComponent: () =>
      import('./pages/asignaciones-docente/asignaciones-docente').then(
        (m) => m.AsignacionesTutorias
      )
  },
  {
    path: 'tutorias-seccion',
    redirectTo: 'asignaciones-tutorias',
    pathMatch: 'full'
  },
  {
    path: 'asignaciones-tutorias',
    redirectTo: 'asignaciones-docente',
    pathMatch: 'full'
  },
  {
    path: 'matriculas-periodo',
    redirectTo: 'alumnos',
    pathMatch: 'full'
  },
  {
    path: 'docente',
    loadComponent: () => import('./pages/dashboard-docente/dashboard-docente').then((m) => m.DashboardDocente)
  },
  {
    path: 'mis-asignaciones',
    loadComponent: () => import('./pages/mis-asignaciones/mis-asignaciones').then((m) => m.MisAsignaciones)
  },
  {
    path: 'mis-asignaciones/:asignacionId/notas',
    loadComponent: () => import('./pages/carga-notas/carga-notas').then((m) => m.CargaNotas)
  },
  {
    path: 'mis-asignaciones/:asignacionId/asistencias',
    loadComponent: () =>
      import('./pages/carga-asistencias/carga-asistencias').then((m) => m.CargaAsistencias)
  },
  {
    path: 'asistencias',
    loadComponent: () =>
      import('./pages/carga-asistencias/carga-asistencias').then((m) => m.CargaAsistencias)
  },
  {
    path: 'mis-asignaciones/tutorias/:tutoriaId',
    loadComponent: () =>
      import('./pages/seccion-tutorada/seccion-tutorada').then((m) => m.SeccionTutorada)
  },
  {
    path: 'seccion-tutorada',
    loadComponent: () =>
      import('./pages/seccion-tutorada/seccion-tutorada').then((m) => m.SeccionTutorada)
  },
  {
    path: 'alumno',
    loadComponent: () => import('./pages/perfil-alumno/perfil-alumno').then((m) => m.PerfilAlumno)
  },
  {
    path: 'alumno/:alumnoId',
    loadComponent: () => import('./pages/perfil-alumno/perfil-alumno').then((m) => m.PerfilAlumno)
  },
  {
    path: 'usuario',
    loadComponent: () => import('./pages/usuario/usuario').then((m) => m.Usuario)
  },
  {
    path: 'predicciones',
    loadComponent: () => import('./pages/predicciones/predicciones').then((m) => m.Predicciones)
  },
  {
    path: 'hallazgos',
    loadComponent: () => import('./pages/hallazgos-recomendaciones/hallazgos-recomendaciones').then((m) => m.HallazgosRecomendaciones)
  },
  {
    path: 'reportes',
    redirectTo: 'hallazgos',
    pathMatch: 'full'
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' }
];
