import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { UsuarioGestion } from '../../models/usuario-gestion';
import { AuthService } from '../../services/auth/auth.service';
import { UsuarioActualizacionPayload, UsuarioService } from '../../services/usuario/usuario.service';

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
}

type RolDisponible = 'ADMIN' | 'DOCENTE' | 'DOCENTE_TUTOR';

@Component({
  selector: 'app-usuario',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './usuario.html',
  styleUrl: './usuario.scss'
})
export class Usuario {
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);

  readonly usuarios = signal<UsuarioGestion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly usuarioSeleccionado = signal<UsuarioGestion | null>(null);
  readonly mostrarDrawer = signal(false);
  readonly cerrandoDrawer = signal(false);
  readonly editUsername = signal('');
  readonly editCorreo = signal('');
  readonly editRoles = signal<RolDisponible[]>([]);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
  readonly rolesDisponibles: RolDisponible[] = ['ADMIN', 'DOCENTE', 'DOCENTE_TUTOR'];

  readonly esAdmin = computed(() => this.authService.obtenerUsuario()?.roles?.includes('ADMIN') ?? false);
  readonly mostrarSkeleton = computed(() => this.cargando() || !!this.error());

  constructor() {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.usuarioService.listar().subscribe({
      next: (response) => {
        this.usuarios.set(response);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set('No se pudieron cargar los usuarios.');
        this.cargando.set(false);
        this.mostrarAlerta(
          'error',
          error?.status === 403 ? 'Sin permisos' : 'No se puede conectar con el servidor',
          error?.status === 403
            ? 'Solo un administrador puede gestionar usuarios.'
            : 'No se pudieron cargar los usuarios. Vuelve a intentarlo en unos segundos.',
          { confirmText: null, autoCloseMs: 3500 }
        );
      }
    });
  }

  abrirDrawer(usuario: UsuarioGestion): void {
    this.usuarioSeleccionado.set(usuario);
    this.editUsername.set(usuario.username);
    this.editCorreo.set(usuario.correo);
    this.editRoles.set(usuario.roles.filter((rol): rol is RolDisponible =>
      this.rolesDisponibles.includes(rol as RolDisponible)
    ));
    this.cerrandoDrawer.set(false);
    this.mostrarDrawer.set(true);
  }

  cerrarDrawer(): void {
    if (this.guardando()) {
      return;
    }
    this.cerrandoDrawer.set(true);
    setTimeout(() => {
      this.mostrarDrawer.set(false);
      this.cerrandoDrawer.set(false);
      this.usuarioSeleccionado.set(null);
    }, 220);
  }

  alternarRol(rol: RolDisponible): void {
    this.editRoles.update((roles) =>
      roles.includes(rol) ? roles.filter((item) => item !== rol) : [...roles, rol]
    );
  }

  guardarCambios(): void {
    const usuario = this.usuarioSeleccionado();
    if (!usuario) {
      return;
    }

    const payload: UsuarioActualizacionPayload = {
      username: this.editUsername().trim(),
      correo: this.editCorreo().trim(),
      roles: this.editRoles()
    };

    if (!payload.username || !payload.correo || !payload.roles.length) {
      this.mostrarAlerta(
        'warning',
        'Faltan datos',
        'Completa username, correo y al menos un rol antes de guardar.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.guardando.set(true);
    this.usuarioService.actualizar(usuario.id, payload).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.usuarios.update((actual) => actual.map((item) => (item.id === actualizado.id ? actualizado : item)));
        this.cerrarDrawer();
        this.mostrarAlerta(
          'success',
          'Usuario actualizado',
          'Los datos y roles del usuario se actualizaron correctamente.',
          { confirmText: null, autoCloseMs: 2800 }
        );
      },
      error: (error) => {
        this.guardando.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudo guardar',
          error?.error?.mensaje ?? 'No se pudieron actualizar los datos del usuario.'
        );
      }
    });
  }

  cambiarEstado(usuario: UsuarioGestion): void {
    const activo = (usuario.estado || 'ACTIVO') !== 'ACTIVO';
    this.usuarioService.actualizarEstado(usuario.id, activo).subscribe({
      next: (actualizado) => {
        this.usuarios.update((actual) => actual.map((item) => (item.id === actualizado.id ? actualizado : item)));
        this.mostrarAlerta(
          'success',
          activo ? 'Usuario activado' : 'Usuario inactivado',
          activo ? 'El usuario vuelve a estar disponible en el sistema.' : 'El usuario fue marcado como inactivo.',
          { confirmText: null, autoCloseMs: 2600 }
        );
      },
      error: (error) => {
        this.mostrarAlerta(
          'error',
          'No se pudo cambiar el estado',
          error?.error?.mensaje ?? 'No se pudo actualizar el estado del usuario.'
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

  etiquetaRoles(usuario: UsuarioGestion): string {
    return usuario.roles.join(', ');
  }

  private mostrarAlerta(
    type: CustomAlertType,
    title: string,
    message: string,
    options?: { confirmText?: string | null; cancelText?: string | null; autoCloseMs?: number | null }
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
