import { Component, computed, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Grado } from '../../models/grado';
import { Seccion } from '../../models/seccion';
import { GradoPayload, GradoService } from '../../services/academico/grado.service';
import { SeccionPayload, SeccionService } from '../../services/academico/seccion.service';

@Component({
  selector: 'app-estructura-academica',
  imports: [Shell],
  templateUrl: './estructura-academica.html',
  styleUrl: './estructura-academica.scss'
})
export class EstructuraAcademica {
  private readonly gradoService = inject(GradoService);
  private readonly seccionService = inject(SeccionService);

  readonly grados = signal<Grado[]>([]);
  readonly cargandoGrados = signal(true);
  readonly errorGrados = signal<string | null>(null);

  readonly secciones = signal<Seccion[]>([]);
  readonly cargandoSecciones = signal(true);
  readonly errorSecciones = signal<string | null>(null);

  readonly nivelId = signal(1);
  readonly nombreGrado = signal('');
  readonly ordenGrado = signal('');
  readonly guardandoGrado = signal(false);
  readonly mensajeGrado = signal<string | null>(null);
  readonly errorGuardarGrado = signal<string | null>(null);

  readonly gradoSeleccionadoId = signal<number | null>(null);
  readonly seccionUnica = signal(false);
  readonly nombreSeccion = signal('');
  readonly capacidadSeccion = signal('');
  readonly guardandoSeccion = signal(false);
  readonly mensajeSeccion = signal<string | null>(null);
  readonly errorGuardarSeccion = signal<string | null>(null);

  readonly gradosFiltrados = computed(() => {
    const nivelId = this.nivelId();
    return this.grados().filter((grado) => grado.nivelId === nivelId);
  });

  readonly gradoSeleccionado = computed(() => {
    const id = this.gradoSeleccionadoId();
    return this.grados().find((grado) => grado.id === id) ?? null;
  });

  readonly seccionesDelGrado = computed(() => {
    const id = this.gradoSeleccionadoId();
    return this.secciones().filter((seccion) => seccion.gradoId === id);
  });

  constructor() {
    this.cargarGrados();
    this.cargarSecciones();
  }

  cargarGrados(): void {
    this.cargandoGrados.set(true);
    this.errorGrados.set(null);

    this.gradoService.listar().subscribe({
      next: (response) => {
        this.grados.set(response);
        this.cargandoGrados.set(false);

        const seleccionActual = this.gradoSeleccionadoId();
        if (seleccionActual && !response.some((grado) => grado.id === seleccionActual)) {
          this.gradoSeleccionadoId.set(null);
        }
      },
      error: () => {
        this.errorGrados.set('No se pudieron cargar los grados.');
        this.cargandoGrados.set(false);
      }
    });
  }

  cargarSecciones(): void {
    this.cargandoSecciones.set(true);
    this.errorSecciones.set(null);

    this.seccionService.listar().subscribe({
      next: (response) => {
        this.secciones.set(response);
        this.cargandoSecciones.set(false);
      },
      error: () => {
        this.errorSecciones.set('No se pudieron cargar las secciones.');
        this.cargandoSecciones.set(false);
      }
    });
  }

  seleccionarNivel(nivelId: number): void {
    this.nivelId.set(nivelId);
    this.gradoSeleccionadoId.set(null);
    this.mensajeGrado.set(null);
    this.errorGuardarGrado.set(null);
    this.errorGuardarSeccion.set(null);
    this.mensajeSeccion.set(null);
  }

  seleccionarGrado(gradoId: number): void {
    this.gradoSeleccionadoId.set(gradoId);
    this.errorGuardarSeccion.set(null);
    this.mensajeSeccion.set(null);
  }

  cambiarSeccionUnica(checked: boolean): void {
    this.seccionUnica.set(checked);
    if (checked) {
      this.nombreSeccion.set('UNICA');
    } else if (this.nombreSeccion() === 'UNICA') {
      this.nombreSeccion.set('');
    }
  }

  guardarGrado(): void {
    this.mensajeGrado.set(null);
    this.errorGuardarGrado.set(null);

    const nombre = this.nombreGrado().trim();
    const orden = Number(this.ordenGrado());

    if (!nombre) {
      this.errorGuardarGrado.set('Ingresa el nombre del grado.');
      return;
    }

    if (!Number.isInteger(orden) || orden < 1) {
      this.errorGuardarGrado.set('Ingresa un orden valido para el grado.');
      return;
    }

    const payload: GradoPayload = {
      nombre,
      orden,
      nivelId: this.nivelId()
    };

    this.guardandoGrado.set(true);

    this.gradoService.crear(payload).subscribe({
      next: (grado) => {
        this.guardandoGrado.set(false);
        this.nombreGrado.set('');
        this.ordenGrado.set('');
        this.mensajeGrado.set('Grado registrado correctamente.');
        this.grados.update((actual) => [...actual, grado]);
        this.gradoSeleccionadoId.set(grado.id);
      },
      error: (error) => {
        this.guardandoGrado.set(false);
        this.errorGuardarGrado.set(error?.error?.mensaje ?? 'No se pudo guardar el grado.');
      }
    });
  }

  guardarSeccion(): void {
    this.mensajeSeccion.set(null);
    this.errorGuardarSeccion.set(null);

    const gradoId = this.gradoSeleccionadoId();
    if (!gradoId) {
      this.errorGuardarSeccion.set('Selecciona un grado antes de registrar una seccion.');
      return;
    }

    const nombre = this.seccionUnica() ? 'UNICA' : this.nombreSeccion().trim().toUpperCase();
    const capacidadTexto = this.capacidadSeccion().trim();
    const capacidad = capacidadTexto ? Number(capacidadTexto) : null;

    if (!nombre) {
      this.errorGuardarSeccion.set('Ingresa el nombre de la seccion.');
      return;
    }

    if (capacidad !== null && (!Number.isInteger(capacidad) || capacidad < 1)) {
      this.errorGuardarSeccion.set('Ingresa una capacidad valida.');
      return;
    }

    const payload: SeccionPayload = {
      gradoId,
      nombre,
      capacidad
    };

    this.guardandoSeccion.set(true);

    this.seccionService.crear(payload).subscribe({
      next: (seccion) => {
        this.guardandoSeccion.set(false);
        this.nombreSeccion.set('');
        this.capacidadSeccion.set('');
        this.seccionUnica.set(false);
        this.mensajeSeccion.set('Seccion registrada correctamente.');
        this.secciones.update((actual) => [...actual, seccion]);
        this.grados.update((actual) =>
          actual.map((grado) =>
            grado.id === gradoId
              ? { ...grado, totalSecciones: grado.totalSecciones + 1 }
              : grado
          )
        );
      },
      error: (error) => {
        this.guardandoSeccion.set(false);
        this.errorGuardarSeccion.set(error?.error?.mensaje ?? 'No se pudo guardar la seccion.');
      }
    });
  }
}
