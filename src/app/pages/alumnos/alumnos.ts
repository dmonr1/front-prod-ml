import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { DatePickerComponent } from '../../components/date-picker/date-picker';
import { Shell } from '../../layouts/shell/shell';
import { Curso } from '../../models/curso';
import { CursoPeriodoAcademico } from '../../models/curso-periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { CorteSeguimientoPayload } from '../../models/corte-seguimiento';
import { TipoEvaluacion } from '../../models/tipo-evaluacion';
import { CursoPeriodoAcademicoService } from '../../services/academico/curso-periodo-academico.service';
import { CursoService } from '../../services/academico/curso.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import {
  ConfiguracionEvaluacionDefaultPayload,
  PeriodoAcademicoPayload,
  PeriodoAcademicoService
} from '../../services/academico/periodo-academico.service';
import { TipoEvaluacionPayload, TipoEvaluacionService } from '../../services/evaluacion/tipo-evaluacion.service';
import { formatearMensajeError } from '../../utils/error-formatter';

type TipoPeriodoEvaluacion = 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

interface EsquemaPeriodoEvaluacion {
  tipo: TipoPeriodoEvaluacion;
  nombre: string;
  cantidad: number;
}

interface PeriodoEvaluacionBorrador {
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

interface ConfiguracionEvaluacionDefaultBorrador extends ConfiguracionEvaluacionDefaultPayload {
  nombreTipoEvaluacion: string;
  descripcionTipoEvaluacion: string | null;
  orden: number;
  seleccionado: boolean;
}

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
}

type PasoRegistroPeriodo = 1 | 2 | 3 | 4;

interface CorteSeguimientoBorrador extends CorteSeguimientoPayload {}

interface NuevoTipoEvaluacionForm {
  nombre: string;
  descripcion: string;
}

@Component({
  selector: 'app-alumnos',
  imports: [Shell, FormsModule, DatePickerComponent, CustomAlertComponent],
  templateUrl: './alumnos.html',
  styleUrl: './alumnos.scss'
})
export class Alumnos {
  private readonly router = inject(Router);
  private readonly cursoService = inject(CursoService);
  private readonly cursoPeriodoAcademicoService = inject(CursoPeriodoAcademicoService);
  private readonly periodoAcademicoService = inject(PeriodoAcademicoService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly tipoEvaluacionService = inject(TipoEvaluacionService);

  readonly currentYear = new Date().getFullYear();
  readonly esquemasPeriodoEvaluacion: EsquemaPeriodoEvaluacion[] = [
    { tipo: 'BIMESTRAL', nombre: 'Bimestral', cantidad: 4 },
    { tipo: 'TRIMESTRAL', nombre: 'Trimestral', cantidad: 3 },
    { tipo: 'SEMESTRAL', nombre: 'Semestral', cantidad: 2 },
    { tipo: 'ANUAL', nombre: 'Anual', cantidad: 1 }
  ];

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly cursos = signal<Curso[]>([]);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly tiposEvaluacion = signal<TipoEvaluacion[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly cargandoCursos = signal(true);
  readonly copiandoCursosAnteriores = signal(false);
  readonly cargandoTiposEvaluacion = signal(true);
  readonly errorPeriodos = signal<string | null>(null);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Entendido',
    cancelText: null,
    autoCloseMs: null
  });

  readonly modalPeriodoAbierto = signal(false);
  readonly guardandoPeriodo = signal(false);
  readonly cargandoDetallePeriodo = signal(false);
  readonly editandoPeriodoId = signal<number | null>(null);
  readonly pasoModalPeriodo = signal<PasoRegistroPeriodo>(1);
  readonly tipoPeriodoEvaluacion = signal<TipoPeriodoEvaluacion>('BIMESTRAL');
  readonly periodosEvaluacionBorrador = signal<PeriodoEvaluacionBorrador[]>([]);
  readonly cortesSeguimientoBorrador = signal<CorteSeguimientoBorrador[]>([]);
  readonly configuracionesEvaluacionBorrador = signal<ConfiguracionEvaluacionDefaultBorrador[]>([]);
  readonly mostrandoNuevoTipoEvaluacion = signal(false);
  readonly guardandoNuevoTipoEvaluacion = signal(false);
  readonly nuevoTipoEvaluacionForm = signal<NuevoTipoEvaluacionForm>({
    nombre: '',
    descripcion: ''
  });
  readonly cursosSeleccionadosIds = signal<number[]>([]);
  readonly filtroCursos = signal('');
  readonly formPeriodo = signal<PeriodoAcademicoPayload>({
    nombre: '',
    anio: this.currentYear,
    fechaInicio: '',
    fechaFin: '',
    tipoPeriodoEvaluacion: 'BIMESTRAL'
  });
  readonly anioCalendario = computed(() => {
    const anio = Number(this.formPeriodo().anio);
    return Number.isInteger(anio) && anio >= 2000 && anio <= 2100 ? anio : this.currentYear;
  });

  constructor() {
    this.regenerarPeriodosEvaluacionBorrador();
    this.cargarPeriodos();
    this.cargarCursos();
    this.cargarPeriodosEvaluacion();
    this.cargarTiposEvaluacion();
  }

  private ordenarPeriodos(periodos: PeriodoAcademico[]): PeriodoAcademico[] {
    return [...periodos].sort((a, b) => a.anio - b.anio || a.nombre.localeCompare(b.nombre));
  }

  cargarPeriodos(): void {
    this.cargandoPeriodos.set(true);
    this.errorPeriodos.set(null);

    this.periodoAcademicoService.listar().subscribe({
      next: (response) => {
        this.periodos.set(this.ordenarPeriodos(response));
        this.cargandoPeriodos.set(false);
      },
      error: () => {
        this.errorPeriodos.set('No se pudieron cargar los periodos academicos.');
        this.cargandoPeriodos.set(false);
      }
    });
  }

  cargarCursos(): void {
    this.cargandoCursos.set(true);

    this.cursoService.listar().subscribe({
      next: (response) => {
        const cursosActivos = response
          .filter((curso) => curso.estado !== 'INACTIVO')
          .sort(
            (a, b) =>
              a.nivelNombre.localeCompare(b.nivelNombre) ||
              a.nombre.localeCompare(b.nombre)
          );

        this.cursos.set(cursosActivos);
        this.cargandoCursos.set(false);
      },
      error: () => {
        this.cursos.set([]);
        this.cargandoCursos.set(false);
      }
    });
  }

  cargarPeriodosEvaluacion(): void {
    this.periodoEvaluacionService.listar().subscribe({
      next: (response) => {
        this.periodosEvaluacion.set(response);
      },
      error: () => {}
    });
  }

  cargarTiposEvaluacion(): void {
    this.cargandoTiposEvaluacion.set(true);

    this.tipoEvaluacionService.listar().subscribe({
      next: (response) => {
        const tiposActivos = response
          .filter((tipoEvaluacion) => tipoEvaluacion.estado !== 'INACTIVO')
          .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

        this.tiposEvaluacion.set(tiposActivos);
        this.regenerarConfiguracionesEvaluacionBorrador();
        this.cargandoTiposEvaluacion.set(false);
      },
      error: () => {
        this.tiposEvaluacion.set([]);
        this.regenerarConfiguracionesEvaluacionBorrador();
        this.cargandoTiposEvaluacion.set(false);
      }
    });
  }

  abrirPeriodo(periodoId: number): void {
    void this.router.navigate(['/gestion-estudiantil/periodo', periodoId]);
  }

  totalPeriodosEvaluacionPeriodo(periodoId: number): number {
    return this.periodosEvaluacion().filter((periodoEvaluacion) => periodoEvaluacion.periodoAcademicoId === periodoId).length;
  }

  nombreEsquemaPeriodoEvaluacion(tipo: string | null): string {
    return this.esquemasPeriodoEvaluacion.find((esquema) => esquema.tipo === tipo)?.nombre ?? 'Sin esquema';
  }

  abrirModalPeriodo(): void {
    this.editandoPeriodoId.set(null);
    this.regenerarPeriodosEvaluacionBorrador();
    this.regenerarCortesSeguimientoBorrador();
    this.regenerarConfiguracionesEvaluacionBorrador();
    this.cursosSeleccionadosIds.set([]);
    this.filtroCursos.set('');
    this.pasoModalPeriodo.set(1);
    this.modalPeriodoAbierto.set(true);
  }

  editarPeriodo(periodoAcademicoId: number, event?: Event): void {
    event?.stopPropagation();
    this.cargandoDetallePeriodo.set(true);
    this.editandoPeriodoId.set(periodoAcademicoId);
    this.modalPeriodoAbierto.set(true);
    this.pasoModalPeriodo.set(1);

    this.periodoAcademicoService.obtenerDetalle(periodoAcademicoId).subscribe({
      next: (detalle) => {
        const periodo = detalle.periodoAcademico;
        this.formPeriodo.set({
          nombre: periodo.nombre,
          anio: periodo.anio,
          fechaInicio: periodo.fechaInicio,
          fechaFin: periodo.fechaFin,
          tipoPeriodoEvaluacion: (periodo.tipoPeriodoEvaluacion ?? 'BIMESTRAL') as TipoPeriodoEvaluacion
        });
        this.tipoPeriodoEvaluacion.set((periodo.tipoPeriodoEvaluacion ?? 'BIMESTRAL') as TipoPeriodoEvaluacion);
        this.periodosEvaluacionBorrador.set(
          [...detalle.periodosEvaluacion]
            .sort((a, b) => a.numero - b.numero)
            .map((periodoEvaluacion) => ({
              numero: periodoEvaluacion.numero,
              nombre: periodoEvaluacion.nombre,
              fechaInicio: periodoEvaluacion.fechaInicio,
              fechaFin: periodoEvaluacion.fechaFin
            }))
        );
        this.cortesSeguimientoBorrador.set((detalle.cortesSeguimiento ?? []).map((corte) => ({
          semana: corte.semana,
          fechaCorte: corte.fechaCorte
        })));
        if (!this.cortesSeguimientoBorrador().length) this.regenerarCortesSeguimientoBorrador();

        const configuracionesMap = new Map(
          detalle.configuracionesEvaluacionDefault.map((configuracion) => [
            configuracion.tipoEvaluacionId,
            configuracion
          ])
        );

        this.configuracionesEvaluacionBorrador.set(
          this.tiposEvaluacion().map((tipoEvaluacion) => ({
            tipoEvaluacionId: tipoEvaluacion.id,
            nombreTipoEvaluacion: tipoEvaluacion.nombre,
            descripcionTipoEvaluacion: tipoEvaluacion.descripcion,
            orden: tipoEvaluacion.orden,
            cantidadEvaluaciones: configuracionesMap.get(tipoEvaluacion.id)?.cantidadEvaluaciones ?? 0,
            calcularEnPromedio: true,
            seleccionado: (configuracionesMap.get(tipoEvaluacion.id)?.cantidadEvaluaciones ?? 0) > 0
          }))
        );

        this.cursosSeleccionadosIds.set(detalle.cursosPeriodoAcademico.map((cursoPeriodo) => cursoPeriodo.cursoId));
        this.filtroCursos.set('');
        this.cargandoDetallePeriodo.set(false);
      },
      error: () => {
        this.cargandoDetallePeriodo.set(false);
        this.modalPeriodoAbierto.set(false);
        this.editandoPeriodoId.set(null);
        this.mostrarAlerta(
          'error',
          'No se pudo cargar',
          'No se pudo cargar el detalle del período académico.'
        );
      }
    });
  }

  cerrarModalPeriodo(): void {
    this.modalPeriodoAbierto.set(false);
    this.cargandoDetallePeriodo.set(false);
    this.editandoPeriodoId.set(null);
  }

  irAPasoModal(paso: PasoRegistroPeriodo): void {
    for (let pasoActual = this.pasoModalPeriodo(); pasoActual < paso; pasoActual += 1) {
      if (!this.validarPasoModal(pasoActual as PasoRegistroPeriodo)) {
        return;
      }
    }

    this.pasoModalPeriodo.set(paso);
  }

  siguientePasoModal(): void {
    const paso = this.pasoModalPeriodo();
    if (paso < 4 && this.validarPasoModal(paso)) {
      this.pasoModalPeriodo.set((paso + 1) as PasoRegistroPeriodo);
    }
  }

  anteriorPasoModal(): void {
    const paso = this.pasoModalPeriodo();
    if (paso > 1) {
      this.pasoModalPeriodo.set((paso - 1) as PasoRegistroPeriodo);
    }
  }

  actualizarCampoPeriodo<K extends keyof PeriodoAcademicoPayload>(
    campo: K,
    valor: PeriodoAcademicoPayload[K]
  ): void {
    this.formPeriodo.update((actual) => ({
      ...actual,
      [campo]: valor
    }));

    if (campo === 'fechaInicio' || campo === 'fechaFin') {
      this.regenerarPeriodosEvaluacionBorrador();
      if (campo === 'fechaInicio') this.regenerarCortesSeguimientoBorrador();
    }
  }

  actualizarAnioPeriodo(valor: number | string): void {
    const anio = Number(valor);
    const anioAnterior = this.formPeriodo().anio;

    this.formPeriodo.update((actual) => ({
      ...actual,
      anio,
      fechaInicio: anio === anioAnterior ? actual.fechaInicio : '',
      fechaFin: anio === anioAnterior ? actual.fechaFin : ''
    }));
    this.regenerarPeriodosEvaluacionBorrador();
    this.regenerarCortesSeguimientoBorrador();
  }

  cambiarTipoPeriodoEvaluacion(tipo: TipoPeriodoEvaluacion): void {
    this.tipoPeriodoEvaluacion.set(tipo);
    this.actualizarCampoPeriodo('tipoPeriodoEvaluacion', tipo);
    this.regenerarPeriodosEvaluacionBorrador();
  }

  actualizarFechaBorrador(index: number, campo: 'fechaInicio' | 'fechaFin', valor: string): void {
    this.periodosEvaluacionBorrador.update((actual) =>
      actual.map((periodo, i) => (i === index ? { ...periodo, [campo]: valor } : periodo))
    );
  }

  actualizarCorte(index: number, campo: 'semana' | 'fechaCorte', valor: number | string): void {
    this.cortesSeguimientoBorrador.update((actual) => actual.map((corte, i) => i === index
      ? { ...corte, [campo]: campo === 'semana' ? Number(valor) : String(valor) }
      : corte));
  }

  agregarCorteSeguimiento(): void {
    const cortes = this.cortesSeguimientoBorrador();
    const semana = Math.max(0, ...cortes.map((corte) => Number(corte.semana) || 0)) + 1;
    this.cortesSeguimientoBorrador.set([...cortes, {
      semana,
      fechaCorte: this.fechaFinSemana(semana)
    }]);
  }

  quitarCorteSeguimiento(index: number): void {
    this.cortesSeguimientoBorrador.update((actual) => actual.filter((_, i) => i !== index));
  }

  actualizarConfiguracionEvaluacionBorrador(
    tipoEvaluacionId: number,
    cambios: Partial<Pick<ConfiguracionEvaluacionDefaultBorrador, 'cantidadEvaluaciones' | 'seleccionado'>>
  ): void {
    this.configuracionesEvaluacionBorrador.update((actual) =>
      actual.map((configuracion) =>
        configuracion.tipoEvaluacionId === tipoEvaluacionId
          ? { ...configuracion, ...cambios }
          : configuracion
      )
    );
  }

  configuracionesEvaluacionSeleccionadas(): ConfiguracionEvaluacionDefaultBorrador[] {
    return this.configuracionesEvaluacionBorrador()
      .filter((configuracion) => configuracion.seleccionado)
      .sort((a, b) => a.orden - b.orden || a.nombreTipoEvaluacion.localeCompare(b.nombreTipoEvaluacion));
  }

  configuracionesEvaluacionDisponibles(): ConfiguracionEvaluacionDefaultBorrador[] {
    return this.configuracionesEvaluacionBorrador()
      .filter((configuracion) => !configuracion.seleccionado)
      .sort((a, b) => a.orden - b.orden || a.nombreTipoEvaluacion.localeCompare(b.nombreTipoEvaluacion));
  }

  agregarTipoEvaluacionBorrador(tipoEvaluacionId: number): void {
    const actual = this.configuracionesEvaluacionBorrador().find(
      (configuracion) => configuracion.tipoEvaluacionId === tipoEvaluacionId
    );

    this.actualizarConfiguracionEvaluacionBorrador(tipoEvaluacionId, {
      seleccionado: true,
      cantidadEvaluaciones: actual?.cantidadEvaluaciones && actual.cantidadEvaluaciones > 0 ? actual.cantidadEvaluaciones : 1
    });
  }

  quitarTipoEvaluacionBorrador(tipoEvaluacionId: number): void {
    this.actualizarConfiguracionEvaluacionBorrador(tipoEvaluacionId, {
      seleccionado: false,
      cantidadEvaluaciones: 0
    });
  }

  nombreTipoEvaluacionVisible(nombre: string): string {
    return nombre
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((fragmento) => fragmento.charAt(0).toUpperCase() + fragmento.slice(1))
      .join(' ');
  }

  abrirNuevoTipoEvaluacion(): void {
    this.nuevoTipoEvaluacionForm.set({
      nombre: '',
      descripcion: ''
    });
    this.mostrandoNuevoTipoEvaluacion.set(true);
  }

  cancelarNuevoTipoEvaluacion(): void {
    this.mostrandoNuevoTipoEvaluacion.set(false);
    this.guardandoNuevoTipoEvaluacion.set(false);
  }

  actualizarNuevoTipoEvaluacion<K extends keyof NuevoTipoEvaluacionForm>(
    campo: K,
    valor: NuevoTipoEvaluacionForm[K]
  ): void {
    this.nuevoTipoEvaluacionForm.update((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  guardarNuevoTipoEvaluacion(): void {
    const form = this.nuevoTipoEvaluacionForm();
    const nombre = form.nombre.trim();

    if (!nombre) {
      this.mostrarAlerta(
        'warning',
        'Falta el nombre',
        'Ingresa el nombre del nuevo tipo de evaluación.'
      );
      return;
    }

    const payload: TipoEvaluacionPayload = {
      nombre,
      descripcion: form.descripcion.trim() || null,
      orden: (this.tiposEvaluacion().at(-1)?.orden ?? 0) + 1
    };

    this.guardandoNuevoTipoEvaluacion.set(true);

    this.tipoEvaluacionService.crear(payload).subscribe({
      next: (tipoCreado) => {
        const tiposOrdenados = [...this.tiposEvaluacion(), tipoCreado]
          .filter((tipoEvaluacion) => tipoEvaluacion.estado !== 'INACTIVO')
          .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

        this.tiposEvaluacion.set(tiposOrdenados);
        this.regenerarConfiguracionesEvaluacionBorrador();
        this.mostrandoNuevoTipoEvaluacion.set(false);
        this.guardandoNuevoTipoEvaluacion.set(false);

        setTimeout(() => {
          this.agregarTipoEvaluacionBorrador(tipoCreado.id);
        });
      },
      error: (error) => {
        this.guardandoNuevoTipoEvaluacion.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudo crear',
          formatearMensajeError(error, 'No se pudo registrar el nuevo tipo de evaluación.')
        );
      }
    });
  }

  actualizarFiltroCursos(valor: string): void {
    this.filtroCursos.set(valor);
  }

  cursosFiltrados(): Curso[] {
    const filtro = this.filtroCursos().trim().toLowerCase();
    if (!filtro) {
      return this.cursos();
    }

    return this.cursos().filter((curso) =>
      curso.nombre.toLowerCase().includes(filtro) ||
      (curso.descripcion ?? '').toLowerCase().includes(filtro) ||
      curso.nivelNombre.toLowerCase().includes(filtro)
    );
  }

  cursoSeleccionado(cursoId: number): boolean {
    return this.cursosSeleccionadosIds().includes(cursoId);
  }

  alternarCurso(cursoId: number): void {
    this.cursosSeleccionadosIds.update((actual) =>
      actual.includes(cursoId)
        ? actual.filter((id) => id !== cursoId)
        : [...actual, cursoId]
    );
  }

  seleccionarTodosCursosFiltrados(): void {
    const ids = this.cursosFiltrados().map((curso) => curso.id);
    this.cursosSeleccionadosIds.update((actual) => {
      const conjunto = new Set(actual);
      ids.forEach((id) => conjunto.add(id));
      return [...conjunto];
    });
  }

  limpiarSeleccionCursos(): void {
    this.cursosSeleccionadosIds.set([]);
  }

  copiarCursosPeriodoAnterior(): void {
    const anioObjetivo = Number(this.formPeriodo().anio);
    const periodoAnterior = this.periodos()
      .filter((periodo) => periodo.anio < anioObjetivo)
      .sort((a, b) => b.anio - a.anio)[0];

    if (!periodoAnterior) {
      this.mostrarAlerta(
        'warning',
        'No hay período anterior',
        'Todavía no existe un período académico anterior desde donde copiar cursos.'
      );
      return;
    }

    this.copiandoCursosAnteriores.set(true);

    this.cursoPeriodoAcademicoService.listar(periodoAnterior.id).subscribe({
      next: (response) => {
        const cursosActivosIds = response
          .filter((cursoPeriodo: CursoPeriodoAcademico) => cursoPeriodo.estado !== 'INACTIVO')
          .map((cursoPeriodo: CursoPeriodoAcademico) => cursoPeriodo.cursoId);

        if (!cursosActivosIds.length) {
          this.copiandoCursosAnteriores.set(false);
          this.mostrarAlerta(
            'warning',
            'Sin cursos para copiar',
            'El período anterior no tiene cursos activos registrados.'
          );
          return;
        }

        this.cursosSeleccionadosIds.set([...new Set(cursosActivosIds)]);
        this.copiandoCursosAnteriores.set(false);
        this.mostrarAlerta(
          'success',
          'Cursos copiados',
          `Se seleccionaron ${cursosActivosIds.length} cursos del período ${periodoAnterior.anio}.`
        );
      },
      error: (error) => {
        this.copiandoCursosAnteriores.set(false);
        this.mostrarAlerta(
          'error',
          'No se pudo copiar',
          formatearMensajeError(error, 'No se pudieron cargar los cursos del período anterior.')
        );
      }
    });
  }

  private regenerarPeriodosEvaluacionBorrador(): void {
    const esquema = this.esquemasPeriodoEvaluacion.find((item) => item.tipo === this.tipoPeriodoEvaluacion());
    const cantidad = esquema?.cantidad ?? 4;
    const { fechaInicio, fechaFin } = this.formPeriodo();
    const rangos = this.calcularRangos(fechaInicio, fechaFin, cantidad);

    this.periodosEvaluacionBorrador.set(
      Array.from({ length: cantidad }, (_, index) => ({
        numero: index + 1,
        nombre: `Periodo ${this.numeroRomano(index + 1)}`,
        fechaInicio: rangos[index]?.fechaInicio ?? '',
        fechaFin: rangos[index]?.fechaFin ?? ''
      }))
    );
  }

  private regenerarCortesSeguimientoBorrador(): void {
    const { fechaInicio, fechaFin } = this.formPeriodo();
    if (!fechaInicio || !fechaFin) {
      this.cortesSeguimientoBorrador.set([]);
      return;
    }
    const totalSemanas = Math.ceil((this.parseDate(fechaFin).getTime() - this.parseDate(fechaInicio).getTime() + 86400000) / (7 * 86400000));
    this.cortesSeguimientoBorrador.set([5, 8].filter((semana) => semana <= totalSemanas).map((semana) => ({
      semana,
      fechaCorte: this.fechaFinSemana(semana)
    })));
  }

  private fechaFinSemana(semana: number): string {
    const { fechaInicio, fechaFin } = this.formPeriodo();
    if (!fechaInicio || !fechaFin || !Number.isInteger(semana) || semana < 1) return '';
    const date = this.parseDate(fechaInicio);
    date.setUTCDate(date.getUTCDate() + semana * 7 - 1);
    const fin = this.parseDate(fechaFin);
    return this.formatDate(date.getTime() > fin.getTime() ? fin : date);
  }

  private regenerarConfiguracionesEvaluacionBorrador(): void {
    const tipos = this.tiposEvaluacion();
    const actuales = new Map(
      this.configuracionesEvaluacionBorrador().map((configuracion) => [
        configuracion.tipoEvaluacionId,
        configuracion
      ])
    );

    this.configuracionesEvaluacionBorrador.set(
      tipos.map((tipoEvaluacion) => ({
        tipoEvaluacionId: tipoEvaluacion.id,
        nombreTipoEvaluacion: tipoEvaluacion.nombre,
        descripcionTipoEvaluacion: tipoEvaluacion.descripcion,
        orden: tipoEvaluacion.orden,
        cantidadEvaluaciones: actuales.get(tipoEvaluacion.id)?.cantidadEvaluaciones ?? 0,
        calcularEnPromedio: actuales.get(tipoEvaluacion.id)?.calcularEnPromedio ?? true,
        seleccionado: actuales.get(tipoEvaluacion.id)?.seleccionado ?? false
      }))
    );
  }

  private calcularRangos(
    fechaInicio: string,
    fechaFin: string,
    cantidad: number
  ): Pick<PeriodoEvaluacionBorrador, 'fechaInicio' | 'fechaFin'>[] {
    if (!fechaInicio || !fechaFin || cantidad < 1) {
      return [];
    }

    const inicio = this.parseDate(fechaInicio);
    const fin = this.parseDate(fechaFin);

    if (fin.getTime() < inicio.getTime()) {
      return [];
    }

    const totalDias = Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    const diasBase = Math.floor(totalDias / cantidad);
    const sobrantes = totalDias % cantidad;
    let cursor = new Date(inicio);

    return Array.from({ length: cantidad }, (_, index) => {
      const diasPeriodo = diasBase + (index < sobrantes ? 1 : 0);
      const desde = new Date(cursor);
      const hasta = new Date(cursor);
      hasta.setUTCDate(hasta.getUTCDate() + Math.max(diasPeriodo - 1, 0));
      cursor = new Date(hasta);
      cursor.setUTCDate(cursor.getUTCDate() + 1);

      return {
        fechaInicio: this.formatDate(desde),
        fechaFin: this.formatDate(hasta)
      };
    });
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private numeroRomano(numero: number): string {
    const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanos[numero - 1] ?? String(numero);
  }

  limpiarFormularioPeriodo(): void {
    this.editandoPeriodoId.set(null);
    this.formPeriodo.set({
      nombre: '',
      anio: this.currentYear,
      fechaInicio: '',
      fechaFin: '',
      tipoPeriodoEvaluacion: 'BIMESTRAL'
    });
    this.tipoPeriodoEvaluacion.set('BIMESTRAL');
    this.regenerarPeriodosEvaluacionBorrador();
    this.regenerarCortesSeguimientoBorrador();
    this.regenerarConfiguracionesEvaluacionBorrador();
    this.cursosSeleccionadosIds.set([]);
    this.filtroCursos.set('');
    this.pasoModalPeriodo.set(1);
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
      confirmText: options?.confirmText ?? 'Entendido',
      cancelText: options?.cancelText ?? null,
      autoCloseMs: null
    });
  }

  guardarPeriodo(): void {
    const payload = this.formPeriodo();

    if (!this.validarPasoModal(1)) {
      return;
    }

    const periodosEvaluacion = this.periodosEvaluacionBorrador();
    const configuracionesEvaluacion = this.configuracionesEvaluacionBorrador()
      .filter((configuracion) => configuracion.seleccionado)
      .map((configuracion) => ({
        tipoEvaluacionId: configuracion.tipoEvaluacionId,
        cantidadEvaluaciones: Number(configuracion.cantidadEvaluaciones),
        calcularEnPromedio: true
      }))
      .filter((configuracion) => configuracion.cantidadEvaluaciones > 0);

    if (!this.validarPasoModal(2)) {
      return;
    }

    if (!this.validarPasoModal(3)) {
      return;
    }

    if (!this.cursosSeleccionadosIds().length) {
      this.mostrarAlerta(
        'warning',
        'Falta cursos del período',
        'Selecciona cursos manualmente o cópialos desde el período anterior.'
      );
      return;
    }

    this.guardandoPeriodo.set(true);
    const payloadSolicitud = {
      nombre: payload.nombre.trim(),
      anio: Number(payload.anio),
      fechaInicio: payload.fechaInicio,
      fechaFin: payload.fechaFin,
      tipoPeriodoEvaluacion: this.tipoPeriodoEvaluacion(),
      periodosEvaluacion,
      cortesSeguimiento: this.cortesSeguimientoBorrador(),
      configuracionesEvaluacionDefault: configuracionesEvaluacion,
      cursosIds: this.cursosSeleccionadosIds(),
      copiarCursosPeriodoAnterior: false
    };
    const periodoEditandoId = this.editandoPeriodoId();
    const request$ = periodoEditandoId
      ? this.periodoAcademicoService.actualizarConPeriodosEvaluacion(periodoEditandoId, payloadSolicitud)
      : this.periodoAcademicoService.crearConPeriodosEvaluacion(payloadSolicitud);

    request$
      .subscribe({
        next: ({ periodoAcademico, periodosEvaluacion: creados }) => {
          this.guardandoPeriodo.set(false);
          this.periodos.update((actual) =>
            this.ordenarPeriodos([
              ...actual.filter((periodo) => periodo.id !== periodoAcademico.id),
              periodoAcademico
            ])
          );
          this.periodosEvaluacion.update((actual) => [
            ...actual.filter((periodo) => periodo.periodoAcademicoId !== periodoAcademico.id),
            ...creados
          ]);
          this.limpiarFormularioPeriodo();
          this.cerrarModalPeriodo();
          this.mostrarAlerta(
            'success',
            periodoEditandoId ? 'Período actualizado' : 'Período registrado',
            periodoEditandoId
              ? 'El período académico se actualizó correctamente.'
              : 'El período académico y sus períodos de evaluación se guardaron correctamente.'
          );
        },
        error: (error) => {
          this.guardandoPeriodo.set(false);
          this.mostrarAlerta(
            'error',
            'No se pudo guardar',
            formatearMensajeError(error, 'No se pudo registrar el período académico.')
          );
        }
      });
  }

  private validarPasoModal(paso: PasoRegistroPeriodo): boolean {
    const payload = this.formPeriodo();

    if (paso === 1) {
      if (!payload.nombre.trim() || !payload.anio || !payload.fechaInicio || !payload.fechaFin) {
        this.mostrarAlerta(
          'warning',
          'Completa los datos',
          'Completa nombre, año, fecha de inicio y fecha de fin.'
        );
        return false;
      }

      const anio = Number(payload.anio);
      if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
        this.mostrarAlerta('warning', 'Año no válido', 'Ingresa un año entre 2000 y 2100.');
        return false;
      }

      const inicio = this.parseDate(payload.fechaInicio);
      const fin = this.parseDate(payload.fechaFin);
      if (inicio.getUTCFullYear() !== anio || fin.getUTCFullYear() !== anio) {
        this.mostrarAlerta(
          'warning',
          'Fechas fuera del año',
          `Las fechas de inicio y fin deben pertenecer al año ${anio}.`
        );
        return false;
      }

      if (fin.getTime() < inicio.getTime()) {
        this.mostrarAlerta('warning', 'Rango de fechas no válido', 'La fecha de fin debe ser posterior a la fecha de inicio.');
        return false;
      }
    }

    if (paso === 2) {
      const inicioPeriodo = this.parseDate(payload.fechaInicio).getTime();
      const finPeriodo = this.parseDate(payload.fechaFin).getTime();
      const borradores = this.periodosEvaluacionBorrador();

      if (!borradores.length || borradores.some((periodo) => !periodo.fechaInicio || !periodo.fechaFin)) {
        this.mostrarAlerta(
          'warning',
          'Faltan períodos de evaluación',
          'Configura las fechas de todos los períodos de evaluación.'
        );
        return false;
      }

      const rangoInvalido = borradores.some((periodo) => {
        const inicio = this.parseDate(periodo.fechaInicio).getTime();
        const fin = this.parseDate(periodo.fechaFin).getTime();
        return inicio < inicioPeriodo || fin > finPeriodo || fin < inicio;
      });

      if (rangoInvalido) {
        this.mostrarAlerta(
          'warning',
          'Períodos de evaluación no válidos',
          'Cada período de evaluación debe estar dentro del período académico y tener un rango de fechas válido.'
        );
        return false;
      }

      const cortes = this.cortesSeguimientoBorrador();
      const semanas = cortes.map((corte) => Number(corte.semana));
      const fechaFinAcademica = this.parseDate(payload.fechaFin);
      const cortesInvalidos = !cortes.length || cortes.some((corte) => {
        const semana = Number(corte.semana);
        if (!Number.isInteger(semana) || semana < 1 || !corte.fechaCorte) return true;
        const inicioSemana = this.parseDate(payload.fechaInicio);
        inicioSemana.setUTCDate(inicioSemana.getUTCDate() + (semana - 1) * 7);
        const finSemana = new Date(inicioSemana);
        finSemana.setUTCDate(finSemana.getUTCDate() + 6);
        const fechaCorte = this.parseDate(corte.fechaCorte);
        return inicioSemana > fechaFinAcademica || fechaCorte < inicioSemana || fechaCorte > finSemana || fechaCorte > fechaFinAcademica;
      });
      if (cortesInvalidos || new Set(semanas).size !== semanas.length) {
        this.mostrarAlerta('warning', 'Cortes semanales no válidos',
          'Configura al menos un corte, con semanas únicas y una fecha dentro de su semana y del período académico.');
        return false;
      }
    }

    if (paso === 3 && !this.configuracionesEvaluacionBorrador().some(
      (configuracion) => configuracion.seleccionado && Number(configuracion.cantidadEvaluaciones) > 0
    )) {
      this.mostrarAlerta(
        'warning',
        'Falta la plantilla anual',
        'Configura al menos un tipo de evaluación con cantidad mayor a cero.'
      );
      return false;
    }

    return true;
  }
}
