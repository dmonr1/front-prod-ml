import { Component, inject } from '@angular/core';
import { AppHeader } from '../../components/app-header/app-header';
import { ChartCard } from '../../components/chart-card/chart-card';
import { KpiCard } from '../../components/kpi-card/kpi-card';
import { StudentTable } from '../../components/student-table/student-table';
import { Shell } from '../../layouts/shell/shell';
import { MockAnalyticsService } from '../../services/mock-analytics.service';

@Component({
  selector: 'app-dashboard-admin',
  imports: [Shell, AppHeader, KpiCard, ChartCard, StudentTable],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.scss'
})
export class DashboardAdmin {
  readonly data = inject(MockAnalyticsService);
}
