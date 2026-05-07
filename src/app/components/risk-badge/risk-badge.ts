import { Component, input } from '@angular/core';
import { RiskLevel } from '../../models/analytics.models';

@Component({
  selector: 'app-risk-badge',
  templateUrl: './risk-badge.html',
  styleUrl: './risk-badge.scss'
})
export class RiskBadge {
  readonly risk = input.required<RiskLevel>();
}
