import { Component, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Curso } from '../../models/curso';
import { CursoService } from '../../services/academico/curso.service';

@Component({
  selector: 'app-cursos',
  imports: [Shell],
  templateUrl: './cursos.html',
  styleUrl: './cursos.scss'
})
export class Cursos {
  private readonly cursoService = inject(CursoService);

  readonly cursos = signal<Curso[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  constructor() {
    this.cargarCursos();
  }

  cargarCursos(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.cursoService.listar().subscribe({
      next: (response) => {
        this.cursos.set(response);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los cursos registrados.');
        this.cargando.set(false);
      }
    });
  }
}
