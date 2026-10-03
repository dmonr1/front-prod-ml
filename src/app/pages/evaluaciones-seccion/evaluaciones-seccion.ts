import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { ConfiguracionEvaluacionCursoItem } from '../../models/configuracion-evaluacion-curso';
import { Curso } from '../../models/curso';
import { Evaluacion } from '../../models/evaluacion';
import { Grado } from '../../models/grado';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { Seccion } from '../../models/seccion';
import { TipoEvaluacion } from '../../models/tipo-evaluacion';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { CursoService } from '../../services/academico/curso.service';
import { GradoService } from '../../services/academico/grado.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AuthService } from '../../services/auth/auth.service';
import { EvaluacionService } from '../../services/evaluacion/evaluacion.service';
import { PlanificacionEvaluacionService } from '../../services/evaluacion/planificacion-evaluacion.service';
import { formatearMensajeError } from '../../utils/error-formatter';

interface GrupoAsignacion {
  asignacion: AsignacionDocente;
  evaluaciones: Evaluacion[];
}

interface CursoEvaluaciones {
  id: number;
  nombre: string;
  nivel: string;
  seccion: string;
  anio: number;
  portadaColor: string;
  portadaImagen: string | null;
  portadaIcono: string;
  grupos: GrupoAsignacion[];
  evaluaciones: Evaluacion[];
  pendientes: number;
}

interface ConfiguracionEditable extends ConfiguracionEvaluacionCursoItem {
  cantidadActual: number;
}

interface FilaTipoEvaluacion {
  configuracion: ConfiguracionEditable;
  evaluaciones: Evaluacion[];
  bloqueado: boolean;
}

@Component({
  selector: 'app-evaluaciones-seccion',
  imports: [Shell, RouterLink, FormsModule, CustomAlertComponent],
  templateUrl: './evaluaciones-seccion.html',
  styleUrl: './evaluaciones-seccion.scss'
})
export class EvaluacionesSeccion {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly periodosService = inject(PeriodoAcademicoService);
  private readonly seccionesService = inject(SeccionService);
  private readonly gradosService = inject(GradoService);
  private readonly periodosEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly asignacionesService = inject(AsignacionAcademicaService);
  private readonly cursosService = inject(CursoService);
  private readonly evaluacionesService = inject(EvaluacionService);
  private readonly planificacionService = inject(PlanificacionEvaluacionService);

  readonly periodoId = Number(this.route.snapshot.paramMap.get('periodoId'));
  readonly seccionId = Number(this.route.snapshot.paramMap.get('seccionId'));
  readonly tieneGestionAdmin = this.auth.tieneGestionAdministrativa();
  readonly puedeGestionar = true;
  private readonly modificacionesLocales = new Map<number, string>();

  readonly esDocenteOExterno = computed(() => {
    const from = this.route.snapshot.queryParamMap.get('from');
    return !this.tieneGestionAdmin || from === 'mis-asignaciones' || from === 'carga-notas';
  });

  readonly rutaVolver = computed(() => {
    const from = this.route.snapshot.queryParamMap.get('from');
    let asignacionId = this.route.snapshot.queryParamMap.get('asignacionId');
    if (!asignacionId && from === 'carga-notas') {
      const match = this.asignaciones().find((a) => a.seccionId === this.seccionId && a.cursoId === this.cursoSeleccionadoId());
      if (match) {
        asignacionId = String(match.id);
      }
    }
    if (from === 'carga-notas' && asignacionId) {
      return ['/mis-asignaciones', asignacionId, 'notas'];
    }
    if (from === 'mis-asignaciones') {
      return ['/mis-asignaciones'];
    }
    if (this.esDocenteOExterno()) {
      return ['/mis-asignaciones'];
    }
    return ['/gestion-estudiantil/periodo', this.periodoId];
  });

  readonly textoVolver = computed(() => {
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'carga-notas') {
      return 'Volver al registro de notas';
    }
    if (from === 'mis-asignaciones') {
      return 'Volver a mis asignaciones';
    }
    if (this.esDocenteOExterno()) {
      return 'Volver a mis cursos';
    }
    if (this.cursoSeleccionado()) {
      return 'Volver a cursos';
    }
    return 'Volver a secciones';
  });

  readonly alertState = signal<{
    open: boolean;
    type: CustomAlertType;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string | null;
    autoCloseMs: number | null;
    action?: string | null;
    data?: any;
  }>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: null,
    autoCloseMs: null,
    action: null,
    data: null
  });

  readonly cargando = signal(true);
  readonly cargandoEvaluaciones = signal(false);
  readonly cargandoEstructura = signal(false);
  readonly guardandoEstructura = signal(false);
  readonly guardandoIds = signal<ReadonlySet<number>>(new Set());
  readonly periodo = signal<PeriodoAcademico | null>(null);
  readonly seccion = signal<Seccion | null>(null);
  readonly grado = signal<Grado | null>(null);
  readonly cursosCatalogo = signal<Curso[]>([]);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionId = signal<number | null>(null);
  readonly cursoSeleccionadoId = signal<number | null>(null);
  readonly grupos = signal<GrupoAsignacion[]>([]);
  readonly fechas = signal<Record<number, string>>({});
  readonly tiposEvaluacion = signal<TipoEvaluacion[]>([]);
  readonly configuracionesEditables = signal<ConfiguracionEditable[]>([]);
  private readonly temporizadoresFecha = new Map<number, ReturnType<typeof setTimeout>>();
  private temporizadorEstructura: ReturnType<typeof setTimeout> | null = null;

  readonly asignaciones = computed(() => this.grupos().map((grupo) => grupo.asignacion));
  readonly evaluaciones = computed(() => this.grupos().flatMap((grupo) => grupo.evaluaciones));
  readonly cursos = computed<CursoEvaluaciones[]>(() => {
    const cursos = new Map<number, CursoEvaluaciones>();
    for (const grupo of this.grupos()) {
      const cursoId = grupo.asignacion.cursoId;
      const curso = cursos.get(cursoId) ?? {
        id: cursoId,
        nombre: grupo.asignacion.curso,
        nivel: grupo.asignacion.nivel,
        seccion: `${grupo.asignacion.grado} · Sección ${grupo.asignacion.seccion}`,
        anio: grupo.asignacion.anioAcademico,
        portadaColor: this.cursosCatalogo().find((item) => item.id === cursoId)?.portadaColor || '#c96a1b',
        portadaImagen: this.cursosCatalogo().find((item) => item.id === cursoId)?.portadaImagen ?? null,
        portadaIcono: this.cursosCatalogo().find((item) => item.id === cursoId)?.portadaIcono || 'fa-solid fa-book-open',
        grupos: [],
        evaluaciones: [],
        pendientes: 0
      };
      curso.grupos.push(grupo);
      curso.evaluaciones.push(...grupo.evaluaciones);
      cursos.set(cursoId, curso);
    }
    return Array.from(cursos.values())
      .map((curso) => ({
        ...curso,
        evaluaciones: curso.evaluaciones.sort((a, b) =>
          a.tipoEvaluacion.localeCompare(b.tipoEvaluacion) || a.numeroEvaluacion - b.numeroEvaluacion
        ),
        pendientes: curso.evaluaciones.filter((item) => !item.fechaEvaluacion).length
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
  readonly cursoSeleccionado = computed(() =>
    this.cursos().find((item) => item.id === this.cursoSeleccionadoId()) ?? null
  );
  readonly asignacionCursoSeleccionado = computed(() => this.cursoSeleccionado()?.grupos[0]?.asignacion ?? null);
  readonly periodoSeleccionado = computed(() =>
    this.periodosEvaluacion().find((item) => item.id === this.periodoEvaluacionId()) ?? null
  );
  readonly estructuraModificada = computed(() => {
    const evaluaciones = this.cursoSeleccionado()?.evaluaciones ?? [];
    return this.configuracionesEditables().some((configuracion) =>
      configuracion.cantidadActual !== evaluaciones.filter((item) =>
        item.tipoEvaluacionId === configuracion.tipoEvaluacionId).length
    );
  });
  readonly modalNuevaEvaluacionAbierto = signal(false);
  readonly tipoExistenteId = signal<number | null>(null);
  readonly creandoEvaluacion = signal(false);
  readonly formNuevaEvaluacion = signal<{ nombre: string; descripcion: string; cantidad: number; fechas: string[] }>({
    nombre: '', descripcion: '', cantidad: 1, fechas: ['']
  });

  readonly totalEvaluacionesPeriodo = computed(() => this.cursoSeleccionado()?.evaluaciones.length ?? 0);
  readonly evaluacionesConFecha = computed(() => this.cursoSeleccionado()?.evaluaciones.filter((e) => !!e.fechaEvaluacion).length ?? 0);
  readonly evaluacionesPendientes = computed(() => this.cursoSeleccionado()?.pendientes ?? 0);

  readonly filasTiposEvaluacion = computed<FilaTipoEvaluacion[]>(() => {
    const evaluaciones = this.cursoSeleccionado()?.evaluaciones ?? [];
    return this.configuracionesEditables().map((configuracion) => {
      const delTipo = evaluaciones.filter((evaluacion) =>
        evaluacion.tipoEvaluacionId === configuracion.tipoEvaluacionId
      );
      return { configuracion, evaluaciones: delTipo, bloqueado: delTipo.some((item) => item.hayNotasEnCursoSeccion) };
    });
  });

  mostrarAlerta(
    type: CustomAlertType,
    title: string,
    message: string,
    optionsOrAutoClose?: number | {
      confirmText?: string;
      cancelText?: string | null;
      autoCloseMs?: number | null;
      action?: string | null;
      data?: any;
    }
  ): void {
    const opts = typeof optionsOrAutoClose === 'number'
      ? { autoCloseMs: optionsOrAutoClose }
      : (optionsOrAutoClose ?? {});

    this.alertState.set({
      open: true,
      type,
      title,
      message,
      confirmText: opts.confirmText ?? 'Aceptar',
      cancelText: opts.cancelText ?? null,
      autoCloseMs: opts.autoCloseMs ?? null,
      action: opts.action ?? null,
      data: opts.data ?? null
    });
  }

  cerrarAlerta(): void {
    this.alertState.update((prev) => ({
      ...prev,
      open: false,
      action: null,
      data: null
    }));
  }

  cancelarAlerta(): void {
    this.cerrarAlerta();
  }

  confirmarAlerta(): void {
    const { action, data } = this.alertState();
    this.cerrarAlerta();
    if (!action) return;

    if (action === 'excluir-tipo') {
      const config = data as ConfiguracionEditable;
      if (config) {
        this.actualizarCantidad(config.tipoEvaluacionId, 0);
      }
    } else if (action === 'quitar-evaluacion') {
      const evaluacion = data as Evaluacion;
      if (evaluacion) {
        this.ejecutarQuitarEvaluacion(evaluacion);
      }
    } else if (action === 'decrementar-cantidad') {
      const { tipoEvaluacionId, nuevaCantidad } = data;
      this.actualizarCantidad(tipoEvaluacionId, nuevaCantidad);
    }
  }

  constructor() {
    this.cargarBase();
  }

  cargarBase(): void {
    this.cargando.set(true);
    const usuario = this.auth.obtenerUsuario();
    const docenteId = usuario?.docenteId;
    const esDocente = !this.tieneGestionAdmin;

    const asignaciones$ = (esDocente && docenteId)
      ? this.asignacionesService.listarAsignaciones(docenteId, this.periodoId).pipe(
          catchError(() => of([] as AsignacionDocente[]))
        )
      : this.asignacionesService.listarPorPeriodo(this.periodoId).pipe(
          catchError(() => {
            if (docenteId) {
              return this.asignacionesService.listarAsignaciones(docenteId, this.periodoId).pipe(
                catchError(() => of([] as AsignacionDocente[]))
              );
            }
            return of([] as AsignacionDocente[]);
          })
        );

    forkJoin({
      periodos: this.periodosService.listar().pipe(catchError(() => of([] as PeriodoAcademico[]))),
      secciones: this.seccionesService.listar(this.periodoId).pipe(catchError(() => of([] as Seccion[]))),
      grados: this.gradosService.listar().pipe(catchError(() => of([] as Grado[]))),
      cursos: this.cursosService.listar().pipe(catchError(() => of([] as Curso[]))),
      periodosEvaluacion: this.periodosEvaluacionService.listar().pipe(catchError(() => of([] as PeriodoEvaluacion[]))),
      asignaciones: asignaciones$
    }).subscribe({
      next: ({ periodos, secciones, grados, cursos, periodosEvaluacion, asignaciones }) => {
        const periodo = periodos.find((item) => item.id === this.periodoId) ?? null;
        let seccion = secciones.find((item) => item.id === this.seccionId) ?? null;
        this.periodo.set(periodo);

        const asignacionesSeccion = asignaciones.filter((item) =>
          item.seccionId === this.seccionId && (item.estado ?? 'ACTIVO') === 'ACTIVO'
        );

        if (!seccion && asignacionesSeccion.length > 0) {
          const prim = asignacionesSeccion[0];
          seccion = {
            id: prim.seccionId,
            nombre: prim.seccion,
            gradoId: 0,
            periodoAcademicoId: prim.periodoAcademicoId
          } as Seccion;
        }
        this.seccion.set(seccion);

        let grado = grados.find((item) => item.id === seccion?.gradoId) ?? null;
        if (!grado && asignacionesSeccion.length > 0) {
          const prim = asignacionesSeccion[0];
          grado = {
            id: 0,
            nombre: prim.grado,
            orden: 1,
            nivelId: 0
          } as Grado;
        }
        this.grado.set(grado);

        this.cursosCatalogo.set(cursos);
        this.periodosEvaluacion.set(
          periodosEvaluacion
            .filter((item) => item.periodoAcademicoId === this.periodoId)
            .sort((a, b) => a.numero - b.numero)
        );

        const hoy = new Date().toISOString().slice(0, 10);
        const periodoActual = this.periodosEvaluacion().find((item) =>
          item.fechaInicio.slice(0, 10) <= hoy && hoy <= item.fechaFin.slice(0, 10)
        ) ?? this.periodosEvaluacion()[0] ?? null;

        this.periodoEvaluacionId.set(periodoActual?.id ?? null);
        this.cargando.set(false);
        this.cargarEvaluaciones(asignacionesSeccion, periodoActual?.id ?? null);
      },
      error: (error) => {
        this.cargando.set(false);
        this.mostrarAlerta('error', 'Error al cargar sección', formatearMensajeError(error, 'No se pudo cargar la planificación de la sección.'));
      }
    });
  }

  cambiarPeriodo(id: string | number): void {
    this.cancelarGuardadosFecha();
    const seleccionado = Number(id) || null;
    this.periodoEvaluacionId.set(seleccionado);
    this.cargarEvaluaciones(this.asignaciones(), seleccionado);
  }

  seleccionarCurso(cursoId: number): void {
    this.cancelarGuardadosFecha();
    this.cursoSeleccionadoId.set(cursoId);
    this.cargarEstructura(cursoId);
  }

  volverACursos(): void {
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'carga-notas' || from === 'mis-asignaciones') {
      void this.router.navigate(this.rutaVolver());
      return;
    }
    if (this.esDocenteOExterno()) {
      void this.router.navigate(this.rutaVolver());
      return;
    }
    this.cursoSeleccionadoId.set(null);
    this.configuracionesEditables.set([]);
  }

  actualizarCantidad(tipoEvaluacionId: number, valor: string | number): void {
    const fila = this.filasTiposEvaluacion().find((item) => item.configuracion.tipoEvaluacionId === tipoEvaluacionId);
    const minimo = fila?.bloqueado ? fila.evaluaciones.length : 0;
    const cantidad = Math.max(minimo, Math.min(99, Math.floor(Number(valor) || 0)));
    this.configuracionesEditables.update((actuales) => actuales.map((item) =>
      item.tipoEvaluacionId === tipoEvaluacionId ? { ...item, cantidadActual: cantidad } : item
    ));
    if (this.temporizadorEstructura) clearTimeout(this.temporizadorEstructura);
    if (!this.estructuraModificada()) {
      this.guardandoEstructura.set(false);
      return;
    }
    this.guardandoEstructura.set(true);
    this.temporizadorEstructura = setTimeout(() => {
      this.temporizadorEstructura = null;
      this.guardarEstructura();
    }, 500);
  }

  solicitarExclusion(configuracion: ConfiguracionEditable): void {
    if (this.filasTiposEvaluacion().some((fila) =>
      fila.configuracion.tipoEvaluacionId === configuracion.tipoEvaluacionId && fila.bloqueado
    )) {
      this.mostrarAlerta(
        'warning',
        'Hay notas registradas',
        'No se pueden quitar evaluaciones de este curso y sección porque ya se ingresaron notas.'
      );
      return;
    }
    if (configuracion.cantidadActual > 0) {
      const nombreTipo = this.nombreVisible(configuracion.nombreTipoEvaluacion);
      this.mostrarAlerta(
        'warning',
        '¿Quitar todas las evaluaciones?',
        `Se quitarán las ${configuracion.cantidadActual} evaluaciones de "${nombreTipo}" solo de esta sección y período. Si ya hay notas en este curso y sección, no se permitirá el cambio. ¿Deseas continuar?`,
        {
          confirmText: 'Sí, quitar todas',
          cancelText: 'Cancelar',
          action: 'excluir-tipo',
          data: configuracion
        }
      );
    }
  }

  solicitarQuitarEvaluacion(evaluacion: Evaluacion): void {
    if (evaluacion.hayNotasEnCursoSeccion) {
      this.mostrarAlerta(
        'warning',
        'Hay notas registradas',
        'No se pueden quitar evaluaciones de este curso y sección porque ya se ingresaron notas.'
      );
      return;
    }
    const nombreEval = this.nombreVisible(evaluacion.nombre);
    this.mostrarAlerta(
      'warning',
      '¿Quitar esta evaluación?',
      `"${nombreEval}" dejará de aparecer en esta sección y período. Si ya hay notas en este curso y sección, no se permitirá quitarla. ¿Deseas continuar?`,
      {
        confirmText: 'Sí, quitar',
        cancelText: 'Cancelar',
        action: 'quitar-evaluacion',
        data: evaluacion
      }
    );
  }

  ejecutarQuitarEvaluacion(evaluacion: Evaluacion): void {
    this.planificacionService.quitar(evaluacion.id).subscribe({
      next: () => {
        this.cargarEvaluaciones(this.asignaciones(), this.periodoEvaluacionId(), true);
        this.mostrarAlerta(
          'success',
          'Evaluación retirada',
          `Se quitó "${this.nombreVisible(evaluacion.nombre)}" solo de esta sección y período.`,
          2400
        );
      },
      error: (error) => {
        this.cargarEvaluaciones(this.asignaciones(), this.periodoEvaluacionId(), true);
        this.mostrarAlerta(
          'error',
          'No se pudo quitar',
          formatearMensajeError(error, 'No se pudo quitar esta evaluación.')
        );
      }
    });
  }

  incrementarCantidad(tipoEvaluacionId: number): void {
    const config = this.configuracionesEditables().find((c) => c.tipoEvaluacionId === tipoEvaluacionId);
    if (!config) return;
    this.actualizarCantidad(tipoEvaluacionId, config.cantidadActual + 1);
  }

  decrementarCantidad(tipoEvaluacionId: number): void {
    const fila = this.filasTiposEvaluacion().find((f) => f.configuracion.tipoEvaluacionId === tipoEvaluacionId);
    const config = fila?.configuracion;
    if (!config || config.cantidadActual <= 0) return;

    if (fila?.bloqueado) {
      this.mostrarAlerta(
        'warning',
        'Hay notas registradas',
        'No se puede reducir la cantidad de evaluaciones porque ya se ingresaron notas en este curso y sección.'
      );
      return;
    }

    const nuevaCantidad = config.cantidadActual - 1;
    const nombreTipo = this.nombreVisible(config.nombreTipoEvaluacion);

    if (nuevaCantidad === 0) {
      this.mostrarAlerta(
        'warning',
        '¿Reducir cantidad a 0?',
        `¿Estás seguro de reducir la cantidad a 0 para "${nombreTipo}"? Se quitarán todas las evaluaciones programadas de este tipo para el período actual.`,
        {
          confirmText: 'Sí, reducir a 0',
          cancelText: 'Cancelar',
          action: 'decrementar-cantidad',
          data: { tipoEvaluacionId, nuevaCantidad }
        }
      );
      return;
    }

    if (fila.evaluaciones.length >= config.cantidadActual) {
      this.mostrarAlerta(
        'warning',
        '¿Reducir cantidad de evaluaciones?',
        `Actualmente hay ${fila.evaluaciones.length} evaluaciones programadas de "${nombreTipo}". ¿Estás seguro de reducir la cantidad a ${nuevaCantidad}? Se retirará la última evaluación de este tipo en este período.`,
        {
          confirmText: 'Sí, reducir',
          cancelText: 'Cancelar',
          action: 'decrementar-cantidad',
          data: { tipoEvaluacionId, nuevaCantidad }
        }
      );
      return;
    }

    this.actualizarCantidad(tipoEvaluacionId, nuevaCantidad);
  }

  abrirModalCrearEvaluacion(tipoId?: number): void {
    const tipo = this.tiposEvaluacion().find((item) => item.id === tipoId);
    this.tipoExistenteId.set(tipo?.id ?? null);
    const periodo = this.periodoSeleccionado();
    this.formNuevaEvaluacion.set({
      nombre: tipo ? `${tipo.nombre} ${this.siguienteNumeroTipo(tipo.id)}` : '',
      descripcion: tipo?.descripcion ?? '',
      cantidad: 1,
      fechas: [periodo?.fechaInicio?.slice(0, 10) ?? '']
    });
    this.modalNuevaEvaluacionAbierto.set(true);
  }

  cerrarModalCrearEvaluacion(): void {
    this.modalNuevaEvaluacionAbierto.set(false);
    this.tipoExistenteId.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeModal(): void {
    if (this.modalNuevaEvaluacionAbierto()) {
      this.cerrarModalCrearEvaluacion();
    }
  }

  actualizarCantidadNuevoTipo(valor: number | string): void {
    const cantidad = Math.max(1, Math.min(99, Math.floor(Number(valor) || 1)));
    this.formNuevaEvaluacion.update((actual) => ({
      ...actual,
      cantidad,
      fechas: Array.from({ length: cantidad }, (_, index) => actual.fechas[index] ?? '')
    }));
  }

  actualizarNombreNuevoTipo(nombre: string): void {
    this.formNuevaEvaluacion.update((actual) => ({ ...actual, nombre }));
  }

  actualizarDescripcionNuevoTipo(descripcion: string): void {
    this.formNuevaEvaluacion.update((actual) => ({ ...actual, descripcion }));
  }

  actualizarFechaNuevoTipo(indice: number, fecha: string): void {
    this.formNuevaEvaluacion.update((actual) => ({
      ...actual,
      fechas: actual.fechas.map((actualFecha, i) => i === indice ? fecha : actualFecha)
    }));
  }

  confirmarCrearEvaluacion(): void {
    const form = this.formNuevaEvaluacion();
    const tipoExistente = this.tipoExistenteId();
    if (tipoExistente) {
      this.programarEvaluacionExistente(tipoExistente, form.fechas[0] ?? '');
      return;
    }
    const nombre = form.nombre.trim();
    if (!nombre) {
      this.mostrarAlerta('warning', 'Escribe el tipo', 'Ingresa el nombre del nuevo tipo de evaluación.');
      return;
    }
    const asignacion = this.asignacionCursoSeleccionado();
    if (!asignacion) return;

    const periodo = this.periodoSeleccionado();
    if (!periodo || form.fechas.length !== form.cantidad || form.fechas.some((fecha) => !fecha)) {
      this.mostrarAlerta('warning', 'Completa las fechas', 'Asigna una fecha a cada evaluación antes de continuar.');
      return;
    }
    const min = periodo.fechaInicio.slice(0, 10);
    const max = periodo.fechaFin.slice(0, 10);
    if (form.fechas.some((fecha) => fecha < min || fecha > max)) {
      this.mostrarAlerta('warning', 'Fecha fuera de rango', `Todas las fechas deben estar entre ${min} y ${max}.`);
      return;
    }
    if (this.tiposEvaluacion().some((tipo) => this.normalizarTipo(tipo.nombre) === this.normalizarTipo(nombre))) {
      this.mostrarAlerta('warning', 'El tipo ya existe', 'Usa el tipo disponible en la tabla o escribe otro nombre.');
      return;
    }
    this.creandoEvaluacion.set(true);
    this.planificacionService.crearTipo({
      asignacionId: asignacion.id,
      periodoEvaluacionId: periodo.id,
      nombre,
      descripcion: form.descripcion.trim() || null,
      fechas: form.fechas
    }).subscribe({
      next: (tipo) => {
        this.tiposEvaluacion.update((tipos) => [...tipos, tipo].sort((a, b) => a.orden - b.orden));
        this.finalizarCreacionTipo(tipo.nombre, true);
      },
      error: (error) => {
        this.creandoEvaluacion.set(false);
        this.mostrarAlerta('error', 'No se pudo crear el tipo', formatearMensajeError(error, 'No se pudo planificar este tipo de evaluación.'));
      }
    });
  }

  private programarEvaluacionExistente(tipoId: number, fecha: string): void {
    const tipo = this.tiposEvaluacion().find((item) => item.id === tipoId);
    const asignacion = this.asignacionCursoSeleccionado();
    const periodo = this.periodoSeleccionado();
    if (!tipo || !asignacion || !periodo || !fecha) {
      this.mostrarAlerta('warning', 'Completa la fecha', 'Selecciona la fecha de la nueva evaluación.');
      return;
    }
    if (fecha < periodo.fechaInicio.slice(0, 10) || fecha > periodo.fechaFin.slice(0, 10)) {
      this.mostrarAlerta('warning', 'Fecha fuera de rango', `La fecha debe estar entre ${periodo.fechaInicio.slice(0, 10)} y ${periodo.fechaFin.slice(0, 10)}.`);
      return;
    }
    this.creandoEvaluacion.set(true);
    this.planificacionService.agregar({
      asignacionId: asignacion.id,
      periodoEvaluacionId: periodo.id,
      tipoEvaluacionId: tipoId,
      fecha
    }).subscribe({
      next: () => this.finalizarCreacionTipo(tipo.nombre, false),
      error: (error) => {
        this.creandoEvaluacion.set(false);
        this.mostrarAlerta('error', 'No se pudo agregar', formatearMensajeError(error, 'No se pudo programar la evaluación.'));
      }
    });
  }

  private finalizarCreacionTipo(nombre: string, tipoNuevo: boolean): void {
    this.creandoEvaluacion.set(false);
    this.modalNuevaEvaluacionAbierto.set(false);
    this.tipoExistenteId.set(null);
    this.cargarEvaluaciones(this.asignaciones(), this.periodoEvaluacionId(), true);
    this.mostrarAlerta(
      'success',
      'Planificación guardada',
      tipoNuevo
        ? `Se creó “${nombre}” para esta sección y ${this.periodoSeleccionado()?.nombre ?? 'este período'}.`
        : `Se agregó una evaluación de “${nombre}” solo a esta sección y período.`,
      2800
    );
  }

  private siguienteNumeroTipo(tipoId: number): number {
    return (this.configuracionesEditables().find((item) => item.tipoEvaluacionId === tipoId)?.cantidadActual ?? 0) + 1;
  }

  guardarEstructura(): void {
    const asignacion = this.asignacionCursoSeleccionado();
    const periodoId = this.periodoEvaluacionId();
    const cambio = this.configuracionesEditables().find((item) =>
      item.cantidadActual !== (this.cursoSeleccionado()?.evaluaciones.filter((evaluacion) =>
        evaluacion.tipoEvaluacionId === item.tipoEvaluacionId).length ?? 0)
    );
    if (!asignacion || !periodoId || !cambio) {
      this.guardandoEstructura.set(false);
      return;
    }
    this.guardandoEstructura.set(true);
    this.planificacionService.cambiarCantidad({
      asignacionId: asignacion.id,
      periodoEvaluacionId: periodoId,
      tipoEvaluacionId: cambio.tipoEvaluacionId,
      cantidad: cambio.cantidadActual
    }).subscribe({
      next: () => {
        this.guardandoEstructura.set(false);
        this.mostrarAlerta(
          'success',
          'Estructura actualizada',
          'La cantidad de evaluaciones se guardó correctamente en esta sección y período.'
        );
        this.cargarEvaluaciones(this.asignaciones(), this.periodoEvaluacionId(), true);
      },
      error: (error) => {
        this.guardandoEstructura.set(false);
        this.configuracionesEditables.set(this.construirConfiguraciones());
        this.cargarEvaluaciones(this.asignaciones(), this.periodoEvaluacionId(), true);
        this.mostrarAlerta('error', 'No se pudo cambiar la cantidad', formatearMensajeError(error, 'No se pudo modificar la cantidad en este período.'));
      }
    });
  }

  iconoClaseTipo(nombre: string | null): string {
    const norm = this.normalizarTipo(nombre);
    if (norm.includes('examen') || norm.includes('parcial') || norm.includes('final') || norm.includes('bimestral')) {
      return 'fa-solid fa-file-lines';
    }
    if (norm.includes('practica') || norm.includes('calificada')) {
      return 'fa-solid fa-pen-ruler';
    }
    if (norm.includes('tarea') || norm.includes('trabajo') || norm.includes('domiciliaria')) {
      return 'fa-solid fa-book';
    }
    if (norm.includes('participacion') || norm.includes('oral')) {
      return 'fa-solid fa-comments';
    }
    if (norm.includes('proyecto') || norm.includes('exposicion')) {
      return 'fa-solid fa-diagram-project';
    }
    return 'fa-solid fa-clipboard-check';
  }

  iconoTipoEvaluacion(nombre: string | null): string {
    const norm = this.normalizarTipo(nombre);
    if (norm.includes('examen') || norm.includes('parcial') || norm.includes('final') || norm.includes('bimestral')) return 'type-examen';
    if (norm.includes('practica') || norm.includes('calificada')) return 'type-practica';
    if (norm.includes('tarea') || norm.includes('trabajo') || norm.includes('domiciliaria')) return 'type-tarea';
    if (norm.includes('participacion') || norm.includes('oral')) return 'type-oral';
    if (norm.includes('proyecto') || norm.includes('exposicion')) return 'type-proyecto';
    return 'type-default';
  }

  nombreVisible(nombre: string | null): string {
    return (nombre ?? '').replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, (letra) => letra.toUpperCase());
  }

  fechaEditable(evaluacion: Evaluacion): string {
    return this.fechas()[evaluacion.id] ?? evaluacion.fechaEvaluacion ?? '';
  }

  actualizarFecha(evaluacionId: number, fecha: string): void {
    this.fechas.update((actual) => ({ ...actual, [evaluacionId]: fecha }));
    const evaluacion = this.evaluaciones().find((item) => item.id === evaluacionId);
    const temporizador = this.temporizadoresFecha.get(evaluacionId);
    if (temporizador) clearTimeout(temporizador);
    this.temporizadoresFecha.delete(evaluacionId);
    if (!evaluacion) return;

    const periodo = this.periodoSeleccionado();
    const fechaValida = !!fecha && !!periodo
      && fecha >= periodo.fechaInicio.slice(0, 10)
      && fecha <= periodo.fechaFin.slice(0, 10);
    if (!fechaValida || fecha === evaluacion.fechaEvaluacion) {
      this.marcarFechaGuardando(evaluacionId, false);
      return;
    }

    this.marcarFechaGuardando(evaluacionId, true);
    this.temporizadoresFecha.set(evaluacionId, setTimeout(() => {
      this.temporizadoresFecha.delete(evaluacionId);
      this.guardarFecha(evaluacion);
    }, 450));
  }

  guardarFecha(evaluacion: Evaluacion): void {
    const fecha = this.fechaEditable(evaluacion);
    const periodo = this.periodosEvaluacion().find((item) => item.id === this.periodoEvaluacionId());
    if (!fecha || !periodo || fecha < periodo.fechaInicio.slice(0, 10) || fecha > periodo.fechaFin.slice(0, 10)) {
      this.mostrarAlerta('warning', 'Fecha fuera de rango', 'La fecha debe estar dentro del período evaluativo seleccionado.');
      return;
    }
    if (fecha === evaluacion.fechaEvaluacion) return;
    this.marcarFechaGuardando(evaluacion.id, true);
    this.evaluacionesService.actualizarFecha(evaluacion.id, fecha).subscribe({
      next: (actualizada) => {
        const usuarioActual = this.auth.obtenerUsuario()?.username || 'Usuario actual';
        this.modificacionesLocales.set(evaluacion.id, actualizada?.modificadoPor || usuarioActual);
        this.reemplazarEvaluacion(actualizada);
        this.marcarFechaGuardando(evaluacion.id, false);
      },
      error: (error) => {
        this.marcarFechaGuardando(evaluacion.id, false);
        this.mostrarAlerta('error', 'Error al guardar fecha', formatearMensajeError(error, 'No se pudo guardar la fecha.'));
      }
    });
  }

  etiquetaAuditoria(evaluacion: Evaluacion): string {
    const mod = this.obtenerModificadoPor(evaluacion);
    const creador = this.obtenerCreadoPor(evaluacion);
    return mod ? `Modificado por: ${mod}` : `Registrado por: ${creador}`;
  }

  obtenerCreadoPor(evaluacion: Evaluacion): string {
    const raw = evaluacion as any;
    return (
      evaluacion.creadoPor ||
      raw?.creado_por ||
      raw?.createdBy ||
      raw?.usuarioCreacion ||
      raw?.usuarioRegistro ||
      'Registro inicial'
    );
  }

  obtenerModificadoPor(evaluacion: Evaluacion): string | null {
    const raw = evaluacion as any;
    return (
      this.modificacionesLocales.get(evaluacion.id) ||
      evaluacion.modificadoPor ||
      raw?.modificado_por ||
      raw?.actualizadoPor ||
      raw?.actualizado_por ||
      raw?.usuarioModificacion ||
      raw?.usuarioActualizacion ||
      raw?.updatedBy ||
      null
    );
  }

  estadoGuardar(evaluacion: Evaluacion): string {
    if (this.guardandoIds().has(evaluacion.id)) return 'Guardando...';
    const fecha = this.fechaEditable(evaluacion);
    if (!fecha) return 'Selecciona una fecha';
    const periodo = this.periodoSeleccionado();
    if (periodo && (fecha < periodo.fechaInicio.slice(0, 10) || fecha > periodo.fechaFin.slice(0, 10))) {
      return 'Fuera del período';
    }
    if (fecha === evaluacion.fechaEvaluacion) return 'Al día';
    return 'No se guardó';
  }

  private cargarEvaluaciones(asignaciones: AsignacionDocente[], periodoId: number | null, silencioso = false): void {
    if (!silencioso) this.grupos.set(asignaciones.map((asignacion) => ({ asignacion, evaluaciones: [] })));
    if (!periodoId) {
      if (!silencioso) this.cargandoEvaluaciones.set(false);
      return;
    }
    if (!silencioso) this.cargandoEvaluaciones.set(true);
    const solicitudes = asignaciones.map((asignacion) =>
      this.evaluacionesService.listarEvaluaciones(asignacion.id, periodoId).pipe(
        catchError(() => of([] as Evaluacion[]))
      )
    );
    (solicitudes.length ? forkJoin(solicitudes) : of([] as Evaluacion[][])).subscribe({
      next: (resultados) => {
        this.grupos.set(asignaciones.map((asignacion, indice) => ({
          asignacion,
          evaluaciones: resultados[indice] ?? []
        })));
        if (this.cursoSeleccionadoId() && this.tiposEvaluacion().length) {
          this.configuracionesEditables.set(this.construirConfiguraciones());
        }
        this.fechas.set(Object.fromEntries(resultados.flat().map((item) => [item.id, item.fechaEvaluacion ?? ''])));
        this.cargandoEvaluaciones.set(false);
        const cursoSolicitadoId = Number(this.route.snapshot.queryParamMap.get('cursoId')) || null;
        if (cursoSolicitadoId && !this.cursoSeleccionadoId()) {
          this.seleccionarCurso(cursoSolicitadoId);
        }
      },
      error: (error) => {
        this.cargandoEvaluaciones.set(false);
        this.mostrarAlerta('error', 'Error al cargar evaluaciones', formatearMensajeError(error, 'No se pudieron cargar las evaluaciones.'));
      }
    });
  }

  private cargarEstructura(cursoId: number): void {
    this.cargandoEstructura.set(true);
    const asignacion = this.asignacionCursoSeleccionado();
    if (!asignacion) {
      this.cargandoEstructura.set(false);
      return;
    }
    this.planificacionService.listarTipos(asignacion.id).subscribe({
      next: (tipos) => {
        if (this.cursoSeleccionadoId() !== cursoId) return;
        this.tiposEvaluacion.set(tipos.filter((tipo) => tipo.estado !== 'INACTIVO')
          .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)));
        this.configuracionesEditables.set(this.construirConfiguraciones());
        this.cargandoEstructura.set(false);
      },
      error: (error) => {
        this.cargandoEstructura.set(false);
        this.mostrarAlerta('error', 'No se pudieron cargar los tipos', formatearMensajeError(error, 'No se pudo cargar la planificación de esta sección.'));
      }
    });
  }

  private construirConfiguraciones(): ConfiguracionEditable[] {
    const cursoEvals = this.cursoSeleccionado()?.evaluaciones ?? [];
    const evalsPorTipo = new Map<number, number>();
    for (const ev of cursoEvals) {
      evalsPorTipo.set(ev.tipoEvaluacionId, (evalsPorTipo.get(ev.tipoEvaluacionId) ?? 0) + 1);
    }

    return this.tiposEvaluacion().map((tipo) => ({
      tipoEvaluacionId: tipo.id,
      nombreTipoEvaluacion: tipo.nombre,
      descripcionTipoEvaluacion: tipo.descripcion,
      cantidadBasePeriodo: evalsPorTipo.get(tipo.id) ?? 0,
      cantidadEvaluaciones: evalsPorTipo.get(tipo.id) ?? 0,
      cantidadActual: evalsPorTipo.get(tipo.id) ?? 0,
      calcularEnPromedio: true
    }));
  }

  private normalizarTipo(tipo: string | null | undefined): string {
    return (tipo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ _-]/g, '').toLowerCase();
  }

  private reemplazarEvaluacion(evaluacion: Evaluacion): void {
    this.grupos.update((grupos) => grupos.map((grupo) => grupo.asignacion.id === evaluacion.docenteCursoSeccionId
      ? { ...grupo, evaluaciones: [...grupo.evaluaciones.filter((item) => item.id !== evaluacion.id), evaluacion]
        .sort((a, b) => a.tipoEvaluacion.localeCompare(b.tipoEvaluacion) || a.numeroEvaluacion - b.numeroEvaluacion) }
      : grupo));
    this.fechas.update((actual) => ({ ...actual, [evaluacion.id]: evaluacion.fechaEvaluacion ?? '' }));
  }

  private marcarFechaGuardando(evaluacionId: number, guardando: boolean): void {
    this.guardandoIds.update((actuales) => {
      const siguientes = new Set(actuales);
      if (guardando) siguientes.add(evaluacionId);
      else siguientes.delete(evaluacionId);
      return siguientes;
    });
  }

  private cancelarGuardadosFecha(): void {
    this.temporizadoresFecha.forEach((temporizador) => clearTimeout(temporizador));
    this.temporizadoresFecha.clear();
    this.guardandoIds.set(new Set());
  }
}
