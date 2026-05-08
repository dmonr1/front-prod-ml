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
    path: 'periodos-academicos',
    loadComponent: () =>
      import('./pages/periodos-academicos/periodos-academicos').then(
        (m) => m.PeriodosAcademicos
      )
  },
  {
    path: 'bimestres',
    loadComponent: () => import('./pages/bimestres/bimestres').then((m) => m.Bimestres)
  },
  {
    path: 'estructura-academica',
    loadComponent: () =>
      import('./pages/estructura-academica/estructura-academica').then(
        (m) => m.EstructuraAcademica
      )
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
    path: 'asignaciones-tutorias',
    loadComponent: () =>
      import('./pages/asignaciones-tutorias/asignaciones-tutorias').then(
        (m) => m.AsignacionesTutorias
      )
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
    path: 'estudiantes',
    loadComponent: () => import('./pages/estudiantes/estudiantes').then((m) => m.Estudiantes)
  },
  {
    path: 'alumno',
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
    path: 'reportes',
    loadComponent: () => import('./pages/reportes/reportes').then((m) => m.Reportes)
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' }
];
