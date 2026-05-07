import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppHeader } from '../../components/app-header/app-header';
import { RiskBadge } from '../../components/risk-badge/risk-badge';
import { Shell } from '../../layouts/shell/shell';
import { MockAnalyticsService } from '../../services/mock-analytics.service';

@Component({
  selector: 'app-estudiantes',
  imports: [Shell, AppHeader, RouterLink, RiskBadge],
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss'
})
export class Estudiantes {
  readonly data = inject(MockAnalyticsService);
}
