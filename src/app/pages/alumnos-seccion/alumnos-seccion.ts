import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { DatePickerComponent } from '../../components/date-picker/date-picker';
import { Shell } from '../../layouts/shell/shell';
import { Grado } from '../../models/grado';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { TipoDocumento } from '../../models/tipo-documento';
import { AlumnoPayload, AlumnoService } from '../../services/academico/alumno.service';
import { GradoService } from '../../services/academico/grado.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { TipoDocumentoService } from '../../services/academico/tipo-documento.service';
import { AuthService } from '../../services/auth/auth.service';
import { formatearMensajeError } from '../../utils/error-formatter';

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
}

@Component({
  selector: 'app-alumnos-seccion',
  imports: [Shell, FormsModule, RouterLink, CustomAlertComponent, DatePickerComponent],
  templateUrl: './alumnos-seccion.html',
  styleUrl: './alumnos-seccion.scss'
})
export class AlumnosSeccion {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alumnoService = inject(AlumnoService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly gradoService = inject(GradoService);
  private readonly seccionService = inject(SeccionService);
  private readonly matriculaService = inject(MatriculaService);
  private readonly tipoDocumentoService = inject(TipoDocumentoService);
  private readonly authService = inject(AuthService);

  readonly currentYear = new Date().getFullYear();
  readonly periodoId = Number(this.route.snapshot.paramMap.get('periodoId'));
  readonly seccionId = Number(this.route.snapshot.paramMap.get('seccionId'));

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodo = signal<PeriodoAcademico | null>(null);
  readonly grados = signal<Grado[]>([]);
  readonly grado = signal<Grado | null>(null);
  readonly seccion = signal<Seccion | null>(null);
  readonly secciones = signal<Seccion[]>([]);
  readonly matriculas = signal<Matricula[]>([]);
  readonly tiposDocumento = signal<TipoDocumento[]>([]);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null
  });

  readonly cargandoBase = signal(true);
  readonly cargandoMatriculas = signal(true);
  readonly guardandoAlumno = signal(false);
  readonly cargandoPeriodoAnterior = signal(false);
  readonly cargandoAlumnosSeleccionados = signal(false);
  readonly modalAlumnosAnterioresAbierto = signal(false);
  readonly alumnosPeriodoAnterior = signal<Matricula[]>([]);
  readonly alumnosAnterioresSeleccionados = signal<Set<number>>(new Set());

  readonly errorBase = signal<string | null>(null);
  readonly errorMatriculas = signal<string | null>(null);

  readonly busquedaAlumnos = signal('');
  readonly ordenAscendente = signal(true);
  readonly estadoFiltro = signal('');
  readonly matriculaPendienteCambioEstado = signal<Matricula | null>(null);
  readonly cambiandoEstadoMatriculaId = signal<number | null>(null);
  readonly alumnoEditandoId = signal<number | null>(null);
  readonly alumnoEditandoNombre = signal<string | null>(null);
  readonly cargandoDetalleAlumnoId = signal<number | null>(null);

  readonly formAlumno = signal<AlumnoPayload>({
    codigo: null,
    tipoDocumentoId: 1,
    numeroDocumento: null,
    nombres: '',
    apellidos: '',
    fechaNacimiento: null,
    sexo: null,
    direccion: null,
    nombreApoderado: null,
    telefonoApoderado: null
  });

  readonly esPeriodoEditable = computed(() => {
    const periodo = this.periodo();
    return periodo ? periodo.anio >= this.currentYear || this.authService.esAdministrador() : false;
  });

  readonly tipoDocumentoAlumno = computed(() =>
    this.tiposDocumento().find((tipo) => tipo.id === this.formAlumno().tipoDocumentoId) ?? null
  );

  readonly matriculasSeccion = computed(() =>
    this.matriculas().filter((matricula) => matricula.seccionId === this.seccionId)
  );

  readonly matriculasFiltradas = computed(() => {
    const query = this.busquedaAlumnos().trim().toLowerCase();
    const filtroEstado = this.estadoFiltro();
    let items = this.matriculasSeccion();

    if (query) {
      items = items.filter(
        (m) =>
          m.alumnoNombreCompleto.toLowerCase().includes(query) ||
          m.codigoAlumno.toLowerCase().includes(query)
      );
    }

    if (filtroEstado) {
      items = items.filter((m) => (m.estado || 'ACTIVO') === filtroEstado);
    }

    const asc = this.ordenAscendente();

    return [...items].sort((a, b) => {
      const diff = a.alumnoNombreCompleto.localeCompare(b.alumnoNombreCompleto, 'es', { sensitivity: 'base' });
      return asc ? diff : -diff;
    });
  });

  readonly periodoAnterior = computed(() => {
    const actual = this.periodo();
    if (!actual) {
      return null;
    }

    return this.periodos().find((periodo) => periodo.anio === actual.anio - 1) ?? null;
  });

  readonly gradoAnterior = computed(() => {
    const actual = this.grado();
    if (!actual || actual.orden <= 1) {
      return null;
    }

    return this.grados().find((grado) => grado.orden === actual.orden - 1) ?? null;
  });

  readonly cuposDisponibles = computed(() => {
    const capacidad = this.seccion()?.capacidad ?? 30;
    const ocupados = this.matriculasSeccion().filter((matricula) => matricula.estado !== 'INACTIVO').length;
    return Math.max(0, capacidad - ocupados);
  });

  readonly todosLosAlumnosAnterioresSeleccionados = computed(() => {
    const alumnos = this.alumnosPeriodoAnterior().slice(0, this.cuposDisponibles());
    return alumnos.length > 0 && alumnos.every((alumno) => this.alumnosAnterioresSeleccionados().has(alumno.alumnoId));
  });

  readonly cantidadAlumnosAnterioresSeleccionados = computed(
    () => this.alumnosAnterioresSeleccionados().size
  );

  constructor() {
    if (!this.authService.tieneGestionAdministrativa()) {
      void this.router.navigate(['/mis-asignaciones']);
      return;
    }
    this.cargarBase();
    this.cargarMatriculas();
    this.cargarTiposDocumento();
  }

  cargarTiposDocumento(): void {
    this.tipoDocumentoService.listar().subscribe({
      next: (tiposDocumento) => this.tiposDocumento.set(tiposDocumento),
      error: () => this.mostrarAlerta('error', 'No se pudieron cargar los documentos', 'Intenta recargar la página.')
    });
  }

  cargarBase(): void {
    this.cargandoBase.set(true);
    this.errorBase.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);
        this.periodo.set(periodos.find((item) => item.id === this.periodoId) ?? null);

        this.gradoService.listar().subscribe({
          next: (grados) => {
            this.grados.set(grados);
            this.seccionService.listar().subscribe({
              next: (secciones) => {
                this.secciones.set(secciones);
                const seccion = secciones.find((item) => item.id === this.seccionId) ?? null;
                this.seccion.set(seccion);
                this.grado.set(grados.find((item) => item.id === seccion?.gradoId) ?? null);
                this.cargandoBase.set(false);
              },
              error: () => {
                this.errorBase.set('No se pudo cargar la sección.');
                this.cargandoBase.set(false);
              }
            });
          },
          error: () => {
            this.errorBase.set('No se pudo cargar el grado.');
            this.cargandoBase.set(false);
          }
        });
      },
      error: () => {
        this.errorBase.set('No se pudo cargar el período académico.');
        this.cargandoBase.set(false);
      }
    });
  }

  cargarMatriculas(): void {
    this.cargandoMatriculas.set(true);
    this.errorMatriculas.set(null);

    this.matriculaService.listar(this.periodoId, this.seccionId).subscribe({
      next: (response) => {
        this.matriculas.set(response);
        this.cargandoMatriculas.set(false);
      },
      error: () => {
        this.errorMatriculas.set('No se pudieron cargar los alumnos matriculados de esta sección.');
        this.cargandoMatriculas.set(false);
      }
    });
  }

  cargarAlumnosPeriodoAnterior(): void {
    const periodoAnterior = this.periodoAnterior();
    const gradoAnterior = this.gradoAnterior();

    if (!periodoAnterior) {
      this.mostrarAlerta(
        'warning',
        'No hay período anterior',
        'No existe un período anterior disponible para esta sección.'
      );
      return;
    }

    if (!gradoAnterior) {
      this.mostrarAlerta(
        'warning',
        'Sin grado anterior',
        'El primer grado de primaria no tiene un grado previo para promover alumnos.'
      );
      return;
    }

    if (!this.cuposDisponibles()) {
      this.mostrarAlerta('warning', 'Sección completa', 'Esta sección ya alcanzó su capacidad.');
      return;
    }

    this.cargandoPeriodoAnterior.set(true);

    forkJoin({
      matriculasAnteriores: this.matriculaService.listar(periodoAnterior.id),
      matriculasActuales: this.matriculaService.listar(this.periodoId)
    }).subscribe({
      next: ({ matriculasAnteriores, matriculasActuales }) => {
        const alumnosGradoAnterior = matriculasAnteriores.filter(
          (matricula) => matricula.gradoId === gradoAnterior.id && matricula.estado !== 'INACTIVO'
        );
        if (!alumnosGradoAnterior.length) {
          this.cargandoPeriodoAnterior.set(false);
          this.mostrarAlerta(
            'warning',
            'Sin alumnos previos',
            `No hay alumnos de ${gradoAnterior.nombre} matriculados en el período anterior.`
          );
          return;
        }

        const alumnosYaMatriculados = new Set(matriculasActuales.map((matricula) => matricula.alumnoId));
        const pendientes = alumnosGradoAnterior
          .filter((matricula) => !alumnosYaMatriculados.has(matricula.alumnoId))
          .sort((a, b) => a.alumnoNombreCompleto.localeCompare(b.alumnoNombreCompleto, 'es'));

        if (!pendientes.length) {
          this.cargandoPeriodoAnterior.set(false);
          this.mostrarAlerta(
            'info',
            'Sin cambios',
            'Los alumnos del grado anterior ya tienen matrícula en este período.'
          );
          return;
        }

        this.alumnosPeriodoAnterior.set(pendientes);
        this.alumnosAnterioresSeleccionados.set(new Set(
          pendientes.slice(0, this.cuposDisponibles()).map((matricula) => matricula.alumnoId)
        ));
        this.cargandoPeriodoAnterior.set(false);
        this.modalAlumnosAnterioresAbierto.set(true);
      },
      error: (error) => {
        this.cargandoPeriodoAnterior.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudieron consultar',
          formatearMensajeError(error, 'No se pudieron consultar los alumnos del período anterior.')
        );
      }
    });
  }

  alternarSeleccionAlumnoAnterior(alumnoId: number, seleccionado: boolean): void {
    if (seleccionado && this.alumnosAnterioresSeleccionados().size >= this.cuposDisponibles()) {
      this.mostrarAlerta('warning', 'Cupos completos', 'No puedes seleccionar más alumnos que cupos disponibles.');
      return;
    }
    this.alumnosAnterioresSeleccionados.update((actual) => {
      const siguiente = new Set(actual);
      if (seleccionado) {
        siguiente.add(alumnoId);
      } else {
        siguiente.delete(alumnoId);
      }
      return siguiente;
    });
  }

  seleccionarTodosAlumnosAnteriores(seleccionar: boolean): void {
    this.alumnosAnterioresSeleccionados.set(
      seleccionar
        ? new Set(this.alumnosPeriodoAnterior().slice(0, this.cuposDisponibles()).map((matricula) => matricula.alumnoId))
        : new Set()
    );
  }

  cerrarModalAlumnosAnteriores(): void {
    if (this.cargandoAlumnosSeleccionados()) {
      return;
    }

    this.modalAlumnosAnterioresAbierto.set(false);
    this.alumnosPeriodoAnterior.set([]);
    this.alumnosAnterioresSeleccionados.set(new Set());
  }

  cargarAlumnosSeleccionados(): void {
    const seleccionados = this.alumnosPeriodoAnterior().filter((matricula) =>
      this.alumnosAnterioresSeleccionados().has(matricula.alumnoId)
    );

    if (!seleccionados.length) {
      this.mostrarAlerta(
        'warning',
        'Selecciona alumnos',
        'Selecciona al menos un alumno para cargarlo en esta sección.'
      );
      return;
    }

    if (seleccionados.length > this.cuposDisponibles()) {
      this.mostrarAlerta('warning', 'Cupos insuficientes', 'Reduce la selección según los cupos disponibles.');
      return;
    }

    this.cargandoAlumnosSeleccionados.set(true);

    forkJoin(
      seleccionados.map((matricula) =>
        this.matriculaService.crear({
          alumnoId: matricula.alumnoId,
          seccionId: this.seccionId,
          periodoAcademicoId: this.periodoId
        })
      )
    ).subscribe({
      next: () => {
        this.cargandoAlumnosSeleccionados.set(false);
        this.cerrarModalAlumnosAnteriores();
        this.mostrarAlerta(
          'success',
          'Alumnos cargados',
          `Se cargaron ${seleccionados.length} alumno${seleccionados.length === 1 ? '' : 's'} en esta sección.`
        );
        this.cargarMatriculas();
      },
      error: (error) => {
        this.cargandoAlumnosSeleccionados.set(false);
        this.cargarMatriculas();
        this.mostrarAlerta(
          'error',
          'No se pudieron cargar',
          formatearMensajeError(error, 'No se pudieron cargar los alumnos seleccionados.')
        );
      }
    });
  }

  actualizarCampoAlumno<K extends keyof AlumnoPayload>(campo: K, valor: AlumnoPayload[K]): void {
    this.formAlumno.update((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  esTeclaControl(event: KeyboardEvent): boolean {
    return (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      [
        'Backspace',
        'Delete',
        'Tab',
        'Escape',
        'Enter',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End'
      ].includes(event.key)
    );
  }

  filtrarTeclasNumeroDocumento(event: KeyboardEvent): void {
    if (this.esTeclaControl(event)) {
      return;
    }

    const tipoDocumento = this.tipoDocumentoAlumno();
    const esSoloNumeros = !tipoDocumento || tipoDocumento.tipo === 'NUMERICO';

    if (esSoloNumeros) {
      if (!/^\d$/.test(event.key)) {
        event.preventDefault();
      }
    } else {
      if (!/^[a-zA-Z0-9]$/.test(event.key)) {
        event.preventDefault();
      }
    }
  }

  onInputNumeroDocumento(event: Event): void {
    const input = event.target as HTMLInputElement;
    const tipoDocumento = this.tipoDocumentoAlumno();
    const normalizado = this.normalizarNumeroDocumento(input.value, tipoDocumento);
    input.value = normalizado;
    this.actualizarCampoAlumno('numeroDocumento', normalizado || null);
  }

  filtrarTeclasSoloLetras(event: KeyboardEvent): void {
    if (this.esTeclaControl(event)) {
      return;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onInputSoloLetras(campo: 'nombres' | 'apellidos' | 'nombreApoderado', event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalizado = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    input.value = normalizado;
    this.actualizarCampoAlumno(campo, normalizado);
  }

  filtrarTeclasTelefono(event: KeyboardEvent): void {
    if (this.esTeclaControl(event)) {
      return;
    }
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onInputTelefono(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalizado = input.value.replace(/\D/g, '').slice(0, 9);
    input.value = normalizado;
    this.actualizarCampoAlumno('telefonoApoderado', normalizado || null);
  }

  onInputDireccion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.slice(0, 150);
    input.value = valor;
    this.actualizarCampoAlumno('direccion', valor || null);
  }

  actualizarNumeroDocumentoAlumno(valor: string): void {
    const tipoDocumento = this.tipoDocumentoAlumno();
    const numeroDocumento = this.normalizarNumeroDocumento(valor, tipoDocumento);
    this.actualizarCampoAlumno('numeroDocumento', numeroDocumento || null);
  }

  actualizarTipoDocumentoAlumno(tipoDocumentoId: number): void {
    this.formAlumno.update((actual) => {
      const tipoDocumento = this.tiposDocumento().find((tipo) => tipo.id === tipoDocumentoId) ?? null;
      const numeroDocumento = actual.numeroDocumento
        ? this.normalizarNumeroDocumento(actual.numeroDocumento, tipoDocumento)
        : null;
      return {
        ...actual,
        tipoDocumentoId,
        numeroDocumento: numeroDocumento || null
      };
    });
  }

  limpiarFormularioAlumno(): void {
    this.formAlumno.set({
      codigo: null,
      tipoDocumentoId: 1,
      numeroDocumento: null,
      nombres: '',
      apellidos: '',
      fechaNacimiento: null,
      sexo: null,
      direccion: null,
      nombreApoderado: null,
      telefonoApoderado: null
    });
  }

  seleccionarAlumnoParaEditar(matricula: Matricula): void {
    if (!this.esPeriodoEditable()) {
      this.mostrarAlerta('warning', 'Período no editable', 'No se pueden editar alumnos en un período histórico.');
      return;
    }

    this.cargandoDetalleAlumnoId.set(matricula.alumnoId);

    this.alumnoService.obtenerPorId(matricula.alumnoId).subscribe({
      next: (alumno) => {
        this.cargandoDetalleAlumnoId.set(null);
        this.alumnoEditandoId.set(alumno.id);
        this.alumnoEditandoNombre.set(`${alumno.nombres} ${alumno.apellidos}`.trim());
        this.formAlumno.set({
          codigo: alumno.codigo || null,
          tipoDocumentoId: alumno.tipoDocumentoId || 1,
          numeroDocumento: alumno.numeroDocumento || null,
          nombres: alumno.nombres || '',
          apellidos: alumno.apellidos || '',
          fechaNacimiento: alumno.fechaNacimiento ? String(alumno.fechaNacimiento).slice(0, 10) : null,
          sexo: alumno.sexo || null,
          direccion: alumno.direccion || null,
          nombreApoderado: alumno.nombreApoderado || null,
          telefonoApoderado: alumno.telefonoApoderado || null
        });
      },
      error: (error) => {
        this.cargandoDetalleAlumnoId.set(null);
        this.mostrarAlerta(
          'error',
          'No se pudo cargar el alumno',
          formatearMensajeError(error, 'No se pudo obtener la información del alumno para editar.')
        );
      }
    });
  }

  cancelarEdicion(): void {
    this.alumnoEditandoId.set(null);
    this.alumnoEditandoNombre.set(null);
    this.limpiarFormularioAlumno();
  }

  guardarAlumno(): void {
    const payload = this.normalizarAlumno(this.formAlumno());

    if (!payload.nombres || !payload.apellidos) {
      this.mostrarAlerta(
        'warning',
        'Completa los datos obligatorios',
        'Ingresa los nombres y apellidos antes de guardar.'
      );
      return;
    }

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(payload.nombres)) {
      this.mostrarAlerta(
        'warning',
        'Nombres no válidos',
        'Los nombres solo deben contener letras.'
      );
      return;
    }

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(payload.apellidos)) {
      this.mostrarAlerta(
        'warning',
        'Apellidos no válidos',
        'Los apellidos solo deben contener letras.'
      );
      return;
    }

    const errorDocumento = this.validarDocumentoAlumno(payload.numeroDocumento, this.tipoDocumentoAlumno());
    if (errorDocumento) {
      this.mostrarAlerta('warning', 'Documento no válido', errorDocumento);
      return;
    }

    if (payload.nombreApoderado && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(payload.nombreApoderado)) {
      this.mostrarAlerta(
        'warning',
        'Nombre del apoderado no válido',
        'El nombre del apoderado solo debe contener letras.'
      );
      return;
    }

    if (payload.telefonoApoderado && !/^\d{9}$/.test(payload.telefonoApoderado)) {
      this.mostrarAlerta(
        'warning',
        'Teléfono no válido',
        'El teléfono del apoderado debe tener exactamente 9 dígitos.'
      );
      return;
    }

    this.guardandoAlumno.set(true);

    const editandoId = this.alumnoEditandoId();
    if (editandoId) {
      this.alumnoService.actualizar(editandoId, payload).subscribe({
        next: (alumnoActualizado) => {
          this.guardandoAlumno.set(false);
          const nombreCompleto = `${alumnoActualizado.nombres} ${alumnoActualizado.apellidos}`.trim();
          this.matriculas.update((actuales) =>
            actuales.map((m) =>
              m.alumnoId === editandoId
                ? {
                    ...m,
                    alumnoNombreCompleto: nombreCompleto,
                    codigoAlumno: alumnoActualizado.codigo || m.codigoAlumno
                  }
                : m
            )
          );
          this.cancelarEdicion();
          this.mostrarAlerta(
            'success',
            'Alumno actualizado',
            `Los datos de ${nombreCompleto} se actualizaron correctamente.`
          );
        },
        error: (error) => {
          this.guardandoAlumno.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo actualizar',
            formatearMensajeError(error, 'No se pudo actualizar los datos del alumno.')
          );
        }
      });
      return;
    }

    this.alumnoService
      .crearYMatricular({
        alumno: payload,
        seccionId: this.seccionId,
        periodoAcademicoId: this.periodoId
      })
      .subscribe({
        next: (matricula) => {
          this.guardandoAlumno.set(false);
          this.limpiarFormularioAlumno();
          this.mostrarAlerta(
            'success',
            'Alumno registrado',
            'El alumno se creó y se agregó automáticamente a esta sección.'
          );
          this.matriculas.update((actual) => [...actual, matricula]);
          this.cargarBase();
          this.cargarMatriculas();
        },
        error: (error) => {
          this.guardandoAlumno.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo registrar',
            formatearMensajeError(error, 'No se pudo crear y agregar el alumno a la sección.')
          );
        }
      });
  }

  guardarAlumnoNuevo(): void {
    this.guardarAlumno();
  }

  alternarOrdenNombre(): void {
    this.ordenAscendente.update((asc) => !asc);
  }

  limpiarFiltros(): void {
    this.busquedaAlumnos.set('');
    this.estadoFiltro.set('');
  }

  solicitarCambioEstadoMatricula(matricula: Matricula): void {
    if (!this.esPeriodoEditable()) {
      this.mostrarAlerta('warning', 'Período no editable', 'No se pueden realizar cambios en un período histórico.');
      return;
    }

    const estaActivo = (matricula.estado || 'ACTIVO') === 'ACTIVO';
    this.matriculaPendienteCambioEstado.set(matricula);

    this.alertState.set({
      open: true,
      type: 'warning',
      title: estaActivo ? '¿Desactivar matrícula?' : '¿Activar matrícula?',
      message: estaActivo
        ? `¿Estás seguro de que deseas desactivar la matrícula de ${matricula.alumnoNombreCompleto}? El alumno dejará de figurar activo en esta sección.`
        : `¿Estás seguro de que deseas activar la matrícula de ${matricula.alumnoNombreCompleto}?`,
      confirmText: estaActivo ? 'Sí, desactivar' : 'Sí, activar',
      cancelText: 'Cancelar',
      autoCloseMs: null
    });
  }

  confirmarCambioEstadoMatricula(): void {
    const matricula = this.matriculaPendienteCambioEstado();
    if (!matricula) {
      this.cerrarAlerta();
      return;
    }

    const estaActivo = (matricula.estado || 'ACTIVO') === 'ACTIVO';
    const nuevoActivo = !estaActivo;
    this.matriculaPendienteCambioEstado.set(null);
    this.cambiandoEstadoMatriculaId.set(matricula.id);

    this.matriculaService.actualizarEstado(matricula.id, nuevoActivo).subscribe({
      next: (actualizada) => {
        this.cambiandoEstadoMatriculaId.set(null);
        this.matriculas.update((lista) =>
          lista.map((item) =>
            item.id === matricula.id
              ? { ...item, estado: actualizada.estado || (nuevoActivo ? 'ACTIVO' : 'INACTIVO') }
              : item
          )
        );
        this.mostrarAlerta(
          'success',
          'Estado actualizado',
          `La matrícula de ${matricula.alumnoNombreCompleto} ahora está ${nuevoActivo ? 'activa' : 'inactiva'}.`,
          { autoCloseMs: 2200 }
        );
      },
      error: (err) => {
        this.cambiandoEstadoMatriculaId.set(null);
        this.mostrarAlerta(
          'error',
          'Error al cambiar estado',
          formatearMensajeError(err, 'No se pudo actualizar el estado de la matrícula.')
        );
      }
    });
  }

  cancelarCambioEstadoMatricula(): void {
    this.matriculaPendienteCambioEstado.set(null);
    this.cerrarAlerta();
  }

  cerrarAlerta(): void {
    this.alertState.set({
      open: false,
      type: 'info',
      title: '',
      message: '',
      confirmText: 'Entendido',
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
      confirmText: options?.confirmText ?? 'Entendido',
      cancelText: options?.cancelText ?? null,
      autoCloseMs: options?.autoCloseMs ?? null
    });
  }

  private normalizarAlumno(payload: AlumnoPayload): AlumnoPayload {
    const limpiar = (valor: string | null) => {
      if (valor === null) {
        return null;
      }

      const texto = valor.trim();
      return texto.length ? texto : null;
    };

    return {
      codigo: limpiar(payload.codigo),
      tipoDocumentoId: payload.tipoDocumentoId ?? 1,
      numeroDocumento: limpiar(payload.numeroDocumento),
      nombres: payload.nombres.trim(),
      apellidos: payload.apellidos.trim(),
      fechaNacimiento: limpiar(payload.fechaNacimiento),
      sexo: limpiar(payload.sexo),
      direccion: limpiar(payload.direccion),
      nombreApoderado: limpiar(payload.nombreApoderado),
      telefonoApoderado: limpiar(payload.telefonoApoderado)
    };
  }

  private normalizarNumeroDocumento(valor: string, tipoDocumento: TipoDocumento | null): string {
    const maximo = tipoDocumento?.longitud ?? 15;
    const soloNumeros = tipoDocumento?.tipo === 'NUMERICO';
    const normalizado = soloNumeros
      ? valor.replace(/\D/g, '')
      : valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return normalizado.slice(0, maximo);
  }

  private validarDocumentoAlumno(numeroDocumento: string | null, tipoDocumento: TipoDocumento | null): string | null {
    if (!numeroDocumento) {
      return 'El número de documento es obligatorio.';
    }
    if (!tipoDocumento) {
      return 'Selecciona un tipo de documento valido.';
    }
    if (tipoDocumento.longitudExacta && numeroDocumento.length !== tipoDocumento.longitud) {
      return `${tipoDocumento.descripcionCorta} debe tener exactamente ${tipoDocumento.longitud} caracteres.`;
    }
    return null;
  }
}
