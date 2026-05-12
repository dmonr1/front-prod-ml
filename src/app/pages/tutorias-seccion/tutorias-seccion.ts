import { Component, computed, inject, signal } from '@angular/core';
import { Shell } from '../../layouts/shell/shell';
import { Docente } from '../../models/docente';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { Tutoria } from '../../models/tutoria';
import { DocenteService } from '../../services/academico/docente.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';

@Component({
  selector: 'app-tutorias-seccion',
  imports: [Shell],
  templateUrl: './tutorias-seccion.html',
  styleUrl: './tutorias-seccion.scss'
})
export class TutoriasSeccion {
  private readonly docenteService = inject(DocenteService);
  private readonly seccionService = inject(SeccionService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly tutoriaService = inject(TutoriaService);

  readonly docentes = signal<Docente[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly tutorias = signal<Tutoria[]>([]);

  readonly cargandoDocentes = signal(true);
  readonly cargandoSecciones = signal(true);
  readonly cargandoPeriodos = signal(true);
  readonly cargandoTutorias = signal(true);
  readonly guardando = signal(false);

  readonly errorDocentes = signal<string | null>(null);
  readonly errorSecciones = signal<string | null>(null);
  readonly errorPeriodos = signal<string | null>(null);
  readonly errorTutorias = signal<string | null>(null);
  readonly mensajeFormulario = signal<string | null>(null);
  readonly exitoFormulario = signal<string | null>(null);

  readonly docenteSeleccionado = signal<Docente | null>(null);
  readonly seccionSeleccionada = signal<Seccion | null>(null);
  readonly periodoSeleccionado = signal<PeriodoAcademico | null>(null);

  readonly docenteQuery = signal('');
  readonly seccionQuery = signal('');
  readonly periodoQuery = signal('');

  readonly dropdownActivo = signal(false);
  readonly modalDocenteAbierto = signal(false);
  readonly modalSeccionAbierto = signal(false);
  readonly modalPeriodoAbierto = signal(false);

  readonly modalBusquedaDocente = signal('');
  readonly modalBusquedaSeccion = signal('');
  readonly modalBusquedaPeriodo = signal('');
  readonly seccionNivelActivo = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');

  readonly docentesFiltrados = computed(() => {
    const query = this.docenteQuery().trim().toLowerCase();
    return this.docentes().filter((docente) => this.coincideDocente(docente, query)).slice(0, 6);
  });

  readonly docentesModalFiltrados = computed(() => {
    const query = this.modalBusquedaDocente().trim().toLowerCase();
    return this.docentes().filter((docente) => this.coincideDocente(docente, query));
  });

  readonly seccionesModalFiltradas = computed(() => {
    const nivel = this.seccionNivelActivo();
    const query = this.modalBusquedaSeccion().trim().toLowerCase();

    return this.secciones().filter((seccion) => {
      if (seccion.nivelNombre !== nivel) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        seccion.nombre,
        seccion.gradoNombre ?? '',
        seccion.nivelNombre ?? '',
        seccion.capacidad?.toString() ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  readonly periodosModalFiltrados = computed(() => {
    const query = this.modalBusquedaPeriodo().trim().toLowerCase();

    return this.periodos().filter((periodo) => {
      if (!query) {
        return true;
      }

      return [periodo.nombre, periodo.anio.toString()].join(' ').toLowerCase().includes(query);
    });
  });

  constructor() {
    this.cargarCatalogos();
  }

  cargarCatalogos(): void {
    this.cargarDocentes();
    this.cargarSecciones();
    this.cargarPeriodos();
  }

  cargarDocentes(): void {
    this.cargandoDocentes.set(true);
    this.errorDocentes.set(null);

    this.docenteService.listar().subscribe({
      next: (response) => {
        this.docentes.set(response);
        this.cargandoDocentes.set(false);
      },
      error: () => {
        this.errorDocentes.set('No se pudieron cargar los docentes.');
        this.cargandoDocentes.set(false);
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

  cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.errorPeriodos.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        this.periodos.set(response);
        this.cargandoPeriodos.set(false);

        if (!this.periodoSeleccionado() && response.length) {
          this.seleccionarPeriodo(response[0]);
          return;
        }

        this.cargarTutorias();
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
        this.cargandoTutorias.set(false);
      }
    });
  }

  cargarTutorias(): void {
    const periodo = this.periodoSeleccionado();

    if (!periodo) {
      this.tutorias.set([]);
      this.cargandoTutorias.set(false);
      return;
    }

    this.cargandoTutorias.set(true);
    this.errorTutorias.set(null);

    this.tutoriaService.listarPorPeriodo(periodo.id).subscribe({
      next: (response) => {
        this.tutorias.set(response);
        this.cargandoTutorias.set(false);
      },
      error: (error) => {
        this.errorTutorias.set(
          error?.error?.mensaje ?? 'No se pudieron cargar las tutorias del periodo.'
        );
        this.cargandoTutorias.set(false);
      }
    });
  }

  onDocenteInput(value: string): void {
    this.docenteQuery.set(value);
    this.docenteSeleccionado.set(null);
    this.dropdownActivo.set(true);
  }

  seleccionarDocente(docente: Docente): void {
    this.docenteSeleccionado.set(docente);
    this.docenteQuery.set(this.formatearDocente(docente));
    this.dropdownActivo.set(false);
    this.modalDocenteAbierto.set(false);
  }

  abrirModalDocente(): void {
    this.dropdownActivo.set(false);
    this.modalBusquedaDocente.set('');
    this.modalDocenteAbierto.set(true);
  }

  cerrarModalDocente(): void {
    this.modalDocenteAbierto.set(false);
  }

  abrirModalSeccion(): void {
    this.modalBusquedaSeccion.set('');
    this.modalSeccionAbierto.set(true);
  }

  cerrarModalSeccion(): void {
    this.modalSeccionAbierto.set(false);
  }

  seleccionarSeccion(seccion: Seccion): void {
    this.seccionSeleccionada.set(seccion);
    this.seccionQuery.set(`${seccion.gradoNombre ?? ''} - ${seccion.nombre}`.trim());
    this.modalSeccionAbierto.set(false);
  }

  abrirModalPeriodo(): void {
    this.modalBusquedaPeriodo.set('');
    this.modalPeriodoAbierto.set(true);
  }

  cerrarModalPeriodo(): void {
    this.modalPeriodoAbierto.set(false);
  }

  seleccionarPeriodo(periodo: PeriodoAcademico): void {
    this.periodoSeleccionado.set(periodo);
    this.periodoQuery.set(this.formatearPeriodo(periodo));
    this.modalPeriodoAbierto.set(false);
    this.cargarTutorias();
  }

  limpiarFormulario(): void {
    this.docenteSeleccionado.set(null);
    this.seccionSeleccionada.set(null);
    this.docenteQuery.set('');
    this.seccionQuery.set('');
    this.mensajeFormulario.set(null);
    this.exitoFormulario.set(null);
    this.dropdownActivo.set(false);
  }

  guardarTutoria(): void {
    const docente = this.docenteSeleccionado();
    const seccion = this.seccionSeleccionada();
    const periodo = this.periodoSeleccionado();

    this.mensajeFormulario.set(null);
    this.exitoFormulario.set(null);

    if (!docente || !seccion || !periodo) {
      this.mensajeFormulario.set(
        'Selecciona docente tutor, seccion y periodo antes de guardar la tutoria.'
      );
      return;
    }

    this.guardando.set(true);

    this.tutoriaService
      .crear({
        docenteId: docente.id,
        seccionId: seccion.id,
        periodoAcademicoId: periodo.id
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.limpiarFormulario();
          this.exitoFormulario.set('La tutoria se registro correctamente.');
          this.periodoQuery.set(this.formatearPeriodo(periodo));
          this.cargarTutorias();
        },
        error: (error) => {
          this.guardando.set(false);
          this.mensajeFormulario.set(error?.error?.mensaje ?? 'No se pudo registrar la tutoria.');
        }
      });
  }

  formatearDocente(docente: Docente): string {
    return `${docente.apellidos}, ${docente.nombres}`;
  }

  formatearPeriodo(periodo: PeriodoAcademico): string {
    return `${periodo.nombre} (${periodo.anio})`;
  }

  private coincideDocente(docente: Docente, query: string): boolean {
    if (!query) {
      return true;
    }

    return [
      docente.nombres,
      docente.apellidos,
      docente.dni ?? '',
      docente.especialidad ?? '',
      docente.username ?? ''
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
