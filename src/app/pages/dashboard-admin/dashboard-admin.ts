import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';

@Component({
  selector: 'app-dashboard-admin',
  imports: [Shell, RouterLink],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.scss'
})
export class DashboardAdmin {}
