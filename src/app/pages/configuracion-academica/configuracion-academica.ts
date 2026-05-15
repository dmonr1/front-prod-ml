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
      title: 'Gestion estudiantil',
      description: 'Centraliza periodos, grados, secciones y registro de alumnos dentro de un solo flujo por periodo academico.',
      route: '/gestion-estudiantil',
      icon: 'fa-solid fa-user-graduate',
      status: 'prioridad',
      helper: 'Arranque'
    },
    {
      key: 'cursos',
      title: 'Cursos',
      description: 'Registra los cursos que luego se asignaran a docentes y secciones.',
      route: '/cursos',
      icon: 'fa-solid fa-book-open-reader',
      status: 'operativo',
      helper: 'Catalogo'
    },
    {
      key: 'docentes',
      title: 'Docentes y accesos',
      description: 'Relaciona usuarios, docentes y multiples roles dentro del sistema.',
      route: '/docentes-accesos',
      icon: 'fa-solid fa-user-gear',
      status: 'operativo',
      helper: 'Accesos'
    },
    {
      key: 'asignaciones-docente',
      title: 'Asignaciones docentes',
      description: 'Une docentes, cursos, secciones, periodos y tutorias dentro de un mismo flujo operativo.',
      route: '/asignaciones-docente',
      icon: 'fa-solid fa-chalkboard-user',
      status: 'operativo',
      helper: 'Operativo'
    },
    {
      key: 'tutorias',
      title: 'Tutorias por seccion',
      description: 'Relaciona cada seccion con su docente tutor para el seguimiento global del aula.',
      route: '/asignaciones-docente',
      icon: 'fa-solid fa-people-roof',
      status: 'operativo',
      helper: 'Seguimiento'
    }
  ];
}
