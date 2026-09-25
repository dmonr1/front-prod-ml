import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { AsistenciaSesion, EstadoAsistenciaSesion, EstadoAsistenciaSesionResumen } from '../../models/asistencia-sesion';
import { HorarioSemanal, DiaSemana } from '../../models/horario';
import { Matricula } from '../../models/matricula';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { AuthService } from '../../services/auth/auth.service';
import { HorarioService } from '../../services/academico/horario.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
import { MatriculaService } from '../../services/academico/matricula.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { AsistenciaSesionService } from '../../services/evaluacion/asistencia-sesion.service';
import { formatearMensajeError } from '../../utils/error-formatter';

interface FilaAsistencia {
  matricula: Matricula;
  estado: EstadoAsistenciaSesion | '';
  observacion: string;
}

interface SesionProgramada {
  horario: HorarioSemanal;
  fecha: string;
  periodo: PeriodoEvaluacion | null;
  esHoy: boolean;
  esPasada: boolean;
  horaFin: string;
  bloques: number;
}

interface AlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
}

@Component({
  selector: 'app-asistencia-sesion',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './asistencia-sesion.html',
  styleUrl: './asistencia-sesion.scss'
})
export class AsistenciaSesionPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly periodosService = inject(PeriodoAcademicoService);
  private readonly horariosService = inject(HorarioService);
  private readonly asignacionesService = inject(AsignacionAcademicaService);
  private readonly periodosEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly matriculasService = inject(MatriculaService);
  private readonly asistenciaService = inject(AsistenciaSesionService);

  readonly dias: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
  readonly nombresDias: Record<DiaSemana, string> = {
    LUNES: 'Lunes',
    MARTES: 'Martes',
    MIERCOLES: 'Miércoles',
    JUEVES: 'Jueves',
    VIERNES: 'Viernes',
    SABADO: 'Sábado',
    DOMINGO: 'Domingo'
  };

  readonly estados: { value: EstadoAsistenciaSesion; label: string; icon: string; tono: string }[] = [
    { value: 'PRESENTE', label: 'Presente', icon: 'fa-solid fa-check', tono: 'success' },
    { value: 'TARDANZA', label: 'Tardanza', icon: 'fa-solid fa-clock', tono: 'warning' },
    { value: 'AUSENTE', label: 'Ausente', icon: 'fa-solid fa-xmark', tono: 'danger' },
    { value: 'JUSTIFICADO', label: 'Justificado', icon: 'fa-solid fa-shield', tono: 'info' }
  ];

  readonly vista = signal<'agenda' | 'lista'>('agenda');
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly alertState = signal<AlertState>({ open: false, type: 'info', title: '', message: '' });

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodoAcademico = signal<PeriodoAcademico | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly horarios = signal<HorarioSemanal[]>([]);
  readonly resumenAsistencia = signal<Map<string, EstadoAsistenciaSesionResumen>>(new Map());

  // Filtros de navegación
  readonly modoVista = signal<'semana' | 'periodo' | 'anio'>('semana');
  readonly periodoEvaluacionFiltroId = signal<number | null>(null);
  readonly asignacionFiltroId = signal<number | null>(null);
  readonly semanaInicio = signal('');

  // Sesión activa para toma de asistencia
  readonly fecha = signal('');
  readonly asignacionId = signal<number | null>(null);
  readonly horarioSemanalId = signal<number | null>(null);
  readonly periodoId = signal<number | null>(null);
  readonly filas = signal<FilaAsistencia[]>([]);
  readonly edicionHistorica = signal(false);
  readonly motivoEdicion = signal('');
  readonly asistenciaExistente = signal(false);
  readonly busquedaEstudiante = signal('');

  readonly asignacionSeleccionada = computed(() =>
    this.asignaciones().find((item) => item.id === this.asignacionId()) ?? null
  );

  readonly horarioSeleccionado = computed(() =>
    this.horarios().find((item) => item.id === this.horarioSemanalId()) ?? null
  );

  readonly periodoSeleccionado = computed(() =>
    this.periodosEvaluacion().find((item) => item.id === this.periodoId()) ?? null
  );

  readonly puedeEditarHistorico = computed(() => {
    const usuario = this.auth.obtenerUsuario();
    return this.auth.tieneGestionAdministrativa() || (usuario?.roles.includes('DOCENTE_TUTOR') ?? false);
  });

  readonly soloLectura = computed(() =>
    (!this.puedeRegistrarHoy() || this.asistenciaExistente()) && !this.edicionHistorica()
  );

  readonly etiquetaSemana = computed(() => {
    if (!this.semanaInicio()) return '';
    return `${this.formatoFechaCorta(this.semanaInicio())} – ${this.formatoFechaCorta(this.sumarDias(this.semanaInicio(), 6))}`;
  });

  readonly puedeAnterior = computed(() => {
    const inicio = this.semanaInicio();
    const lunesPer = this.lunesPeriodo();
    return inicio > lunesPer;
  });

  readonly puedeSiguiente = computed(() => {
    const finSemana = this.sumarDias(this.semanaInicio(), 6);
    const finPeriodo = this.periodoAcademico()?.fechaFin ?? '';
    return finSemana < finPeriodo;
  });

  readonly periodosEvaluacionDisponibles = computed(() => {
    const hoy = this.fechaLocalHoy();
    const disponibles = this.periodosEvaluacion().filter((item) => item.fechaFin >= hoy);
    return disponibles.length ? disponibles : this.periodosEvaluacion().slice(-1);
  });

  readonly sesiones = computed(() => {
    const periodo = this.periodoAcademico();
    if (!periodo) return [];

    const modo = this.modoVista();
    const evalId = this.periodoEvaluacionFiltroId();
    const asigId = this.asignacionFiltroId();
    const hoyStr = this.fechaLocalHoy();

    let fechaInicioRange: string;
    let fechaFinRange: string;

    if (modo === 'semana') {
      fechaInicioRange = this.semanaInicio();
      fechaFinRange = this.sumarDias(this.semanaInicio(), 6);
    } else if (modo === 'periodo') {
      const periodoEval = this.periodosEvaluacion().find((p) => p.id === evalId)
        ?? this.periodosEvaluacion()[0];
      if (periodoEval) {
        fechaInicioRange = periodoEval.fechaInicio;
        fechaFinRange = periodoEval.fechaFin;
      } else {
        fechaInicioRange = periodo.fechaInicio;
        fechaFinRange = periodo.fechaFin;
      }
    } else {
      // Todo el año académico
      fechaInicioRange = periodo.fechaInicio;
      fechaFinRange = periodo.fechaFin;
    }

    const horariosFiltrados = (asigId
      ? this.horarios().filter((h) => h.asignacionId === asigId)
      : this.horarios()).filter((h) => this.dias.includes(h.diaSemana));

    const sesiones: SesionProgramada[] = [];
    const cursor = this.parseFecha(fechaInicioRange);
    const fin = this.parseFecha(fechaFinRange);

    while (cursor <= fin) {
      const fechaStr = this.fechaKey(cursor);
      const diaIndex = (cursor.getDay() + 6) % 7;
      const diaSemana = this.dias[diaIndex];

      if (!diaSemana) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      const horariosDelDia = horariosFiltrados.filter((h) => h.diaSemana === diaSemana)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
      for (let i = 0; i < horariosDelDia.length; i++) {
        const horario = horariosDelDia[i];
        let horaFin = horario.horaFin;
        let bloques = 1;
        while (i + 1 < horariosDelDia.length
          && horariosDelDia[i + 1].asignacionId === horario.asignacionId
          && horariosDelDia[i + 1].horaInicio === horaFin) {
          i++;
          horaFin = horariosDelDia[i].horaFin;
          bloques++;
        }
        const periodoEval = this.periodosEvaluacion()
          .find((item) => item.periodoAcademicoId === periodo.id && fechaStr >= item.fechaInicio && fechaStr <= item.fechaFin) ?? null;

        sesiones.push({
          horario,
          fecha: fechaStr,
          periodo: periodoEval,
          esHoy: fechaStr === hoyStr,
          esPasada: fechaStr < hoyStr,
          horaFin,
          bloques
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return sesiones.sort((a, b) => {
      const fComp = a.fecha.localeCompare(b.fecha);
      if (fComp !== 0) return fComp;
      return a.horario.horaInicio.localeCompare(b.horario.horaInicio);
    });
  });

  readonly busquedaSesion = signal('');

  readonly sesionesFiltradas = computed(() => {
    const q = this.busquedaSesion().toLowerCase().trim();
    const lista = this.sesiones();
    if (!q) return lista;
    return lista.filter((s) =>
      s.horario.curso.toLowerCase().includes(q) ||
      s.horario.seccion.toLowerCase().includes(q) ||
      s.horario.grado.toLowerCase().includes(q) ||
      s.fecha.includes(q) ||
      this.nombreDia(s.fecha).toLowerCase().includes(q)
    );
  });

  readonly statsSesiones = computed(() => {
    const lista = this.sesiones();
    const hoyStr = this.fechaLocalHoy();
    const hoy = lista.filter((s) => s.fecha === hoyStr).length;
    const pasadas = lista.filter((s) => s.fecha < hoyStr).length;
    const futuras = lista.filter((s) => s.fecha > hoyStr).length;
    return {
      total: lista.length,
      hoy,
      pasadas,
      futuras
    };
  });

  readonly filasFiltradas = computed(() => {
    const q = this.busquedaEstudiante().toLowerCase().trim();
    if (!q) return this.filas();
    return this.filas().filter((f) =>
      f.matricula.alumnoNombreCompleto.toLowerCase().includes(q) ||
      (f.matricula.codigoAlumno && f.matricula.codigoAlumno.toLowerCase().includes(q))
    );
  });

  readonly resumen = computed(() => {
    const filas = this.filas();
    const total = filas.length;
    const presentes = filas.filter((f) => f.estado === 'PRESENTE').length;
    const ausentes = filas.filter((f) => f.estado === 'AUSENTE').length;
    const tardanzas = filas.filter((f) => f.estado === 'TARDANZA').length;
    const justificados = filas.filter((f) => f.estado === 'JUSTIFICADO').length;
    const porcentaje = total > 0 ? Math.round(((presentes + tardanzas) / total) * 100) : 0;

    return {
      total,
      presentes,
      ausentes,
      tardanzas,
      justificados,
      porcentaje
    };
  });

  readonly faltantesPorMarcar = computed(() =>
    this.filas().filter((f) => !f.estado).length
  );

  readonly puedeGuardar = computed(() =>
    this.filas().length > 0 &&
    this.filas().every((fila) => !!fila.estado) &&
    !this.guardando() &&
    !this.cargando() &&
    !!this.periodoSeleccionado() &&
    (this.edicionHistorica()
      ? this.puedeEditarHistorico() && this.motivoEdicion().trim().length >= 5
      : this.puedeRegistrarHoy() && !this.asistenciaExistente())
  );

  ngOnInit(): void {
    const usuario = this.auth.obtenerUsuario();
    const docenteId = usuario?.docenteId;
    const puedeVerTodas = this.auth.tieneGestionAdministrativa();
    if (!docenteId && !puedeVerTodas) {
      this.mostrarAlerta('error', 'Acceso no disponible', 'Tu usuario no tiene un docente vinculado.');
      this.cargando.set(false);
      return;
    }

    forkJoin({
      periodos: this.periodosService.listar(),
      evaluaciones: this.periodosEvaluacionService.listar()
    }).subscribe({
      next: ({ periodos, evaluaciones }) => {
        const periodo = periodos.find((item) => item.estado === 'ACTIVO')
          ?? periodos.find((item) => item.anio === new Date().getFullYear())
          ?? periodos[0];

        if (!periodo) {
          this.mostrarAlerta('warning', 'No hay período académico', 'No se encontró un período académico activo.');
          this.cargando.set(false);
          return;
        }

        this.periodos.set(periodos);
        this.periodoAcademico.set(periodo);
        const evaluacionesDelPeriodo = evaluaciones
          .filter((item) => item.periodoAcademicoId === periodo.id)
          .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
        this.periodosEvaluacion.set(evaluacionesDelPeriodo);

        // Periodo de evaluación por defecto
        const hoy = this.fechaLocalHoy();
        const evalActual = evaluacionesDelPeriodo.find((e) => hoy >= e.fechaInicio && hoy <= e.fechaFin)
          ?? evaluacionesDelPeriodo.find((e) => e.fechaFin >= hoy)
          ?? evaluacionesDelPeriodo.at(-1)
          ?? null;
        if (evalActual) {
          this.periodoEvaluacionFiltroId.set(evalActual.id);
        }

        this.semanaInicio.set(this.lunesDe(this.fechaDentroDelPeriodo(periodo.fechaInicio, periodo.fechaFin)));

        forkJoin({
          asignaciones: puedeVerTodas
            ? this.asignacionesService.listarPorPeriodo(periodo.id)
            : this.asignacionesService.listarAsignaciones(docenteId!, periodo.id),
          horarios: puedeVerTodas
            ? this.horariosService.listar(periodo.id)
            : this.horariosService.listarMios(periodo.id)
        }).subscribe({
          next: ({ asignaciones, horarios }) => {
            const activas = asignaciones.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
            const ids = new Set(activas.map((item) => item.id));
            this.asignaciones.set(activas);
            this.horarios.set(horarios.filter((item) => ids.has(item.asignacionId)));
            this.resumenAsistencia.set(new Map());
            if (!activas.length) {
              this.terminarCargaInicial();
              return;
            }
            this.asistenciaService.resumir(activas.map((item) => item.id), periodo.fechaInicio, periodo.fechaFin).subscribe({
              next: (resumen) => {
                this.resumenAsistencia.set(new Map(resumen.map((item) => [this.claveSesion(item.asignacionId, item.horarioSemanalId, item.fechaClase), item])));
                this.terminarCargaInicial();
              },
              error: () => this.terminarCargaInicial()
            });
          },
          error: (error) => this.mostrarError(error, 'No se pudieron cargar tus clases programadas.')
        });
      },
      error: (error) => this.mostrarError(error, 'No se pudo cargar el período académico vigente.')
    });
  }

  cambiarModoVista(modo: 'semana' | 'periodo' | 'anio'): void {
    this.modoVista.set(modo);
  }

  semanaAnterior(): void {
    if (this.puedeAnterior()) {
      this.semanaInicio.update((value) => this.sumarDias(value, -7));
    }
  }

  semanaSiguiente(): void {
    if (this.puedeSiguiente()) {
      this.semanaInicio.update((value) => this.sumarDias(value, 7));
    }
  }

  irASemanaActual(): void {
    const periodo = this.periodoAcademico();
    if (!periodo) return;
    this.semanaInicio.set(this.lunesDe(this.fechaDentroDelPeriodo(periodo.fechaInicio, periodo.fechaFin)));
  }

  abrirSesion(asignacionId: number, fecha: string, horarioSemanalId: number | null = null, editar = false): void {
    const asignacion = this.asignaciones().find((item) => item.id === asignacionId);
    const dia = (this.parseFecha(fecha).getDay() + 6) % 7;

    if (!horarioSemanalId) {
      const candidatos = this.horarios().filter((item) => item.asignacionId === asignacionId && this.dias.indexOf(item.diaSemana) === dia);
      if (candidatos.length !== 1) {
        this.mostrarAlerta('warning', 'Selecciona una sesión', 'Abre la clase desde la agenda para identificar su bloque horario.');
        return;
      }
      horarioSemanalId = candidatos[0].id;
    }

    const horario = this.horarios().find((item) => item.id === horarioSemanalId) ?? null;
    const periodo = this.periodosEvaluacion().find(
      (item) => item.periodoAcademicoId === asignacion?.periodoAcademicoId && fecha >= item.fechaInicio && fecha <= item.fechaFin
    );

    if (!asignacion) {
      this.mostrarAlerta('error', 'Clase no disponible', 'La clase seleccionada no pertenece a tus asignaciones activas.');
      return;
    }
    if (!horario || horario.asignacionId !== asignacionId || this.dias.indexOf(horario.diaSemana) !== dia) {
      this.mostrarAlerta('warning', 'La sesión cambió', 'La fecha ya no coincide con la programación seleccionada.');
      return;
    }
    if (!periodo) {
      this.mostrarAlerta('warning', 'Sin período de evaluación', 'No hay un período de evaluación configurado para la fecha de esta clase.');
      return;
    }

    this.asignacionId.set(asignacionId);
    this.horarioSemanalId.set(horarioSemanalId);
    this.fecha.set(fecha);
    this.periodoId.set(periodo.id);
    this.edicionHistorica.set(editar && this.puedeEditarHistorico());
    this.motivoEdicion.set('');
    this.asistenciaExistente.set(false);
    this.vista.set('lista');
    this.busquedaEstudiante.set('');
    this.cargarLista();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        asignacionId,
        fecha,
        horarioId: horarioSemanalId,
        ...(editar ? { editar: 'true' } : { editar: null })
      },
      queryParamsHandling: 'merge'
    });
  }

  volverAgenda(): void {
    this.vista.set('agenda');
    this.filas.set([]);
    this.asignacionId.set(null);
    this.horarioSemanalId.set(null);
    this.fecha.set('');
    this.periodoId.set(null);
    this.edicionHistorica.set(false);
    this.asistenciaExistente.set(false);
    this.cerrarAlerta();
    this.busquedaEstudiante.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        asignacionId: null,
        fecha: null,
        horarioId: null,
        editar: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  cambiarEstado(matriculaId: number, estado: EstadoAsistenciaSesion): void {
    if (this.soloLectura()) return;
    this.filas.update((filas) =>
      filas.map((fila) => fila.matricula.id === matriculaId ? { ...fila, estado } : fila)
    );
  }

  cambiarObservacion(matriculaId: number, observacion: string): void {
    if (this.soloLectura()) return;
    this.filas.update((filas) =>
      filas.map((fila) => fila.matricula.id === matriculaId ? { ...fila, observacion } : fila)
    );
  }

  marcarTodos(estado: EstadoAsistenciaSesion): void {
    if (this.soloLectura()) return;
    this.filas.update((filas) => filas.map((fila) => ({ ...fila, estado })));
  }

  limpiarTodos(): void {
    if (this.soloLectura()) return;
    this.filas.update((filas) => filas.map((fila) => ({ ...fila, estado: '' as EstadoAsistenciaSesion })));
  }

  actualizarPeriodoFiltro(val: string): void {
    this.periodoEvaluacionFiltroId.set(val ? Number(val) : null);
  }

  actualizarAsignacionFiltro(val: string): void {
    this.asignacionFiltroId.set(val ? Number(val) : null);
  }

  limpiarBusquedaEstudiante(): void {
    this.busquedaEstudiante.set('');
  }

  limpiarBusquedaSesion(): void {
    this.busquedaSesion.set('');
  }

  cargarLista(): void {
    const asignacion = this.asignacionSeleccionada();
    const periodo = this.periodoSeleccionado();
    const fecha = this.fecha();

    if (!asignacion || !periodo || !fecha) {
      this.filas.set([]);
      return;
    }

    this.cargando.set(true);
    this.cerrarAlerta();

    forkJoin({
      matriculas: this.matriculasService.listar(asignacion.periodoAcademicoId, asignacion.seccionId),
      registros: this.asistenciaService.listar(asignacion.id, periodo.id, fecha, this.horarioSemanalId())
    }).subscribe({
      next: ({ matriculas, registros }) => {
        this.asistenciaExistente.set(registros.length > 0);
        const guardados = new Map<number, AsistenciaSesion>(registros.map((item) => [item.matriculaId, item]));
        this.filas.set(
          matriculas.map((matricula) => {
            const guardado = guardados.get(matricula.id);
            return {
              matricula,
              estado: guardado?.estado ?? '',
              observacion: guardado?.observacion ?? ''
            };
          })
        );
        this.cargando.set(false);
        if (this.soloLectura()) {
          this.mostrarAlerta(
            'info',
            this.asistenciaExistente() ? 'Asistencia ya registrada' : 'Plazo de registro finalizado',
            this.asistenciaExistente()
              ? 'La asistencia está guardada y se muestra en modo de consulta.'
              : 'Esta sesión ya pasó. Solo el tutor asignado, dirección académica o administración pueden registrar una corrección.'
          );
        }
      },
      error: (error) => this.mostrarError(error, 'No se pudo cargar la lista de asistencia.')
    });
  }

  guardar(): void {
    const asignacion = this.asignacionSeleccionada();
    const periodo = this.periodoSeleccionado();

    if (!asignacion || !periodo || !this.puedeGuardar()) return;

    this.guardando.set(true);
    this.cerrarAlerta();

    const payload = {
      docenteCursoSeccionId: asignacion.id,
      horarioSemanalId: this.horarioSemanalId()!,
      periodoEvaluacionId: periodo.id,
      fechaClase: this.fecha(),
      asistencias: this.filas().map((fila) => ({
        matriculaId: fila.matricula.id,
        estado: fila.estado as EstadoAsistenciaSesion,
        observacion: fila.observacion.trim() || null
      }))
    };
    const solicitud = this.edicionHistorica()
      ? this.asistenciaService.editar({ ...payload, motivoEdicion: this.motivoEdicion().trim() })
      : this.asistenciaService.guardar(payload);
    solicitud.subscribe({
      next: (registros) => {
        const fueEdicion = this.edicionHistorica();
        const guardados = new Map<number, AsistenciaSesion>(registros.map((item) => [item.matriculaId, item]));
        this.filas.update((filas) =>
          filas.map((fila) => {
            const actualizado = guardados.get(fila.matricula.id);
            return actualizado ? { ...fila, estado: actualizado.estado, observacion: actualizado.observacion ?? '' } : fila;
          })
        );
        const horarioId = this.horarioSemanalId()!;
        const fechaClase = this.fecha();
        const resumenActualizado: EstadoAsistenciaSesionResumen = {
          asignacionId: asignacion.id,
          horarioSemanalId: horarioId,
          fechaClase,
          registradas: new Set(registros.map((item) => item.matriculaId)).size,
          total: this.filas().length
        };
        this.resumenAsistencia.update((resumen) => {
          const actualizado = new Map(resumen);
          actualizado.set(this.claveSesion(asignacion.id, horarioId, fechaClase), resumenActualizado);
          return actualizado;
        });
        this.guardando.set(false);
        this.asistenciaExistente.set(true);
        this.edicionHistorica.set(false);
        this.motivoEdicion.set('');
        const mensaje = `${fueEdicion ? 'Se corrigió' : 'Se registró'} la asistencia para el ${this.formatoFecha(fechaClase)}.`;
        this.volverAgenda();
        this.mostrarAlerta('success', fueEdicion ? 'Asistencia corregida' : 'Asistencia registrada', mensaje);
      },
      error: (error) => {
        this.guardando.set(false);
        this.mostrarError(error, 'No se pudo guardar la asistencia.');
      }
    });
  }

  iniciarEdicionHistorica(): void {
    if (!this.puedeEditarHistorico()) return;
    this.edicionHistorica.set(true);
    this.cerrarAlerta();
  }

  esFechaPasada(): boolean {
    return !!this.fecha() && this.fecha() < this.fechaLocalHoy();
  }

  puedeRegistrarHoy(): boolean {
    return !!this.fecha() && this.fecha() === this.fechaLocalHoy();
  }

  resumenSesion(sesion: SesionProgramada): EstadoAsistenciaSesionResumen | null {
    return this.resumenAsistencia().get(this.claveSesion(
      sesion.horario.asignacionId, sesion.horario.id, sesion.fecha
    )) ?? null;
  }

  tieneAsistencia(sesion: SesionProgramada): boolean {
    return (this.resumenSesion(sesion)?.registradas ?? 0) > 0;
  }

  puedeRegistrarSesion(sesion: SesionProgramada): boolean {
    return !!sesion.periodo && sesion.esHoy && !this.tieneAsistencia(sesion)
      && (this.resumenSesion(sesion)?.total ?? 0) > 0;
  }

  estadoSesion(sesion: SesionProgramada): string {
    const resumen = this.resumenSesion(sesion);
    if (resumen && resumen.total > 0 && resumen.registradas >= resumen.total) {
      return `Registrada · ${resumen.registradas}/${resumen.total}`;
    }
    if (resumen) return `Parcial · ${resumen.registradas}/${resumen.total}`;
    return sesion.esPasada ? 'Pendiente' : sesion.esHoy ? 'Pendiente de registro' : 'Programada';
  }

  claseEstadoSesion(sesion: SesionProgramada): string {
    const resumen = this.resumenSesion(sesion);
    if (resumen && resumen.total > 0 && resumen.registradas >= resumen.total) return 'is-done';
    if (resumen) return 'is-partial';
    return sesion.esPasada ? 'is-pending' : 'is-scheduled';
  }

  private claveSesion(asignacionId: number, horarioId: number, fecha: string): string {
    return `${asignacionId}:${horarioId}:${fecha}`;
  }

  private terminarCargaInicial(): void {
    this.cargando.set(false);
    const params = this.route.snapshot.queryParamMap;
    const asignacionId = Number(params.get('asignacionId'));
    const fecha = params.get('fecha') ?? '';
    const horarioSemanalId = Number(params.get('horarioId')) || null;
    const editar = params.get('editar') === 'true';
    if (asignacionId && fecha) this.abrirSesion(asignacionId, fecha, horarioSemanalId, editar);
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'AL';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    return partes[0].slice(0, 2).toUpperCase();
  }

  limpiarHora(hora: string): string {
    if (!hora) return '';
    const p = hora.split(':');
    return p.length >= 2 ? `${p[0]}:${p[1]}` : hora;
  }

  nombreDia(fecha: string): string {
    const indice = (this.parseFecha(fecha).getDay() + 6) % 7;
    return this.nombresDias[this.dias[indice]];
  }

  formatoFecha(fecha: string): string {
    return this.parseFecha(fecha).toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  formatoFechaCapitalizada(fecha: string): string {
    const txt = this.formatoFecha(fecha);
    return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : '';
  }

  formatoFechaCorta(fecha: string): string {
    return this.parseFecha(fecha).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short'
    });
  }

  formatoDiaNumero(fecha: string): string {
    return String(this.parseFecha(fecha).getDate());
  }

  formatoMesCorto(fecha: string): string {
    return this.parseFecha(fecha).toLocaleDateString('es-PE', { month: 'short' }).toUpperCase();
  }

  private mostrarError(error: unknown, fallback: string): void {
    this.cargando.set(false);
    this.mostrarAlerta('error', 'No se pudo completar la operación', formatearMensajeError(error, fallback));
  }

  cerrarAlerta(): void {
    this.alertState.update((actual) => ({ ...actual, open: false }));
  }

  private mostrarAlerta(type: CustomAlertType, title: string, message: string): void {
    this.alertState.set({ open: true, type, title, message });
  }

  private fechaDentroDelPeriodo(inicio: string, fin: string): string {
    const hoy = this.fechaLocalHoy();
    return hoy < inicio ? inicio : hoy > fin ? fin : hoy;
  }

  private lunesPeriodo(): string {
    return this.lunesDe(this.periodoAcademico()?.fechaInicio ?? '');
  }

  private lunesDe(fecha: string): string {
    if (!fecha) return '';
    const date = this.parseFecha(fecha);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return this.fechaKey(date);
  }

  private sumarDias(fecha: string, dias: number): string {
    if (!fecha) return '';
    const date = this.parseFecha(fecha);
    date.setDate(date.getDate() + dias);
    return this.fechaKey(date);
  }

  private parseFecha(fecha: string): Date {
    const [year, month, day] = fecha.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private fechaKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private fechaLocalHoy(): string {
    return this.fechaKey(new Date());
  }
}
