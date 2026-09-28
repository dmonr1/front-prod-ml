import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, forkJoin, from, toArray } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { BloqueHorario, BloqueHorarioPayload, DiaSemana, HorarioSemanal } from '../../models/horario';
import { CursoService } from '../../services/academico/curso.service';
import { HorarioService } from '../../services/academico/horario.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { formatearMensajeError } from '../../utils/error-formatter';

interface NivelOpcion { id: number; nombre: string; }
interface ResumenSeccion {
  id: number;
  seccion: string;
  grado: string;
  nivel: string;
  asignaciones: number;
  programadas: number;
  pendientes: number;
}
interface HuecoHorario { inicio: string; fin: string; minutos: number; }
interface AlertState { open: boolean; type: CustomAlertType; title: string; message: string; confirmText: string | null; cancelText: string | null; autoCloseMs: number | null; }

@Component({
  selector: 'app-horarios',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './horarios.html',
  styleUrl: './horarios.scss'
})
export class Horarios implements OnInit {
  private readonly periodosService = inject(PeriodoAcademicoService);
  private readonly cursosService = inject(CursoService);
  private readonly asignacionesService = inject(AsignacionAcademicaService);
  private readonly horarioService = inject(HorarioService);

  readonly dias: { value: DiaSemana; label: string }[] = [
    { value: 'LUNES', label: 'Lunes' }, { value: 'MARTES', label: 'Martes' },
    { value: 'MIERCOLES', label: 'Miércoles' }, { value: 'JUEVES', label: 'Jueves' },
    { value: 'VIERNES', label: 'Viernes' }
  ];
  readonly altoHora = 64;
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodoId = signal<number | null>(null);
  readonly periodoSeleccionado = computed(() => this.periodos().find((item) => item.id === this.periodoId()) ?? null);
  readonly niveles = signal<NivelOpcion[]>([]);
  readonly nivelId = signal<number | null>(null);
  readonly nivelSeleccionado = computed(() => this.niveles().find((nivel) => nivel.id === this.nivelId()) ?? null);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly cursos = signal<Curso[]>([]);
  readonly bloques = signal<BloqueHorario[]>([]);
  readonly recreosNivel = computed(() => this.bloques().filter((bloque) => bloque.nivelId === this.nivelId() && bloque.esRecreo));
  readonly horarios = signal<HorarioSemanal[]>([]);
  readonly vista = signal<'secciones' | 'semanal'>('secciones');
  readonly categoriaNivel = signal<'PRIMARIA' | 'SECUNDARIA'>('PRIMARIA');
  readonly seccionIdActual = signal<number | null>(null);
  readonly seccionSeleccionada = computed(() => this.resumenSecciones().find((item) => item.id === this.seccionIdActual()) ?? null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly modalBloqueAbierto = signal(false);
  readonly submodalBloqueAbierto = signal(false);
  readonly alertState = signal<AlertState>({ open: false, type: 'info', title: '', message: '', confirmText: 'Entendido', cancelText: null, autoCloseMs: null });
  readonly asignacionId = signal<number | null>(null);
  readonly diaSemana = signal<DiaSemana>('LUNES');
  readonly bloqueHorarioId = signal<number | null>(null);
  readonly horarioEditandoId = signal<number | null>(null);
  readonly nuevoEsRecreo = signal(false);
  nuevoNombre = '';
  nuevaHoraInicio = '';
  nuevaHoraFin = '';
  readonly nivelAsignacion = computed(() => {
    const asignacion = this.asignaciones().find((item) => item.id === this.asignacionId());
    return this.cursos().find((curso) => curso.id === asignacion?.cursoId)?.nivelId ?? null;
  });
  readonly rangoProgramacion = computed(() => {
    const bloques = this.bloques().filter((bloque) => bloque.nivelId === this.nivelId());
    const inicio = Math.min(8 * 60, ...bloques.map((bloque) => this.minutos(bloque.horaInicio)));
    const fin = Math.max(18 * 60, ...bloques.map((bloque) => this.minutos(bloque.horaFin)));
    const marcas = new Set<number>([inicio, fin]);
    for (const bloque of bloques) {
      marcas.add(this.minutos(bloque.horaInicio));
      marcas.add(this.minutos(bloque.horaFin));
    }
    return { inicio, fin, alto: ((fin - inicio) / 60) * this.altoHora, marcas: [...marcas].sort((a, b) => a - b) };
  });
  readonly duracionBloqueNuevo = computed(() => {
    return this.duracionConfigurada(this.nivelId(), this.nuevoEsRecreo());
  });
  readonly opcionesInicioBloque = computed(() => {
    const duracion = this.duracionBloqueNuevo();
    const bloques = this.bloques().filter((item) => item.nivelId === this.nivelId());
    const valores = new Set<number>([7 * 60]);
    bloques.forEach((bloque) => valores.add(this.minutos(bloque.horaFin)));
    return [...valores]
      .filter((inicio) => inicio >= 7 * 60 && inicio + duracion <= 18 * 60
        && bloques.every((bloque) => inicio >= this.minutos(bloque.horaFin)
          || inicio + duracion <= this.minutos(bloque.horaInicio)))
      .sort((a, b) => a - b)
      .map((minuto) => this.formatearMinuto(minuto));
  });
  readonly huecosDisponibles = computed<HuecoHorario[]>(() => {
    const limiteInicio = 7 * 60;
    const limiteFin = 18 * 60;
    const bloques = this.bloques().filter((item) => item.nivelId === this.nivelId())
      .map((item) => ({ inicio: Math.max(limiteInicio, this.minutos(item.horaInicio)), fin: Math.min(limiteFin, this.minutos(item.horaFin)) }))
      .filter((item) => item.fin > item.inicio)
      .sort((a, b) => a.inicio - b.inicio);
    if (!bloques.length) return [];
    const duracion = this.duracionBloqueNuevo();
    const huecos: HuecoHorario[] = [];
    const agregarHueco = (inicio: number, fin: number) => {
      if (fin - inicio >= duracion) {
        huecos.push({ inicio: this.formatearMinuto(inicio), fin: this.formatearMinuto(inicio + duracion), minutos: duracion });
      }
    };
    let cursor = limiteInicio;
    for (const bloque of bloques) {
      if (bloque.inicio > cursor) agregarHueco(cursor, bloque.inicio);
      cursor = Math.max(cursor, bloque.fin);
    }
    if (cursor < limiteFin) agregarHueco(cursor, limiteFin);
    return huecos;
  });
  readonly nivelesCategoria = computed(() => this.niveles().filter((nivel) =>
    nivel.nombre.toUpperCase().includes(this.categoriaNivel())
  ));
  readonly resumenSecciones = computed<ResumenSeccion[]>(() => {
    const cursos = new Map(this.cursos().map((curso) => [curso.id, curso]));
    const agrupadas = new Map<number, ResumenSeccion>();
    for (const asignacion of this.asignaciones()) {
      const curso = cursos.get(asignacion.cursoId);
      if (!curso || !curso.nivelNombre.toUpperCase().includes(this.categoriaNivel())) continue;
      const actual = agrupadas.get(asignacion.seccionId) ?? {
        id: asignacion.seccionId,
        seccion: asignacion.seccion,
        grado: asignacion.grado,
        nivel: curso.nivelNombre,
        asignaciones: 0,
        programadas: 0,
        pendientes: 0
      };
      actual.asignaciones += 1;
      agrupadas.set(asignacion.seccionId, actual);
    }
    const asignacionesProgramadas = new Set(this.horarios().map((horario) => horario.asignacionId));
    return [...agrupadas.values()].map((seccion) => {
      const asignacionesSeccion = this.asignaciones().filter((item) => item.seccionId === seccion.id);
      seccion.programadas = asignacionesSeccion.filter((item) => asignacionesProgramadas.has(item.id)).length;
      seccion.pendientes = seccion.asignaciones - seccion.programadas;
      return seccion;
    }).sort((a, b) => a.grado.localeCompare(b.grado, 'es') || a.seccion.localeCompare(b.seccion, 'es'));
  });
  readonly asignacionesNivel = computed(() => this.asignaciones().filter((asignacion) =>
    this.cursos().some((curso) => curso.id === asignacion.cursoId && curso.nivelId === this.nivelId())
  ));
  readonly asignacionesPendientes = computed(() => {
    const programadas = new Set(this.horariosSeccion().map((horario) => horario.asignacionId));
    return this.asignacionesSeccion().filter((asignacion) => !programadas.has(asignacion.id));
  });
  readonly asignacionesSeccion = computed(() => this.asignaciones().filter((asignacion) =>
    asignacion.seccionId === this.seccionIdActual()
    && this.cursos().some((curso) => curso.id === asignacion.cursoId && curso.nivelId === this.nivelId())
  ));
  readonly horariosSeccion = computed(() => this.horarios().filter((horario) =>
    horario.seccionId === this.seccionIdActual()
    && this.cursos().some((curso) => curso.id === horario.cursoId && curso.nivelId === this.nivelId())
  ));
  readonly horariosNivel = computed(() => this.horarios().filter((horario) =>
    this.cursos().some((curso) => curso.id === horario.cursoId && curso.nivelId === this.nivelId())
  ));
  readonly resumenNiveles = computed(() => this.niveles().map((nivel) => {
    const asignaciones = this.asignaciones().filter((asignacion) =>
      this.cursos().some((curso) => curso.id === asignacion.cursoId && curso.nivelId === nivel.id)
    );
    const programadas = new Set(this.horarios()
      .filter((horario) => this.cursos().some((curso) => curso.id === horario.cursoId && curso.nivelId === nivel.id))
      .map((horario) => horario.asignacionId));
    const pendientes = asignaciones.filter((asignacion) => !programadas.has(asignacion.id)).length;
    return {
      ...nivel,
      asignaciones: asignaciones.length,
      programadas: asignaciones.length - pendientes,
      pendientes,
      estado: !asignaciones.length ? 'SIN ASIGNACIONES' : pendientes ? 'PENDIENTE' : 'COMPLETO'
    };
  }));
  readonly bloquesAsignacion = computed(() => this.bloques().filter((bloque) => bloque.nivelId === this.nivelAsignacion() && !bloque.esRecreo));
  readonly horariosOrdenados = computed(() => this.horarios().filter((item) => this.dias.some((dia) => dia.value === item.diaSemana)).sort((a, b) =>
    this.dias.findIndex((dia) => dia.value === a.diaSemana) - this.dias.findIndex((dia) => dia.value === b.diaSemana)
      || a.horaInicio.localeCompare(b.horaInicio)
  ));

  ngOnInit(): void {
    this.cargando.set(true);
    forkJoin({ periodos: this.periodosService.listar(), cursos: this.cursosService.listar() }).subscribe({
      next: ({ periodos, cursos }) => {
        this.periodos.set(periodos);
        this.cursos.set(cursos);
        const actual = periodos.find((item) => item.estado === 'ACTIVO')
          ?? periodos.find((item) => item.anio === new Date().getFullYear())
          ?? periodos[0];
        if (!actual) {
          this.mostrarAlerta('warning', 'No hay período académico', 'Crea un período académico antes de configurar horarios.');
          this.cargando.set(false);
          return;
        }
        this.periodoId.set(actual.id);
        this.cargarAsignaciones(actual.id);
      },
      error: (e) => this.mostrarError(e, 'No se pudieron cargar los períodos y cursos.')
    });
  }

  cambiarPeriodo(value: string): void {
    const id = Number(value) || null;
    this.periodoId.set(id);
    this.horarioEditandoId.set(null);
    if (id) this.cargarAsignaciones(id);
  }

  cambiarNivel(value: string): void {
    const nivelId = Number(value) || null;
    this.nivelId.set(nivelId);
    const asignaciones = this.asignaciones().filter((asignacion) =>
      this.cursos().some((curso) => curso.id === asignacion.cursoId && curso.nivelId === nivelId)
    );
    if (!asignaciones.some((item) => item.id === this.asignacionId())) {
      this.asignacionId.set(asignaciones[0]?.id ?? null);
    }
    this.bloqueHorarioId.set(null);
    this.cargarBloques();
  }

  cambiarCategoriaNivel(categoria: 'PRIMARIA' | 'SECUNDARIA'): void {
    this.categoriaNivel.set(categoria);
    this.seccionIdActual.set(null);
    this.horarioEditandoId.set(null);
    this.vista.set('secciones');
    const nivel = this.nivelesCategoria()[0];
    if (nivel) this.cambiarNivel(String(nivel.id));
    else this.nivelId.set(null);
  }

  abrirSeccion(seccionId: number): void {
    const seccion = this.resumenSecciones().find((item) => item.id === seccionId);
    const asignacion = this.asignaciones().find((item) => item.seccionId === seccionId
      && this.cursos().some((curso) => curso.id === item.cursoId && curso.nivelNombre.toUpperCase().includes(this.categoriaNivel())));
    const curso = this.cursos().find((item) => item.id === asignacion?.cursoId);
    if (!seccion || !asignacion || !curso) return;
    this.nivelId.set(curso.nivelId);
    this.seccionIdActual.set(seccionId);
    this.asignacionId.set(asignacion.id);
    this.bloqueHorarioId.set(null);
    this.horarioEditandoId.set(null);
    this.cargarBloques();
    this.vista.set('semanal');
  }

  volverASecciones(): void {
    this.horarioEditandoId.set(null);
    this.seccionIdActual.set(null);
    this.vista.set('secciones');
  }

  horariosPorDia(dia: DiaSemana): HorarioSemanal[] {
    return this.horariosSeccion().filter((horario) => horario.diaSemana === dia)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }

  abrirModalBloque(): void {
    const nivel = this.nivelesCategoria().find((item) => item.id === this.nivelId()) ?? this.nivelesCategoria()[0];
    if (!nivel) {
      this.mostrarAlerta('warning', 'Nivel sin cursos', `No hay cursos activos de ${this.categoriaNivel().toLowerCase()} para configurar bloques.`);
      return;
    }
    this.nivelId.set(nivel.id);
    this.nuevoNombre = '';
    this.nuevoEsRecreo.set(false);
    this.nuevaHoraInicio = '';
    this.nuevaHoraFin = '';
    this.modalBloqueAbierto.set(true);
    this.cargarBloques();
  }

  cerrarModalBloque(): void {
    if (!this.guardando()) {
      this.submodalBloqueAbierto.set(false);
      this.modalBloqueAbierto.set(false);
    }
  }

  abrirSubmodalBloque(): void {
    this.nuevoNombre = '';
    this.nuevoEsRecreo.set(false);
    this.nuevaHoraInicio = this.opcionesInicioBloque()[0] ?? '';
    this.nuevaHoraFin = this.calcularFinBloque(this.nuevaHoraInicio);
    this.submodalBloqueAbierto.set(true);
  }

  cerrarSubmodalBloque(): void {
    if (!this.guardando()) this.submodalBloqueAbierto.set(false);
  }

  alternarNuevoEsRecreo(): void {
    this.nuevoEsRecreo.update((value) => !value);
    if (this.nuevoEsRecreo()) {
      this.nuevoNombre = 'Recreo';
    } else if (this.nuevoNombre === 'Recreo') {
      this.nuevoNombre = '';
    }
    if (!this.opcionesInicioBloque().includes(this.nuevaHoraInicio)) {
      this.nuevaHoraInicio = this.opcionesInicioBloque()[0] ?? '';
    }
    this.nuevaHoraFin = this.calcularFinBloque(this.nuevaHoraInicio);
  }

  duracionConfigurada(nivelId: number | null, esRecreo: boolean): number {
    const periodo = this.periodoSeleccionado();
    const secundaria = this.niveles().find((nivel) => nivel.id === nivelId)?.nombre.toUpperCase().includes('SECUNDARIA') ?? false;
    if (esRecreo) {
      return secundaria ? periodo?.duracionRecreoSecundariaMinutos ?? 20 : periodo?.duracionRecreoPrimariaMinutos ?? 20;
    }
    return secundaria ? periodo?.duracionHoraSecundariaMinutos ?? 90 : periodo?.duracionHoraPrimariaMinutos ?? 50;
  }

  calcularFinHorario(inicio: string, nivelId: number, esRecreo: boolean): string {
    return inicio ? this.formatearMinuto(this.minutos(inicio) + this.duracionConfigurada(nivelId, esRecreo)) : '';
  }

  opcionesInicioEdicion(bloque: BloqueHorario): string[] {
    const duracion = this.duracionConfigurada(bloque.nivelId, bloque.esRecreo);
    const otros = this.bloques().filter((item) => item.nivelId === bloque.nivelId && item.id !== bloque.id);
    const valores = new Set<number>([7 * 60, this.minutos(bloque.horaInicio)]);
    otros.forEach((item) => valores.add(this.minutos(item.horaFin)));
    return [...valores]
      .filter((inicio) => inicio >= 7 * 60 && inicio + duracion <= 18 * 60
        && otros.every((item) => inicio >= this.minutos(item.horaFin)
          || inicio + duracion <= this.minutos(item.horaInicio)))
      .sort((a, b) => a - b)
      .map((minuto) => this.formatearMinuto(minuto));
  }

  cambiarInicioEdicion(bloqueId: number, horaInicio: string): void {
    this.bloques.update((items) => items.map((item) => item.id === bloqueId
      ? { ...item, horaInicio, horaFin: this.calcularFinHorario(horaInicio, item.nivelId, item.esRecreo) }
      : item));
  }

  bloqueHorarioValido(bloque: BloqueHorario): boolean {
    return this.opcionesInicioEdicion(bloque).includes(bloque.horaInicio.slice(0, 5))
      && this.minutos(bloque.horaFin) - this.minutos(bloque.horaInicio) === this.duracionConfigurada(bloque.nivelId, bloque.esRecreo)
      && this.minutos(bloque.horaFin) <= 18 * 60;
  }

  seleccionarHueco(hueco: HuecoHorario): void {
    this.nuevaHoraInicio = hueco.inicio;
    this.nuevaHoraFin = hueco.fin;
  }

  cambiarHoraInicioBloque(inicio: string): void {
    this.nuevaHoraInicio = inicio;
    this.nuevaHoraFin = this.calcularFinBloque(inicio);
  }

  calcularFinBloque(inicio: string): string {
    if (!inicio) return '';
    return this.formatearMinuto(this.minutos(inicio) + this.duracionBloqueNuevo());
  }

  validarRangoNuevoBloque(): boolean {
    return Boolean(this.nuevaHoraInicio && this.nuevaHoraFin)
      && this.opcionesInicioBloque().includes(this.nuevaHoraInicio)
      && this.minutos(this.nuevaHoraInicio) < this.minutos(this.nuevaHoraFin)
      && this.minutos(this.nuevaHoraFin) - this.minutos(this.nuevaHoraInicio) === this.duracionBloqueNuevo()
      && this.minutos(this.nuevaHoraFin) <= 18 * 60;
  }

  duracionHueco(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (!horas) return `${resto} min`;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
  }

  cambiarAsignacion(value: string): void {
    this.asignacionId.set(Number(value) || null);
    this.bloqueHorarioId.set(null);
    const bloque = this.bloquesAsignacion()[0];
    this.bloqueHorarioId.set(bloque?.id ?? null);
  }

  seleccionarAsignacionPendiente(asignacionId: number): void {
    this.cambiarAsignacion(String(asignacionId));
  }

  cambiarBloque(value: string): void {
    this.bloqueHorarioId.set(Number(value) || null);
  }

  guardarBloque(): void {
    const periodoAcademicoId = this.periodoId();
    const nivelId = this.nivelId();
    if (!periodoAcademicoId || !nivelId || !this.nuevoNombre.trim() || !this.validarRangoNuevoBloque()) return;
    const orden = Math.max(0, ...this.bloques().map((item) => item.orden)) + 1;
    this.guardando.set(true);
    this.horarioService.crearBloque({ periodoAcademicoId, nivelId, nombre: this.nuevoNombre.trim(), orden, horaInicio: this.nuevaHoraInicio, horaFin: this.nuevaHoraFin, esRecreo: this.nuevoEsRecreo() })
      .subscribe({
        next: () => {
          this.nuevoNombre = '';
          this.nuevaHoraInicio = '';
          this.nuevaHoraFin = '';
          this.guardando.set(false);
          this.submodalBloqueAbierto.set(false);
          this.mostrarAlerta('success', 'Bloque agregado', 'El bloque horario se agregó correctamente.');
          this.cargarBloques();
        },
        error: (e) => this.mostrarError(e, 'No se pudo agregar el bloque.'),
        complete: () => this.guardando.set(false)
      });
  }

  guardarEdicion(bloque: BloqueHorario): void {
    const periodoAcademicoId = this.periodoId();
    if (!periodoAcademicoId) return;
    this.guardando.set(true);
    this.horarioService.actualizarBloque(bloque.id, {
      periodoAcademicoId, nivelId: bloque.nivelId, nombre: bloque.nombre.trim(), orden: bloque.orden,
      horaInicio: bloque.horaInicio, horaFin: bloque.horaFin, esRecreo: bloque.esRecreo
    }).subscribe({
      next: (actualizado) => {
        this.bloques.update((items) => items.map((item) => item.id === actualizado.id ? actualizado : item));
        this.mostrarAlerta('success', 'Bloque actualizado', 'Los cambios del bloque se guardaron correctamente.');
        this.guardando.set(false);
      },
      error: (e) => this.mostrarError(e, 'No se pudo actualizar el bloque.')
    });
  }

  alternarTipoBloque(bloqueId: number): void {
    const actual = this.bloques().find((item) => item.id === bloqueId);
    if (!actual) return;
    const esRecreo = !actual.esRecreo;
    const duracion = this.duracionConfigurada(actual.nivelId, esRecreo);
    const horaInicio = this.minutos(actual.horaInicio);
    this.bloques.update((items) => items.map((item) => item.id === bloqueId
      ? { ...item, esRecreo, horaFin: this.formatearMinuto(horaInicio + duracion) }
      : item));
  }

  desactivarBloque(bloque: BloqueHorario): void {
    this.horarioService.cambiarEstadoBloque(bloque.id, false).subscribe({
      next: () => { this.mostrarAlerta('success', 'Bloque desactivado', 'El bloque ya no estará disponible para programar clases.'); this.cargarBloques(); },
      error: (e) => this.mostrarError(e, 'No se pudo desactivar el bloque.')
    });
  }

  cargarPlantillaSanMarcos(): void {
    const nivelId = this.nivelId();
    const periodoAcademicoId = this.periodoId();
    const nivel = this.niveles().find((item) => item.id === nivelId)?.nombre.toUpperCase();
    if (!nivelId || !periodoAcademicoId || this.bloques().length) return;
    const horarios = nivel?.includes('SECUND')
      ? [['Bloque 1', '07:45', '09:15'], ['Bloque 2', '09:30', '11:00'], ['Bloque 3', '11:00', '12:30'], ['Bloque 4', '12:45', '14:15']]
      : [['Bloque 1', '08:00', '08:50'], ['Bloque 2', '08:50', '09:40'], ['Bloque 3', '10:00', '10:50'], ['Bloque 4', '10:50', '11:40'], ['Bloque 5', '12:00', '12:50'], ['Bloque 6', '12:50', '13:40']];
    const payloads: BloqueHorarioPayload[] = horarios.map(([nombre, horaInicio, horaFin], index) => ({
      periodoAcademicoId, nivelId, nombre, horaInicio, horaFin, orden: index + 1, esRecreo: false
    }));
    this.guardando.set(true);
    from(payloads).pipe(concatMap((payload) => this.horarioService.crearBloque(payload)), toArray()).subscribe({
      next: () => { this.mostrarAlerta('success', 'Plantilla cargada', 'Se agregaron los bloques de referencia. Puedes editarlos para ajustarlos.'); this.cargarBloques(); },
      error: (e) => this.mostrarError(e, 'No se pudo cargar la plantilla completa.'),
      complete: () => this.guardando.set(false)
    });
  }

  guardarHorario(): void {
    const asignacionId = this.asignacionId();
    const bloqueHorarioId = this.bloqueHorarioId();
    if (!asignacionId || !bloqueHorarioId) return;
    const payload = { asignacionId, bloqueHorarioId, diaSemana: this.diaSemana() };
    const horarioId = this.horarioEditandoId();
    this.guardando.set(true);
    const operacion = horarioId
      ? this.horarioService.actualizar(horarioId, payload)
      : this.horarioService.crear(payload);
    operacion.subscribe({
      next: (item) => {
        this.horarios.update((items) => horarioId
          ? items.map((horario) => horario.id === item.id ? item : horario)
          : [...items, item]);
        this.horarioEditandoId.set(null);
        this.mostrarAlerta('success', horarioId ? 'Programación actualizada' : 'Clase programada', horarioId
          ? 'Los cambios de la clase se guardaron correctamente.'
          : 'La clase se repetirá según el día y bloque asignados durante el período académico.');
        this.guardando.set(false);
      },
      error: (e) => this.mostrarError(e, horarioId ? 'No se pudo actualizar la programación.' : 'No se pudo programar la clase.')
    });
  }

  iniciarEdicionHorario(item: HorarioSemanal): void {
    this.horarioEditandoId.set(item.id);
    this.asignacionId.set(item.asignacionId);
    this.diaSemana.set(item.diaSemana);
    this.bloqueHorarioId.set(item.bloqueHorarioId);
  }

  cancelarEdicionHorario(): void {
    this.horarioEditandoId.set(null);
    this.bloqueHorarioId.set(null);
  }

  quitarHorario(item: HorarioSemanal): void {
    this.horarioService.cambiarEstado(item.id, false).subscribe({
      next: () => { this.horarios.update((items) => items.filter((horario) => horario.id !== item.id)); this.mostrarAlerta('success', 'Clase retirada', 'La clase se quitó de la programación del período.'); },
      error: (e) => this.mostrarError(e, 'No se pudo retirar la clase.')
    });
  }

  etiquetaDia(value: DiaSemana): string {
    return this.dias.find((dia) => dia.value === value)?.label ?? value;
  }

  formatearHora(hora: string): string {
    return hora?.slice(0, 5) ?? '';
  }

  posicionProgramacion(item: HorarioSemanal): number {
    return Math.max(0, ((this.minutos(item.horaInicio) - this.rangoProgramacion().inicio) / 60) * this.altoHora + 2);
  }

  altoProgramacion(item: HorarioSemanal): number {
    const duracion = this.minutos(item.horaFin) - this.minutos(item.horaInicio);
    return Math.max(42, (duracion / 60) * this.altoHora - 4);
  }

  posicionBloque(bloque: BloqueHorario): number {
    return Math.max(0, ((this.minutos(bloque.horaInicio) - this.rangoProgramacion().inicio) / 60) * this.altoHora + 2);
  }

  altoBloque(bloque: BloqueHorario): number {
    const duracion = this.minutos(bloque.horaFin) - this.minutos(bloque.horaInicio);
    return Math.max(24, (duracion / 60) * this.altoHora - 4);
  }

  posicionMarcaProgramacion(minuto: number): number {
    return ((minuto - this.rangoProgramacion().inicio) / 60) * this.altoHora;
  }

  formatearMinuto(minuto: number): string {
    return `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`;
  }

  private cargarAsignaciones(periodoId: number): void {
    this.cargando.set(true);
    forkJoin({ asignaciones: this.asignacionesService.listarPorPeriodo(periodoId), horarios: this.horarioService.listar(periodoId) }).subscribe({
      next: ({ asignaciones, horarios }) => {
        const activas = asignaciones.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
        this.asignaciones.set(activas);
        this.horarios.set(horarios);
        const niveles = new Map<number, string>();
        this.cursos()
          .filter((curso) => (curso.estado ?? 'ACTIVO') === 'ACTIVO')
          .forEach((curso) => {
            niveles.set(curso.nivelId, curso.nivelNombre);
        });
        this.niveles.set([...niveles].map(([id, nombre]) => ({ id, nombre })));
        if (!this.niveles().some((nivel) => nivel.id === this.nivelId())) {
          const nivelInicial = this.niveles().find((nivel) => nivel.nombre.toUpperCase().includes(this.categoriaNivel()))
            ?? this.niveles()[0];
          this.nivelId.set(nivelInicial?.id ?? null);
        }
        if (!this.asignaciones().some((item) => item.id === this.asignacionId())) this.asignacionId.set(activas[0]?.id ?? null);
        const nivelAsignacion = this.nivelAsignacion();
        if (nivelAsignacion && !this.nivelId()) this.nivelId.set(nivelAsignacion);
        this.cargando.set(false);
        this.cargarBloques();
      },
      error: (e) => this.mostrarError(e, 'No se pudieron cargar asignaciones y horarios.')
    });
  }

  private cargarBloques(): void {
    const periodoId = this.periodoId();
    const nivelId = this.nivelId();
    if (!periodoId || !nivelId) { this.bloques.set([]); return; }
    this.horarioService.listarBloques(periodoId, nivelId).subscribe({
      next: (items) => {
        this.bloques.set(items);
        const bloquesDeClase = items.filter((item) => !item.esRecreo);
        if (!this.bloqueHorarioId() || !bloquesDeClase.some((item) => item.id === this.bloqueHorarioId())) {
          this.bloqueHorarioId.set(bloquesDeClase[0]?.id ?? null);
        }
      },
      error: (e) => this.mostrarError(e, 'No se pudieron cargar los bloques horarios.')
    });
  }

  private mostrarError(error: unknown, fallback: string): void {
    this.mostrarAlerta('error', 'No se pudo completar la operación', formatearMensajeError(error, fallback));
    this.guardando.set(false);
    this.cargando.set(false);
  }

  cerrarAlerta(): void { this.alertState.update((state) => ({ ...state, open: false })); }

  private mostrarAlerta(type: CustomAlertType, title: string, message: string): void {
    this.alertState.set({ open: true, type, title, message, confirmText: 'Entendido', cancelText: null, autoCloseMs: null });
  }

  private minutos(hora: string): number {
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
  }
}
