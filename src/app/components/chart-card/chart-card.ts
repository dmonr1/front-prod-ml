import { Component, input } from '@angular/core';
import { BarMetric } from '../../models/analytics.models';

@Component({
  selector: 'app-chart-card',
  templateUrl: './chart-card.html',
  styleUrl: './chart-card.scss'
})
export class ChartCard {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly type = input<'bar' | 'donut' | 'line'>('bar');
  readonly bars = input<BarMetric[]>([]);
  readonly series = input<number[]>([]);
  readonly barColor = input('#3b82f6');

  donut(): string[] {
    const [a = 63, b = 24, c = 13] = this.bars().map((item) => item.value);
    return [`${a}%`, `${a + b}%`, `${a + b + c}%`];
  }

  pointList(): string[] {
    const values = this.series().length ? this.series() : [35, 45, 38, 52, 44, 62];
    return values.map((value, index) => `${24 + index * 54},${142 - value * 1.2}`);
  }

  linePoints(): string {
    return this.pointList().join(' ');
  }
}
