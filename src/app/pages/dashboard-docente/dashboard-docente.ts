import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';

@Component({
  selector: 'app-dashboard-docente',
  imports: [Shell, RouterLink],
  templateUrl: './dashboard-docente.html',
  styleUrl: './dashboard-docente.scss'
})
export class DashboardDocente {}
