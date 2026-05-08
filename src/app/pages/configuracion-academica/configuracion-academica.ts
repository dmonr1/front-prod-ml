import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';

interface ModuloMaestro {
  key: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  status: 'prioridad' | 'pendiente';
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
      key: 'periodos',
      title: 'Periodos academicos',
      description: 'Define el anio escolar y las ventanas de trabajo principales del sistema.',
      route: '/periodos-academicos',
      icon: 'fa-solid fa-calendar-days',
      status: 'prioridad',
      helper: 'Primero'
    },
    {
      key: 'bimestres',
      title: 'Bimestres',
      description: 'Configura los bimestres vinculados a cada periodo academico.',
      route: '/bimestres',
      icon: 'fa-solid fa-table-cells-large',
      status: 'pendiente',
      helper: 'Dependiente'
    },
    {
      key: 'estructura',
      title: 'Niveles, grados y secciones',
      description: 'Estructura la organizacion academica del colegio antes de matricular estudiantes.',
      route: '/estructura-academica',
      icon: 'fa-solid fa-sitemap',
      status: 'pendiente',
      helper: 'Pendiente'
    },
    {
      key: 'cursos',
      title: 'Cursos',
      description: 'Registra los cursos que luego se asignaran a docentes y secciones.',
      route: '/cursos',
      icon: 'fa-solid fa-book-open-reader',
      status: 'pendiente',
      helper: 'Pendiente'
    },
    {
      key: 'docentes',
      title: 'Docentes y accesos',
      description: 'Relaciona usuarios, docentes y multiples roles dentro del sistema.',
      route: '/docentes-accesos',
      icon: 'fa-solid fa-user-gear',
      status: 'pendiente',
      helper: 'Pendiente'
    },
    {
      key: 'asignaciones',
      title: 'Asignaciones y tutorias',
      description: 'Une docentes, cursos, secciones y periodos para habilitar el flujo operativo.',
      route: '/asignaciones-tutorias',
      icon: 'fa-solid fa-chalkboard-user',
      status: 'pendiente',
      helper: 'Operativo'
    }
  ];
}
