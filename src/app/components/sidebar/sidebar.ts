import { Component, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BrandMark } from '../brand-mark/brand-mark';

export interface SidebarItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, BrandMark],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  readonly collapsed = signal(localStorage.getItem('academic-analytics-sidebar') === 'collapsed');
  readonly role = input<'admin' | 'docente'>('admin');
  readonly items = input<SidebarItem[]>([
    { label: 'Dashboard', path: '/admin', icon: 'fa-solid fa-chart-pie' },
    { label: 'Estudiantes', path: '/estudiantes', icon: 'fa-solid fa-user-graduate' },
    { label: 'Docentes', path: '/docente', icon: 'fa-solid fa-chalkboard-user' },
    { label: 'Reportes', path: '/reportes', icon: 'fa-solid fa-file-lines' }
  ]);

  toggleCollapsed(): void {
    this.collapsed.update((value) => {
      const next = !value;
      localStorage.setItem('academic-analytics-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }
}
