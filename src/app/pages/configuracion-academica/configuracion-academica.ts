import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';

interface ModuloMaestro {
  key: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  status: 'prioridad' | 'operativo' | 'pendiente';
  helper: string;
}

@Component({
  selector: 'app-configuracion-academica',
  imports: [Shell, RouterLink],
  templateUrl: './configuracion-academica.html',
  styleUrl: './configuracion-academica.scss'
})
export class ConfiguracionAcademica {
  readonly modulos: ModuloMaestro[] = [
    {
      key: 'gestion-estudiantil',
      title: 'Gestión estudiantil',
      description: 'Centraliza períodos, grados, secciones y registro de alumnos dentro de un solo flujo por período académico.',
      route: '/gestion-estudiantil',
      icon: 'fa-solid fa-user-graduate',
      status: 'prioridad',
      helper: 'Arranque'
    },
    {
      key: 'cursos',
      title: 'Cursos',
      description: 'Registra los cursos que luego se asignarán a docentes y secciones.',
      route: '/cursos',
      icon: 'fa-solid fa-book-open-reader',
      status: 'operativo',
      helper: 'Catálogo'
    },
    {
      key: 'docentes',
      title: 'Docentes y accesos',
      description: 'Relaciona usuarios, docentes y múltiples roles dentro del sistema.',
      route: '/docentes-accesos',
      icon: 'fa-solid fa-user-gear',
      status: 'operativo',
      helper: 'Accesos'
    },
    {
      key: 'asignaciones-docente',
      title: 'Asignaciones docentes',
      description: 'Une docentes, cursos, secciones, períodos y tutorías dentro de un mismo flujo operativo.',
      route: '/asignaciones-docente',
      icon: 'fa-solid fa-chalkboard-user',
      status: 'operativo',
      helper: 'Operativo'
    },
    {
      key: 'tutorias',
      title: 'Tutorías por sección',
      description: 'Relaciona cada sección con su docente tutor para el seguimiento global del aula.',
      route: '/asignaciones-docente',
      icon: 'fa-solid fa-people-roof',
      status: 'operativo',
      helper: 'Seguimiento'
    }
  ];
}
