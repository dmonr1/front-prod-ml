import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { Curso } from '../../models/curso';
import { AuthService } from '../../services/auth/auth.service';
import { CursoPayload, CursoService } from '../../services/academico/curso.service';

type NivelTab = 1 | 2;

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
}

type AlertAction = 'none' | 'retry-load';

interface IconoPortada {
  valor: string;
  etiqueta: string;
}

interface ImagenPortada {
  ruta: string;
  etiqueta: string;
}

@Component({
  selector: 'app-cursos',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './cursos.html',
  styleUrl: './cursos.scss'
})
export class Cursos {
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);

  readonly cursos = signal<Curso[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly actualizandoEstadoCursoId = signal<number | null>(null);
  readonly nivelTab = signal<NivelTab>(1);
  readonly animacionNivel = signal<'left' | 'right' | null>(null);
  readonly mostrarModalRegistro = signal(false);
  readonly cerrandoModalRegistro = signal(false);
  readonly mostrarModalIconos = signal(false);
  readonly cerrandoModalIconos = signal(false);
  readonly mostrarModalImagenes = signal(false);
  readonly cerrandoModalImagenes = signal(false);
  readonly formNombre = signal('');
  readonly formDescripcion = signal('');
  readonly formNivelId = signal(1);
  readonly formPortadaColor = signal('#ff9742');
  readonly formPortadaIcono = signal('fa-solid fa-calculator');
  readonly formPortadaImagen = signal<string | null>(null);
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
  readonly iconosPortada: IconoPortada[] = [
    { valor: 'fa-solid fa-calculator', etiqueta: 'Calculo' },
    { valor: 'fa-solid fa-book-open', etiqueta: 'Lectura' },
    { valor: 'fa-solid fa-flask', etiqueta: 'Ciencia' },
    { valor: 'fa-solid fa-seedling', etiqueta: 'Naturaleza' },
    { valor: 'fa-solid fa-palette', etiqueta: 'Arte' },
    { valor: 'fa-solid fa-globe', etiqueta: 'Social' },
    { valor: 'fa-solid fa-music', etiqueta: 'Musica' },
    { valor: 'fa-solid fa-language', etiqueta: 'Idioma' },
    { valor: 'fa-solid fa-laptop-code', etiqueta: 'Tecnologia' },
    { valor: 'fa-solid fa-dumbbell', etiqueta: 'Deporte' },
    { valor: 'fa-solid fa-landmark', etiqueta: 'Historia' },
    { valor: 'fa-solid fa-shapes', etiqueta: 'Geometria' }
  ];
  readonly imagenesPortada: ImagenPortada[] = [
    { ruta: 'assets/course-covers/cover-numbers.svg', etiqueta: 'Numeros' },
    { ruta: 'assets/course-covers/cover-reading.svg', etiqueta: 'Lectura' },
    { ruta: 'assets/course-covers/cover-science.svg', etiqueta: 'Ciencia' },
    { ruta: 'assets/course-covers/cover-nature.svg', etiqueta: 'Naturaleza' },
    { ruta: 'assets/course-covers/cover-art.svg', etiqueta: 'Arte' },
    { ruta: 'assets/course-covers/cover-geography.svg', etiqueta: 'Geografia' }
  ];
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });
  readonly cursoPendienteEstado = signal<{ id: number; activo: boolean } | null>(null);
  private pendingAlertAction: AlertAction = 'none';

  readonly esAdmin = computed(() => this.authService.obtenerUsuario()?.roles?.includes('ADMIN') ?? false);

  readonly cursosFiltrados = computed(() => {
    const nivel = this.nivelTab();

    return this.cursos()
      .filter((curso) => curso.nivelId === nivel)
      .sort(
        (a, b) =>
          a.nombre.localeCompare(b.nombre) ||
          a.nivelNombre.localeCompare(b.nivelNombre)
      );
  });

  readonly totalActivos = computed(
    () => this.cursos().filter((curso) => (curso.estado ?? 'ACTIVO') === 'ACTIVO').length
  );
  readonly totalPrimaria = computed(
    () => this.cursos().filter((curso) => curso.nivelId === 1).length
  );
  readonly totalSecundaria = computed(
    () => this.cursos().filter((curso) => curso.nivelId === 2).length
  );
  readonly nivelActualTitulo = computed(() => {
    switch (this.nivelTab()) {
      case 1:
        return 'Primaria';
      case 2:
        return 'Secundaria';
    }
  });

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
        this.pendingAlertAction = 'retry-load';
        this.mostrarAlerta(
          'error',
          'No se puede conectar con el servidor',
          'No se pudieron cargar los cursos registrados. Vuelve a intentarlo en unos segundos.',
          { confirmText: 'Reintentar', cancelText: 'Cerrar' }
        );
      }
    });
  }

  seleccionarNivel(tab: NivelTab): void {
    this.nivelTab.set(tab);
  }

  avanzarNivel(direccion: -1 | 1): void {
    const niveles: NivelTab[] = [1, 2];
    const actual = niveles.indexOf(this.nivelTab());
    const siguiente = actual + direccion;
    if (siguiente < 0 || siguiente >= niveles.length) {
      return;
    }
    this.animacionNivel.set(direccion === 1 ? 'right' : 'left');
    this.nivelTab.set(niveles[siguiente]);
    setTimeout(() => this.animacionNivel.set(null), 240);
  }

  puedeRetrocederNivel(): boolean {
    return this.nivelTab() !== 1;
  }

  puedeAvanzarNivel(): boolean {
    return this.nivelTab() !== 2;
  }

  abrirModalRegistro(): void {
    this.cerrandoModalRegistro.set(false);
    this.mostrarModalRegistro.set(true);
  }

  cerrarModalRegistro(): void {
    if (this.guardando()) {
      return;
    }
    this.cerrandoModalRegistro.set(true);
    setTimeout(() => {
      this.mostrarModalRegistro.set(false);
      this.cerrandoModalRegistro.set(false);
    }, 220);
  }

  abrirModalIconos(): void {
    this.cerrandoModalIconos.set(false);
    this.mostrarModalIconos.set(true);
  }

  cerrarModalIconos(): void {
    this.cerrandoModalIconos.set(true);
    setTimeout(() => {
      this.mostrarModalIconos.set(false);
      this.cerrandoModalIconos.set(false);
    }, 180);
  }

  abrirModalImagenes(): void {
    this.cerrandoModalImagenes.set(false);
    this.mostrarModalImagenes.set(true);
  }

  cerrarModalImagenes(): void {
    this.cerrandoModalImagenes.set(true);
    setTimeout(() => {
      this.mostrarModalImagenes.set(false);
      this.cerrandoModalImagenes.set(false);
    }, 180);
  }

  limpiarFormulario(): void {
    this.formNombre.set('');
    this.formDescripcion.set('');
    this.formNivelId.set(1);
    this.formPortadaColor.set('#ff9742');
    this.formPortadaIcono.set('fa-solid fa-calculator');
    this.formPortadaImagen.set(null);
  }

  seleccionarIconoPortada(icono: string): void {
    this.formPortadaIcono.set(icono);
    this.cerrarModalIconos();
  }

  seleccionarImagenPortada(ruta: string): void {
    this.formPortadaImagen.set(ruta);
    this.cerrarModalImagenes();
  }

  guardarCurso(): void {
    if (!this.esAdmin()) {
      this.mostrarAlerta(
        'warning',
        'Sin permisos',
        'Solo un administrador puede registrar cursos.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    const nombre = this.formNombre().trim();
    const descripcion = this.formDescripcion().trim();

    if (!nombre) {
      this.mostrarAlerta(
        'warning',
        'Falta el nombre',
        'Ingresa el nombre del curso.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    const payload: CursoPayload = {
      nombre,
      descripcion: descripcion || null,
      portadaColor: this.formPortadaColor(),
      portadaIcono: this.formPortadaIcono(),
      portadaImagen: this.formPortadaImagen(),
      nivelId: Number(this.formNivelId())
    };

    this.guardando.set(true);

    this.cursoService.crear(payload).subscribe({
      next: (curso) => {
        this.guardando.set(false);
        this.cursos.update((actual) => [...actual, curso]);
        this.limpiarFormulario();
        this.cerrarModalRegistro();
        this.mostrarAlerta(
          'success',
          'Curso registrado',
          'El curso se registro correctamente.',
          { confirmText: null, autoCloseMs: 2800 }
        );
      },
      error: (error) => {
        this.guardando.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudo guardar',
          error?.status === 403
            ? 'Tu usuario no tiene permisos para registrar cursos.'
            : error?.error?.mensaje ?? 'No se pudo registrar el curso.'
        );
      }
    });
  }

  toggleEstadoCurso(curso: Curso): void {
    if (!this.esAdmin()) {
      this.mostrarAlerta(
        'warning',
        'Sin permisos',
        'Solo un administrador puede cambiar el estado de un curso.',
        { confirmText: null, autoCloseMs: 2800 }
      );
      return;
    }

    const activo = (curso.estado ?? 'ACTIVO') === 'ACTIVO';
    if (activo) {
      this.cursoPendienteEstado.set({ id: curso.id, activo: false });
      this.mostrarAlerta(
        'warning',
        'Deshabilitar curso',
        'Esta seguro que quiere deshabilitar este curso?',
        { confirmText: 'Deshabilitar', cancelText: 'Cancelar' }
      );
      return;
    }

    this.actualizarEstadoCurso(curso.id, true);
  }

  cerrarAlerta(): void {
    const cursoPendiente = this.cursoPendienteEstado();
    if (cursoPendiente) {
      this.cursoPendienteEstado.set(null);
      this.pendingAlertAction = 'none';
      this.resetAlertState();
      this.actualizarEstadoCurso(cursoPendiente.id, cursoPendiente.activo);
      return;
    }

    const accion = this.pendingAlertAction;
    this.pendingAlertAction = 'none';
    this.resetAlertState();

    if (accion === 'retry-load') {
      this.cargarCursos();
    }
  }

  descartarAlerta(): void {
    this.pendingAlertAction = 'none';
    this.cursoPendienteEstado.set(null);
    this.resetAlertState();
  }

  private mostrarAlerta(
    type: CustomAlertType,
    title: string,
    message: string,
    options?: {
      confirmText?: string | null;
      cancelText?: string | null;
      autoCloseMs?: number | null;
    }
  ): void {
    this.alertState.set({
      open: true,
      type,
      title,
      message,
      confirmText: options?.confirmText ?? 'Aceptar',
      cancelText: options?.cancelText ?? null,
      autoCloseMs: options?.autoCloseMs ?? null
    });
  }

  private actualizarEstadoCurso(cursoId: number, activo: boolean): void {
    this.actualizandoEstadoCursoId.set(cursoId);

    this.cursoService.actualizarEstado(cursoId, activo).subscribe({
      next: (cursoActualizado) => {
        this.actualizandoEstadoCursoId.set(null);
        this.cursos.update((actual) =>
          actual.map((curso) => (curso.id === cursoId ? cursoActualizado : curso))
        );
        this.mostrarAlerta(
          'success',
          activo ? 'Curso habilitado' : 'Curso deshabilitado',
          activo
            ? 'El curso fue habilitado correctamente.'
            : 'El curso fue deshabilitado correctamente.',
          { confirmText: null, autoCloseMs: 2600 }
        );
      },
      error: (error) => {
        this.actualizandoEstadoCursoId.set(null);
        this.mostrarAlerta(
          'error',
          activo ? 'No se pudo habilitar' : 'No se pudo deshabilitar',
          error?.error?.mensaje ??
            (activo ? 'No se pudo habilitar el curso.' : 'No se pudo deshabilitar el curso.')
        );
      }
    });
  }

  private resetAlertState(): void {
    this.alertState.set({
      open: false,
      type: 'info',
      title: '',
      message: '',
      confirmText: 'Aceptar',
      cancelText: null,
      autoCloseMs: null
    });
  }
}
