import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
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
  imports: [Shell, FormsModule, RouterLink, CustomAlertComponent],
  templateUrl: './alumnos-seccion.html',
  styleUrl: './alumnos-seccion.scss'
})
export class AlumnosSeccion {
  private readonly route = inject(ActivatedRoute);
  private readonly alumnoService = inject(AlumnoService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly gradoService = inject(GradoService);
  private readonly seccionService = inject(SeccionService);
  private readonly matriculaService = inject(MatriculaService);
  private readonly tipoDocumentoService = inject(TipoDocumentoService);

  readonly currentYear = new Date().getFullYear();
  readonly periodoId = Number(this.route.snapshot.paramMap.get('periodoId'));
  readonly seccionId = Number(this.route.snapshot.paramMap.get('seccionId'));

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodo = signal<PeriodoAcademico | null>(null);
  readonly grado = signal<Grado | null>(null);
  readonly seccion = signal<Seccion | null>(null);
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

  readonly errorBase = signal<string | null>(null);
  readonly errorMatriculas = signal<string | null>(null);

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
    return periodo ? periodo.anio === this.currentYear : false;
  });

  readonly tipoDocumentoAlumno = computed(() =>
    this.tiposDocumento().find((tipo) => tipo.id === this.formAlumno().tipoDocumentoId) ?? null
  );

  readonly matriculasSeccion = computed(() =>
    this.matriculas()
      .filter((matricula) => matricula.seccionId === this.seccionId)
      .sort((a, b) => a.alumnoNombreCompleto.localeCompare(b.alumnoNombreCompleto))
  );

  readonly periodoAnterior = computed(() => {
    const actual = this.periodo();
    if (!actual) {
      return null;
    }

    return [...this.periodos()]
      .filter((periodo) => periodo.anio < actual.anio)
      .sort((a, b) => b.anio - a.anio)[0] ?? null;
  });

  constructor() {
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
            this.seccionService.listar().subscribe({
              next: (secciones) => {
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

    if (!periodoAnterior) {
      this.mostrarAlerta(
        'warning',
        'No hay período anterior',
        'No existe un período anterior disponible para esta sección.'
      );
      return;
    }

    this.cargandoPeriodoAnterior.set(true);

    this.matriculaService.listar(periodoAnterior.id, this.seccionId).subscribe({
      next: (matriculasAnteriores) => {
        if (!matriculasAnteriores.length) {
          this.cargandoPeriodoAnterior.set(false);
          this.mostrarAlerta(
            'warning',
            'Sin alumnos previos',
            'La sección no tiene alumnos cargados en el período anterior.'
          );
          return;
        }

        const alumnosActuales = new Set(this.matriculasSeccion().map((matricula) => matricula.alumnoId));
        const pendientes = matriculasAnteriores.filter(
          (matricula) => !alumnosActuales.has(matricula.alumnoId)
        );

        if (!pendientes.length) {
          this.cargandoPeriodoAnterior.set(false);
          this.mostrarAlerta(
            'info',
            'Sin cambios',
            'Los alumnos del período anterior ya fueron cargados en esta sección.'
          );
          return;
        }

        forkJoin(
          pendientes.map((matricula) =>
            this.matriculaService.crear({
              alumnoId: matricula.alumnoId,
              seccionId: this.seccionId,
              periodoAcademicoId: this.periodoId
            })
          )
        ).subscribe({
          next: () => {
            this.cargandoPeriodoAnterior.set(false);
            this.mostrarAlerta(
              'success',
              'Alumnos cargados',
              'Se cargaron los alumnos del período anterior en esta sección.'
            );
            this.cargarMatriculas();
          },
          error: (error) => {
            this.cargandoPeriodoAnterior.set(false);
            this.mostrarAlerta(
              'error',
              'No se pudieron cargar',
              formatearMensajeError(error, 'No se pudieron cargar los alumnos del período anterior.')
            );
          }
        });
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

  actualizarCampoAlumno<K extends keyof AlumnoPayload>(campo: K, valor: AlumnoPayload[K]): void {
    this.formAlumno.update((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarNumeroDocumentoAlumno(valor: string): void {
    const tipoDocumento = this.tipoDocumentoAlumno();
    const numeroDocumento = this.normalizarNumeroDocumento(valor, tipoDocumento);
    this.actualizarCampoAlumno('numeroDocumento', numeroDocumento || null);
  }

  actualizarTipoDocumentoAlumno(tipoDocumentoId: number): void {
    this.formAlumno.update((actual) => ({
      ...actual,
      tipoDocumentoId,
      numeroDocumento: null
    }));
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

  guardarAlumnoNuevo(): void {
    const payload = this.normalizarAlumno(this.formAlumno());

    if (!payload.nombres || !payload.apellidos) {
      this.mostrarAlerta(
        'warning',
        'Completa los datos',
        'Completa nombres y apellidos antes de registrar el alumno.'
      );
      return;
    }

    const errorDocumento = this.validarDocumentoAlumno(payload.numeroDocumento, this.tipoDocumentoAlumno());
    if (errorDocumento) {
      this.mostrarAlerta('warning', 'Documento no valido', errorDocumento);
      return;
    }

    this.guardandoAlumno.set(true);

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
      autoCloseMs: null
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
      return null;
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
