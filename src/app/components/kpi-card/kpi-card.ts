import { Component, input } from '@angular/core';
import { Kpi } from '../../models/analytics.models';

@Component({
  selector: 'app-kpi-card',
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss'
})
export class KpiCard {
  readonly kpi = input.required<Kpi>();
  readonly iconGlyph: Record<string, string> = {
    users: 'fa-solid fa-users',
    alert: 'fa-solid fa-triangle-exclamation',
    clock: 'fa-solid fa-clock',
    trend: 'fa-solid fa-chart-line',
    shield: 'fa-solid fa-shield-halved',
    book: 'fa-solid fa-book-open'
  };
}
