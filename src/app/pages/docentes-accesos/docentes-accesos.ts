import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { Docente } from '../../models/docente';
import { UsuarioGestion } from '../../models/usuario-gestion';
import { DocentePayload, DocenteService } from '../../services/academico/docente.service';
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

export interface DocenteRegistroForm {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  especialidad: string;
  correo: string;
}

interface DocenteAccesoRow extends Docente {
  key: string;
  usuarioGestionId: number | null;
  roles: string[];
  debeCambiarPassword: boolean;
  accesoEstado: string;
  esCuentaAdministrativa: boolean;
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
  private readonly usuarioService = inject(UsuarioService);

  readonly docentes = signal<Docente[]>([]);
  readonly filas = signal<DocenteAccesoRow[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly mostrarPanelRegistro = signal(false);
  readonly cerrandoPanelRegistro = signal(false);
  readonly mostrarModalAcceso = signal(false);
  readonly cerrandoModalAcceso = signal(false);
  readonly usuarioSeleccionado = signal<DocenteAccesoRow | null>(null);
  readonly filaPendienteCambioEstado = signal<DocenteAccesoRow | null>(null);
  readonly editUsername = signal('');
  readonly editCorreo = signal('');
  readonly editEsAdmin = signal(false);
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
  readonly totalCuentasAdministrativas = computed(
    () => this.filas().filter((fila) => fila.esCuentaAdministrativa).length
  );

  constructor() {
    this.cargarDocentes();
  }

  cargarDocentes(): void {
    this.cargando.set(true);
    this.error.set(null);

    if (!this.esAdmin()) {
      this.docenteService.listar().subscribe({
        next: (response) => {
          this.docentes.set(response);
          this.filas.set(this.combinarDocentesConUsuarios(response, []));
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
      return;
    }

    forkJoin({
      docentes: this.docenteService.listar(),
      usuarios: this.usuarioService.listar()
    }).subscribe({
      next: ({ docentes, usuarios }) => {
        this.docentes.set(docentes);
        this.filas.set(this.combinarDocentesConUsuarios(docentes, usuarios));
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

  abrirPanelAcceso(fila: DocenteAccesoRow): void {
    if (!fila.usuarioGestionId) {
      this.mostrarAlerta(
        'warning',
        'Sin acceso vinculado',
        'Este docente todavia no tiene una cuenta de usuario vinculada para administrar roles.',
        { confirmText: null, autoCloseMs: 3200 }
      );
      return;
    }

    this.usuarioSeleccionado.set(fila);
    this.editUsername.set(fila.username ?? '');
    this.editCorreo.set(fila.correo ?? '');
    this.editEsAdmin.set(fila.roles.includes('ADMIN'));
    this.cerrandoModalAcceso.set(false);
    this.mostrarModalAcceso.set(true);
  }

  cerrarPanelAcceso(): void {
    if (this.guardando()) {
      return;
    }
    this.cerrandoModalAcceso.set(true);
    setTimeout(() => {
      this.mostrarModalAcceso.set(false);
      this.cerrandoModalAcceso.set(false);
      this.usuarioSeleccionado.set(null);
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
        this.limpiarFormulario();
        this.cerrarPanelRegistro();
        this.cargarDocentes();
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

  guardarAcceso(): void {
    const usuario = this.usuarioSeleccionado();
    if (!usuario?.usuarioGestionId) {
      return;
    }

    const username = this.editUsername().trim();
    const correo = this.editCorreo().trim();
    const adminOriginal = usuario.roles.includes('ADMIN');

    if (
      username === (usuario.username ?? '').trim() &&
      correo === (usuario.correo ?? '').trim() &&
      this.editEsAdmin() === adminOriginal
    ) {
      this.mostrarAlerta(
        'info',
        'Sin cambios',
        'No hiciste ningun cambio en el acceso seleccionado.',
        { confirmText: null, autoCloseMs: 2600 }
      );
      return;
    }

    const roles = new Set<string>();
    if (this.editEsAdmin()) {
      roles.add('ADMIN');
    }

    if (!usuario.esCuentaAdministrativa) {
      roles.add('DOCENTE');
      if (usuario.roles.includes('DOCENTE_TUTOR')) {
        roles.add('DOCENTE_TUTOR');
      }
    } else if (!roles.size) {
      usuario.roles.forEach((rol) => roles.add(rol));
    }

    const payload: UsuarioActualizacionPayload = {
      username,
      correo,
      roles: Array.from(roles)
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
    this.usuarioService.actualizar(usuario.usuarioGestionId, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarPanelAcceso();
        this.cargarDocentes();
        this.mostrarAlerta(
          'success',
          'Acceso actualizado',
          'Los roles y datos del usuario se actualizaron correctamente.',
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

  cambiarEstadoAcceso(fila: DocenteAccesoRow): void {
    if (!fila.usuarioGestionId) {
      this.mostrarAlerta(
        'warning',
        'Sin acceso vinculado',
        'Este docente todavia no tiene una cuenta para activar o inactivar.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    const activo = fila.accesoEstado !== 'ACTIVO';

    if (!activo) {
      this.filaPendienteCambioEstado.set(fila);
      this.alertState.set({
        open: true,
        type: 'warning',
        title: 'Confirmar inactivacion',
        message: `Se inactivara la cuenta ${fila.username ?? 'seleccionada'} y, si corresponde, tambien el docente vinculado. ¿Deseas continuar?`,
        confirmText: 'Inactivar',
        cancelText: 'Cancelar',
        autoCloseMs: null
      });
      return;
    }

    this.ejecutarCambioEstado(fila, activo);
  }

  confirmarInactivacionPendiente(): void {
    const fila = this.filaPendienteCambioEstado();
    if (!fila) {
      this.cerrarAlerta();
      return;
    }

    this.filaPendienteCambioEstado.set(null);
    this.ejecutarCambioEstado(fila, false);
  }

  cancelarInactivacionPendiente(): void {
    this.filaPendienteCambioEstado.set(null);
    this.cerrarAlerta();
  }

  private ejecutarCambioEstado(fila: DocenteAccesoRow, activo: boolean): void {
    const usuarioGestionId = fila.usuarioGestionId;
    if (usuarioGestionId === null) {
      this.mostrarAlerta(
        'warning',
        'Sin acceso vinculado',
        'La cuenta seleccionada ya no tiene un usuario asociado para actualizar su estado.',
        { confirmText: null, autoCloseMs: 3000 }
      );
      return;
    }

    this.usuarioService.actualizarEstado(usuarioGestionId, activo).subscribe({
      next: () => {
        this.cargarDocentes();
        this.mostrarAlerta(
          'success',
          activo ? 'Acceso activado' : 'Acceso inactivado',
          activo ? 'La cuenta vuelve a estar disponible.' : 'La cuenta fue marcada como inactiva.',
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

  etiquetaRoles(roles: string[]): string {
    return roles.length ? roles.join(', ') : 'Sin roles';
  }

  puedeCambiarEstadoAcceso(fila: DocenteAccesoRow): boolean {
    if (!this.esAdmin() || !fila.usuarioGestionId) {
      return false;
    }

    if (fila.accesoEstado === 'ACTIVO' && fila.roles.includes('ADMIN')) {
      return false;
    }

     if (fila.accesoEstado === 'ACTIVO' && fila.roles.includes('DOCENTE_TUTOR')) {
      return false;
    }

    return true;
  }

  etiquetaAccionEstado(fila: DocenteAccesoRow): string {
    if (fila.accesoEstado === 'ACTIVO' && fila.roles.includes('ADMIN')) {
      return 'Cuenta protegida';
    }

    if (fila.accesoEstado === 'ACTIVO' && fila.roles.includes('DOCENTE_TUTOR')) {
      return 'Tutoria activa';
    }

    return fila.accesoEstado === 'ACTIVO' ? 'Deshabilitar' : 'Activar';
  }

  nombreVisible(fila: DocenteAccesoRow): string {
    if (fila.esCuentaAdministrativa) {
      return fila.username ?? 'Cuenta administrativa';
    }

    return `${fila.apellidos}, ${fila.nombres}`;
  }

  cerrarAlerta(): void {
    this.filaPendienteCambioEstado.set(null);
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

  private combinarDocentesConUsuarios(docentes: Docente[], usuarios: UsuarioGestion[]): DocenteAccesoRow[] {
    const usuariosPorDocenteId = new Map<number, UsuarioGestion>();
    const usuariosPorId = new Map<number, UsuarioGestion>();

    for (const usuario of usuarios) {
      if (usuario.docenteId !== null) {
        usuariosPorDocenteId.set(usuario.docenteId, usuario);
      }
      usuariosPorId.set(usuario.id, usuario);
    }

    const filasDocentes = docentes.map((docente) => {
      const usuario = usuariosPorDocenteId.get(docente.id)
        ?? (docente.usuarioId ? usuariosPorId.get(docente.usuarioId) : undefined);

      return {
        ...docente,
        key: `docente-${docente.id}`,
        usuarioGestionId: usuario?.id ?? docente.usuarioId ?? null,
        username: usuario?.username ?? docente.username ?? null,
        correo: usuario?.correo ?? docente.correo ?? null,
        roles: usuario?.roles ?? [],
        debeCambiarPassword: usuario?.debeCambiarPassword ?? false,
        accesoEstado: usuario?.estado ?? (docente.usuarioId ? 'ACTIVO' : 'SIN ACCESO'),
        esCuentaAdministrativa: false
      };
    });

    const docentesCubiertos = new Set(
      filasDocentes
        .filter((fila) => fila.usuarioGestionId !== null)
        .map((fila) => fila.usuarioGestionId as number)
    );

    const filasAdministrativas = usuarios
      .filter((usuario) => !docentesCubiertos.has(usuario.id))
      .map((usuario) => ({
        id: -(usuario.id),
        key: `usuario-${usuario.id}`,
        usuarioId: usuario.id,
        username: usuario.username,
        correo: usuario.correo,
        dni: null,
        nombres: 'Cuenta',
        apellidos: 'Administrativa',
        telefono: null,
        especialidad: usuario.docenteId ? 'Sincronizacion pendiente' : 'Cuenta administrativa',
        estado: usuario.estado,
        usuarioGestionId: usuario.id,
        roles: usuario.roles,
        debeCambiarPassword: usuario.debeCambiarPassword,
        accesoEstado: usuario.estado || 'ACTIVO',
        esCuentaAdministrativa: true
      } satisfies DocenteAccesoRow));

    return [...filasDocentes, ...filasAdministrativas];
  }
}
