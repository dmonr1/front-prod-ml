import { Component } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';

interface PeriodoPreview {
  nombre: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

@Component({
  selector: 'app-periodos-academicos',
  imports: [Shell],
  templateUrl: './periodos-academicos.html',
  styleUrl: './periodos-academicos.scss'
})
export class PeriodosAcademicos {
  readonly periodos: PeriodoPreview[] = [
    {
      nombre: 'Periodo Academico 2026',
      anio: 2026,
      fechaInicio: '2026-03-10',
      fechaFin: '2026-12-20',
      estado: 'Pendiente de integracion'
    }
  ];
}
