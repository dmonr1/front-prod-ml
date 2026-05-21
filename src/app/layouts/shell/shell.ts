import { Component, computed, inject, input } from '@angular/core';
import { Sidebar, SidebarItem } from '../../components/sidebar/sidebar';
import { AuthService } from '../../services/auth/auth.service';
import { UsuarioSesion } from '../../models/auth';

@Component({
  selector: 'app-shell',
  imports: [Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  private readonly authService = inject(AuthService);

  readonly items = input<SidebarItem[]>([]);
  readonly usuario = computed(() => this.authService.obtenerUsuario());
  readonly menuItems = computed(() => {
    const customItems = this.items();
    if (customItems.length) {
      return customItems;
    }

    return this.construirMenu(this.usuario());
  });
  readonly nombreUsuario = computed(() => this.usuario()?.username ?? 'Usuario del sistema');
  readonly rolUsuario = computed(() => this.obtenerEtiquetaRol(this.usuario()));

  private construirMenu(usuario: UsuarioSesion | null): SidebarItem[] {
    const roles = usuario?.roles ?? [];
    const esAdmin = roles.includes('ADMIN');
    const esDocente = roles.includes('DOCENTE');
    const esTutor = roles.includes('DOCENTE_TUTOR') || usuario?.esTutor;
    const dashboardPath = esAdmin ? '/admin' : '/docente';

    const items: SidebarItem[] = [
      { id: 'inicio', label: 'Dashboard', path: dashboardPath, icon: 'fa-solid fa-house' }
    ];

    if (esAdmin) {
      items.push({
        id: 'configuracion-academica',
        label: 'Configuracion academica',
        icon: 'fa-solid fa-sliders',
        children: [
          { label: 'Gestion estudiantil', path: '/gestion-estudiantil', icon: 'fa-solid fa-user-graduate' },
          { label: 'Cursos', path: '/cursos', icon: 'fa-solid fa-book-open-reader' },
          { label: 'Docentes y accesos', path: '/docentes-accesos', icon: 'fa-solid fa-user-gear' },
          { label: 'Asignaciones docentes', path: '/asignaciones-docente', icon: 'fa-solid fa-chalkboard-user' }
        ]
      });
    }

    if (esDocente || esAdmin) {
      items.push({
        id: 'academico',
        label: 'Gestion academica',
        icon: 'fa-solid fa-graduation-cap',
        children: [
          { label: 'Mis asignaciones', path: '/mis-asignaciones', icon: 'fa-solid fa-chalkboard-user' },
          { label: 'Asistencias', path: '/asistencias', icon: 'fa-solid fa-user-check' }
        ]
      });
    }

    if (esTutor || esAdmin) {
      items.push({
        id: 'seguimiento',
        label: 'Seguimiento',
        icon: 'fa-solid fa-shield-heart',
        children: [
          {
            label: 'Seccion tutorada',
            path: '/seccion-tutorada',
            icon: 'fa-solid fa-users',
            activePaths: ['/mis-asignaciones/tutorias']
          },
          {
            label: 'Perfil del alumno',
            path: '/alumno',
            icon: 'fa-solid fa-address-card',
            activePaths: ['/alumno']
          },
          {
            label: 'Seguimiento de riesgo',
            path: '/predicciones',
            icon: 'fa-solid fa-wave-square'
          },
          {
            label: 'Hallazgos y recomendaciones',
            path: '/hallazgos',
            icon: 'fa-solid fa-lightbulb'
          }
        ]
      });
    }

    return items;
  }

  private obtenerEtiquetaRol(usuario: UsuarioSesion | null): string {
    if (!usuario?.roles?.length) {
      return 'Acceso institucional';
    }

    const etiquetas: string[] = [];

    if (usuario.roles.includes('ADMIN')) {
      etiquetas.push('Administrador');
    }
    if (usuario.roles.includes('DOCENTE')) {
      etiquetas.push('Docente');
    }
    if (usuario.roles.includes('DOCENTE_TUTOR') || usuario.esTutor) {
      etiquetas.push('Tutor');
    }

    return etiquetas.join(' / ');
  }
}
