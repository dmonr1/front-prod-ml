import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartCard } from '../../components/chart-card/chart-card';
import { RiskBadge } from '../../components/risk-badge/risk-badge';
import { Shell } from '../../layouts/shell/shell';
import { MockAnalyticsService } from '../../services/mock-analytics.service';

@Component({
  selector: 'app-perfil-alumno',
  imports: [Shell, RouterLink, ChartCard, RiskBadge],
  templateUrl: './perfil-alumno.html',
  styleUrl: './perfil-alumno.scss'
})
export class PerfilAlumno {
  readonly data = inject(MockAnalyticsService);
}
