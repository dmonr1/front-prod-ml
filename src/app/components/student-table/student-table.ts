import { Component, input } from '@angular/core';
import { StudentRisk } from '../../models/analytics.models';
import { RiskBadge } from '../risk-badge/risk-badge';

@Component({
  selector: 'app-student-table',
  imports: [RiskBadge],
  templateUrl: './student-table.html',
  styleUrl: './student-table.scss'
})
export class StudentTable {
  readonly title = input('Estudiantes en riesgo alto');
  readonly students = input.required<StudentRisk[]>();
}
