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
    path: 'docente',
    loadComponent: () => import('./pages/dashboard-docente/dashboard-docente').then((m) => m.DashboardDocente)
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
    path: 'reportes',
    loadComponent: () => import('./pages/reportes/reportes').then((m) => m.Reportes)
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' }
];
