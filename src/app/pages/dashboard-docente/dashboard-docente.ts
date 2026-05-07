import { Component, inject } from '@angular/core';
import { AppHeader } from '../../components/app-header/app-header';
import { ChartCard } from '../../components/chart-card/chart-card';
import { KpiCard } from '../../components/kpi-card/kpi-card';
import { StudentTable } from '../../components/student-table/student-table';
import { Shell } from '../../layouts/shell/shell';
import { MockAnalyticsService } from '../../services/mock-analytics.service';

@Component({
  selector: 'app-dashboard-docente',
  imports: [Shell, AppHeader, KpiCard, ChartCard, StudentTable],
  templateUrl: './dashboard-docente.html',
  styleUrl: './dashboard-docente.scss'
})
export class DashboardDocente {
  readonly data = inject(MockAnalyticsService);
}
