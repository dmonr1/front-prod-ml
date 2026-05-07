import { Component, inject } from '@angular/core';
import { AppHeader } from '../../components/app-header/app-header';
import { ChartCard } from '../../components/chart-card/chart-card';
import { KpiCard } from '../../components/kpi-card/kpi-card';
import { ReportFilter } from '../../components/report-filter/report-filter';
import { Shell } from '../../layouts/shell/shell';
import { MockAnalyticsService } from '../../services/mock-analytics.service';

@Component({
  selector: 'app-reportes',
  imports: [Shell, AppHeader, ReportFilter, KpiCard, ChartCard],
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss'
})
export class Reportes {
  readonly data = inject(MockAnalyticsService);
}
