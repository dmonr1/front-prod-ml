import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { Docente } from '../../models/docente';
import { DocentePayload, DocenteService } from '../../services/academico/docente.service';
import { AuthService } from '../../services/auth/auth.service';

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
}

export interface DocenteRegistroForm {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  especialidad: string;
  correo: string;
}

@Component({
  selector: 'app-docentes-accesos',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './docentes-accesos.html',
  styleUrl: './docentes-accesos.scss'
})
export class DocentesAccesos {
  private readonly docenteService = inject(DocenteService);
  private readonly authService = inject(AuthService);

  readonly docentes = signal<Docente[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly mostrarPanelRegistro = signal(false);
  readonly cerrandoPanelRegistro = signal(false);
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
  readonly form = signal<DocenteRegistroForm>({
    nombres: '',
    apellidos: '',
    dni: '',
    telefono: '',
    especialidad: '',
    correo: ''
  });
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });

  readonly esAdmin = computed(() => this.authService.obtenerUsuario()?.roles?.includes('ADMIN') ?? false);
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());

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
        this.mostrarAlerta(
          'error',
          'No se puede conectar con el servidor',
          'No se pudieron cargar los docentes registrados. Vuelve a intentarlo en unos segundos.',
          { confirmText: null, autoCloseMs: 3500 }
        );
      }
    });
  }

  actualizarCampo(campo: keyof DocenteRegistroForm, valor: string): void {
    this.form.update((actual) => ({ ...actual, [campo]: valor }));
  }

  abrirPanelRegistro(): void {
    this.cerrandoPanelRegistro.set(false);
    this.mostrarPanelRegistro.set(true);
  }

  cerrarPanelRegistro(): void {
    if (this.guardando()) {
      return;
    }
    this.cerrandoPanelRegistro.set(true);
    setTimeout(() => {
      this.mostrarPanelRegistro.set(false);
      this.cerrandoPanelRegistro.set(false);
    }, 220);
  }

  limpiarFormulario(): void {
    this.form.set({
      nombres: '',
      apellidos: '',
      dni: '',
      telefono: '',
      especialidad: '',
      correo: ''
    });
  }

  guardarDocente(): void {
    if (!this.esAdmin()) {
      this.mostrarAlerta(
        'warning',
        'Sin permisos',
        'Solo un administrador puede registrar docentes y generar accesos.',
        { confirmText: null, autoCloseMs: 3200 }
      );
      return;
    }

    const form = this.form();
    const nombres = form.nombres.trim();
    const apellidos = form.apellidos.trim();
    const dni = form.dni.trim();
    const correo = form.correo.trim();

    if (!nombres || !apellidos || !dni || !correo) {
      this.mostrarAlerta(
        'warning',
        'Faltan datos obligatorios',
        'Completa nombres, apellidos, DNI y correo para registrar al docente.',
        { confirmText: null, autoCloseMs: 3200 }
      );
      return;
    }

    const payload: DocentePayload = {
      nombres,
      apellidos,
      dni,
      telefono: form.telefono.trim() || null,
      especialidad: form.especialidad.trim() || null,
      correo
    };

    this.guardando.set(true);

    this.docenteService.crear(payload).subscribe({
      next: (docente) => {
        this.guardando.set(false);
        this.docentes.update((actual) => [docente, ...actual]);
        this.limpiarFormulario();
        this.cerrarPanelRegistro();
        this.mostrarAlerta(
          'success',
          'Docente registrado',
          `Se creo el docente y su acceso. Usuario generado: ${docente.username}. Contraseña temporal: su DNI.`,
          { confirmText: 'Entendido', autoCloseMs: null }
        );
      },
      error: (error) => {
        this.guardando.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudo registrar',
          error?.error?.mensaje ?? 'No se pudo registrar el docente y su acceso.'
        );
      }
    });
  }

  cerrarAlerta(): void {
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
