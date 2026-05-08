import { Component, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Docente } from '../../models/docente';
import { DocenteService } from '../../services/academico/docente.service';

@Component({
  selector: 'app-docentes-accesos',
  imports: [Shell],
  templateUrl: './docentes-accesos.html',
  styleUrl: './docentes-accesos.scss'
})
export class DocentesAccesos {
  private readonly docenteService = inject(DocenteService);

  readonly docentes = signal<Docente[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  constructor() {
    this.cargarDocentes();
  }

  cargarDocentes(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.docenteService.listar().subscribe({
      next: (response) => {
        this.docentes.set(response);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los docentes registrados.');
        this.cargando.set(false);
      }
    });
  }
}
