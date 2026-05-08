import { Component } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';

interface BimestrePreview {
  nombre: string;
  numero: number;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
}

@Component({
  selector: 'app-bimestres',
  imports: [Shell],
  templateUrl: './bimestres.html',
  styleUrl: './bimestres.scss'
})
export class Bimestres {
  readonly registros: BimestrePreview[] = [
    {
      nombre: 'Bimestre I',
      numero: 1,
      periodo: 'Periodo Academico 2026',
      fechaInicio: '2026-03-10',
      fechaFin: '2026-05-20'
    }
  ];
}
