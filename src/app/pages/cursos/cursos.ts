import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { Curso } from '../../models/curso';
import { AuthService } from '../../services/auth/auth.service';
import { CursoPayload, CursoService } from '../../services/academico/curso.service';

type NivelTab = 0 | 1 | 2;

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
  readonly filtro = signal('');
  readonly nivelTab = signal<NivelTab>(0);
  readonly formNombre = signal('');
  readonly formDescripcion = signal('');
  readonly formNivelId = signal(1);
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
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
  private pendingAlertAction: AlertAction = 'none';

  readonly esAdmin = computed(() => this.authService.obtenerUsuario()?.roles?.includes('ADMIN') ?? false);

  readonly cursosFiltrados = computed(() => {
    const filtro = this.filtro().trim().toLowerCase();
    const nivel = this.nivelTab();

    return this.cursos()
      .filter((curso) => {
        if (nivel === 1 && curso.nivelId !== 1) {
          return false;
        }

        if (nivel === 2 && curso.nivelId !== 2) {
          return false;
        }

        if (!filtro) {
          return true;
        }

        return (
          curso.nombre.toLowerCase().includes(filtro) ||
          curso.nivelNombre.toLowerCase().includes(filtro) ||
          (curso.descripcion ?? '').toLowerCase().includes(filtro)
        );
      })
      .sort(
        (a, b) =>
          a.nivelNombre.localeCompare(b.nivelNombre) ||
          a.nombre.localeCompare(b.nombre)
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

  actualizarFiltro(valor: string): void {
    this.filtro.set(valor);
  }

  limpiarFormulario(): void {
    this.formNombre.set('');
    this.formDescripcion.set('');
    this.formNivelId.set(1);
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
      nivelId: Number(this.formNivelId())
    };

    this.guardando.set(true);

    this.cursoService.crear(payload).subscribe({
      next: (curso) => {
        this.guardando.set(false);
        this.cursos.update((actual) => [...actual, curso]);
        this.limpiarFormulario();
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

  cerrarAlerta(): void {
    const accion = this.pendingAlertAction;
    this.pendingAlertAction = 'none';
    this.alertState.set({
      open: false,
      type: 'info',
      title: '',
      message: '',
      confirmText: 'Aceptar',
      cancelText: null,
      autoCloseMs: null
    });

    if (accion === 'retry-load') {
      this.cargarCursos();
    }
  }

  descartarAlerta(): void {
    this.pendingAlertAction = 'none';
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
}
