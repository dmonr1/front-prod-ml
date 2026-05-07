import { Component, input } from '@angular/core';
import { Sidebar, SidebarItem } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-shell',
  imports: [Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  readonly items = input<SidebarItem[]>([
    { label: 'Dashboard', path: '/admin', icon: 'fa-solid fa-chart-pie' },
    { label: 'Estudiantes', path: '/estudiantes', icon: 'fa-solid fa-user-graduate' },
    { label: 'Docentes', path: '/docente', icon: 'fa-solid fa-chalkboard-user' },
    { label: 'Reportes', path: '/reportes', icon: 'fa-solid fa-file-lines' }
  ]);
}
