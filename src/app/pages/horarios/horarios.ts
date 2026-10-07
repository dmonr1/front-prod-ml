import { Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, forkJoin, from, map, switchMap, toArray } from 'rxjs';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { AsignacionDocente } from '../../models/asignacion';
import { Curso } from '../../models/curso';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { Seccion } from '../../models/seccion';
import { BloqueHorario, BloqueHorarioPayload, DiaSemana, HorarioSemanal, TipoBloqueHorario } from '../../models/horario';
import { CursoService } from '../../services/academico/curso.service';
import { HorarioService } from '../../services/academico/horario.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { SeccionService } from '../../services/academico/seccion.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { formatearMensajeError } from '../../utils/error-formatter';

interface NivelOpcion { id: number; nombre: string; }
interface ResumenSeccion {
  id: number;
  seccion: string;
  grado: string;
  nivel: string;
  nivelId: number | null;
  asignaciones: number;
  programadas: number;
  pendientes: number;
  estado: 'SIN_ASIGNACIONES' | 'PENDIENTE' | 'COMPLETO';
}
interface HuecoHorario { inicio: string; fin: string; minutos: number; }
interface AlertState { open: boolean; type: CustomAlertType; title: string; message: string; confirmText: string | null; cancelText: string | null; autoCloseMs: number | null; }
interface CursoPendiente { key: string; asignacion: AsignacionDocente; horarioPendienteId?: number; }

export interface DragItemData {
  tipo: 'PENDIENTE' | 'HORARIO';
  asignacionId: number;
  curso: string;
  docente: string;
  cursoId: number;
  horarioId?: number;
  horarioPendienteId?: number;
  diaSemana?: DiaSemana;
  bloqueId?: number;
}

@Component({
  selector: 'app-horarios',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './horarios.html',
  styleUrl: './horarios.scss'
})
export class Horarios implements OnInit {
  private readonly elementRef = inject(ElementRef);
  private readonly periodosService = inject(PeriodoAcademicoService);
  private readonly cursosService = inject(CursoService);
  private readonly seccionesService = inject(SeccionService);
  private readonly asignacionesService = inject(AsignacionAcademicaService);
  private readonly horarioService = inject(HorarioService);

  readonly dias: { value: DiaSemana; label: string }[] = [
    { value: 'LUNES', label: 'Lunes' }, { value: 'MARTES', label: 'Martes' },
    { value: 'MIERCOLES', label: 'Miércoles' }, { value: 'JUEVES', label: 'Jueves' },
    { value: 'VIERNES', label: 'Viernes' }
  ];
  readonly altoHora = signal<number>(105);
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodoId = signal<number | null>(null);
  readonly periodoSeleccionado = computed(() => this.periodos().find((item) => item.id === this.periodoId()) ?? null);
  readonly periodoEditableId = computed(() => this.periodos()
    .filter((item) => item.estado === 'ACTIVO')
    .sort((a, b) => b.anio - a.anio)[0]?.id ?? null);
  readonly esPeriodoEditable = computed(() => this.periodoId() !== null && this.periodoId() === this.periodoEditableId());
  readonly niveles = signal<NivelOpcion[]>([]);
  readonly nivelId = signal<number | null>(null);
  readonly nivelSeleccionado = computed(() => this.niveles().find((nivel) => nivel.id === this.nivelId()) ?? null);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly cursos = signal<Curso[]>([]);
  readonly bloques = signal<BloqueHorario[]>([]);
  readonly bloquesNoLectivosNivel = computed(() => this.bloques().filter((bloque) => bloque.nivelId === this.nivelId() && this.tipoDeBloque(bloque) !== 'CLASE'));
  readonly horarios = signal<HorarioSemanal[]>([]);
  readonly horariosPendientesReprogramacion = signal<HorarioSemanal[]>([]);
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
  readonly horarioPendienteSeleccionadoId = signal<number | null>(null);
  readonly nuevoTipoBloque = signal<TipoBloqueHorario>('CLASE');
  nuevoNombre = '';
  nuevaHoraInicio = '';
  nuevaHoraFin = '';

  // Drag & drop signals
  readonly dragItem = signal<DragItemData | null>(null);
  readonly dropTargetSlot = signal<{ dia: DiaSemana; bloqueId: number } | null>(null);
  readonly dropTargetClassId = signal<number | null>(null);
  readonly dropTargetUnschedule = signal<boolean>(false);
  readonly arrastrando = computed(() => this.dragItem() !== null);
  readonly nombreCursoArrastrado = computed(() => this.dragItem()?.curso ?? '');
  readonly tonoCursoArrastrado = computed(() => {
    const data = this.dragItem();
    return data ? this.tonoCursoPorId(data.cursoId) : '';
  });

  readonly nivelAsignacion = computed(() => {
    const asignacion = this.asignaciones().find((item) => item.id === this.asignacionId());
    return this.cursos().find((curso) => curso.id === asignacion?.cursoId)?.nivelId ?? null;
  });
  readonly rangoProgramacion = computed(() => {
    const bloques = this.bloques().filter((bloque) => bloque.nivelId === this.nivelId());
    if (!bloques.length) return { inicio: 0, fin: 0, alto: 0, marcas: [] as number[] };
    const inicio = Math.min(...bloques.map((bloque) => this.minutos(bloque.horaInicio)));
    const fin = Math.max(...bloques.map((bloque) => this.minutos(bloque.horaFin)));
    const marcas = new Set<number>([inicio, fin]);
    for (const bloque of bloques) {
      marcas.add(this.minutos(bloque.horaInicio));
      marcas.add(this.minutos(bloque.horaFin));
    }
    return { inicio, fin, alto: ((fin - inicio) / 60) * this.altoHora(), marcas: [...marcas].sort((a, b) => a - b) };
  });
  readonly duracionBloqueNuevo = computed(() => {
    return this.duracionConfigurada(this.nivelId(), this.nuevoTipoBloque());
  });
  readonly jornadaConfigurada = computed(() => this.limitesJornada(this.nivelId()));
  readonly opcionesInicioBloque = computed(() => {
    const duracion = this.duracionBloqueNuevo();
    const bloques = this.bloques().filter((item) => item.nivelId === this.nivelId());
    const { inicio: limiteInicio, fin: limiteFin } = this.jornadaConfigurada();
    const valores = new Set<number>([limiteInicio]);
    bloques.forEach((bloque) => valores.add(this.minutos(bloque.horaFin)));
    return [...valores]
      .filter((inicio) => inicio >= limiteInicio && inicio + duracion <= limiteFin
        && bloques.every((bloque) => inicio >= this.minutos(bloque.horaFin)
          || inicio + duracion <= this.minutos(bloque.horaInicio)))
      .sort((a, b) => a - b)
      .map((minuto) => this.formatearMinuto(minuto));
  });
  readonly huecosDisponibles = computed<HuecoHorario[]>(() => {
    const { inicio: limiteInicio, fin: limiteFin } = this.jornadaConfigurada();
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
    const asignacionesProgramadas = new Set(this.horarios().map((horario) => horario.asignacionId));
    return this.secciones()
      .filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO')
      .map((item) => {
        const nivel = item.nivelNombre
          ?? this.niveles().find((opcion) => opcion.id === item.nivelId)?.nombre
          ?? '';
        const nivelId = item.nivelId ?? this.niveles().find((opcion) => opcion.nombre === nivel)?.id ?? null;
        const asignacionesSeccion = this.asignaciones().filter((asignacion) =>
          asignacion.seccionId === item.id
          && this.cursos().some((curso) => curso.id === asignacion.cursoId && curso.nivelId === nivelId)
        );
        const programadas = asignacionesSeccion.filter((asignacion) => asignacionesProgramadas.has(asignacion.id)).length;
        const pendientes = asignacionesSeccion.length - programadas;
        return {
          id: item.id,
          seccion: item.nombre,
          grado: item.gradoNombre ?? '',
          nivel,
          nivelId,
          asignaciones: asignacionesSeccion.length,
          programadas,
          pendientes,
          estado: !asignacionesSeccion.length ? 'SIN_ASIGNACIONES' as const : pendientes ? 'PENDIENTE' as const : 'COMPLETO' as const
        };
      })
      .filter((item) => item.nivel.toUpperCase().includes(this.categoriaNivel()))
      .sort((a, b) => a.grado.localeCompare(b.grado, 'es') || a.seccion.localeCompare(b.seccion, 'es'));
  });
  readonly asignacionesNivel = computed(() => this.asignaciones().filter((asignacion) =>
    this.cursos().some((curso) => curso.id === asignacion.cursoId && curso.nivelId === this.nivelId())
  ));
  readonly asignacionesPendientes = computed(() => {
    const programadas = new Set(this.horariosSeccion().map((horario) => horario.asignacionId));
    return this.asignacionesSeccion().filter((asignacion) => !programadas.has(asignacion.id));
  });
  readonly cursosPendientes = computed<CursoPendiente[]>(() => {
    const pendientesRetirados: CursoPendiente[] = this.horariosPendientesReprogramacion().flatMap((horario) => {
      if (horario.seccionId !== this.seccionIdActual()) return [];
      const asignacion = this.asignaciones().find((item) => item.id === horario.asignacionId);
      return asignacion ? [{ key: `retirado-${horario.id}`, horarioPendienteId: horario.id, asignacion }] : [];
    });
    const asignacionesConRetiro = new Set(pendientesRetirados.map((item) => item.asignacion.id));
    const asignacionesSinHorario = this.asignacionesPendientes()
      .filter((asignacion) => !asignacionesConRetiro.has(asignacion.id))
      .map((asignacion) => ({ key: `asignacion-${asignacion.id}`, asignacion }));
    return [...pendientesRetirados, ...asignacionesSinHorario];
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
  readonly bloquesAsignacion = computed(() => {
    const targetNivelId = this.nivelAsignacion() ?? this.nivelId();
    return this.bloques().filter((bloque) => bloque.nivelId === targetNivelId && this.tipoDeBloque(bloque) === 'CLASE');
  });

  bloquesVaciosPorDia(dia: DiaSemana): BloqueHorario[] {
    const horariosDelDia = this.horariosPorDia(dia);
    const bloquesOcupados = new Set(horariosDelDia.map((h) => h.bloqueHorarioId));
    return this.bloquesAsignacion().filter((bloque) => !bloquesOcupados.has(bloque.id));
  }
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
        const actual = periodos.filter((item) => item.estado === 'ACTIVO').sort((a, b) => b.anio - a.anio)[0]
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

  cambiarPeriodo(value: string | number): void {
    const id = Number(value) || null;
    this.periodoId.set(id);
    this.horarioEditandoId.set(null);
    this.seccionIdActual.set(null);
    this.vista.set('secciones');
    this.modalBloqueAbierto.set(false);
    this.submodalBloqueAbierto.set(false);
    this.dragItem.set(null);
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
      && this.cursos().some((curso) => curso.id === item.cursoId && curso.nivelId === seccion?.nivelId));
    const nivelId = seccion?.nivelId ?? this.nivelId();
    if (!seccion || !nivelId) return;
    this.nivelId.set(nivelId);
    this.seccionIdActual.set(seccionId);
    this.asignacionId.set(asignacion?.id ?? null);
    this.bloqueHorarioId.set(null);
    this.horarioEditandoId.set(null);
    this.cargarBloques();
    this.vista.set('semanal');
    setTimeout(() => this.ajustarAltoHorario(), 60);
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
    if (!this.esPeriodoEditable()) return;
    const nivel = this.nivelesCategoria().find((item) => item.id === this.nivelId()) ?? this.nivelesCategoria()[0];
    if (!nivel) {
      this.mostrarAlerta('warning', 'Nivel sin cursos', `No hay cursos activos de ${this.categoriaNivel().toLowerCase()} para configurar bloques.`);
      return;
    }
    this.nivelId.set(nivel.id);
    this.nuevoNombre = '';
    this.nuevoTipoBloque.set('CLASE');
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
    if (!this.esPeriodoEditable()) return;
    this.nuevoNombre = '';
    this.nuevoTipoBloque.set('CLASE');
    this.nuevaHoraInicio = this.opcionesInicioBloque()[0] ?? '';
    this.nuevaHoraFin = this.calcularFinBloque(this.nuevaHoraInicio);
    this.submodalBloqueAbierto.set(true);
  }

  cerrarSubmodalBloque(): void {
    if (!this.guardando()) this.submodalBloqueAbierto.set(false);
  }

  cambiarTipoNuevoBloque(tipo: TipoBloqueHorario): void {
    const tipoAnterior = this.nuevoTipoBloque();
    this.nuevoTipoBloque.set(tipo);
    const nombresPredeterminados: Record<TipoBloqueHorario, string> = {
      CLASE: 'Clase', RECREO: 'Recreo', TUTORIA: 'Tutoría - salida'
    };
    if (!this.nuevoNombre || this.nuevoNombre === nombresPredeterminados[tipoAnterior]) {
      this.nuevoNombre = nombresPredeterminados[tipo];
    }
    if (!this.opcionesInicioBloque().includes(this.nuevaHoraInicio)) {
      this.nuevaHoraInicio = this.opcionesInicioBloque()[0] ?? '';
    }
    this.nuevaHoraFin = this.calcularFinBloque(this.nuevaHoraInicio);
  }

  tipoDeBloque(bloque: Pick<BloqueHorario, 'tipoBloque' | 'esRecreo'>): TipoBloqueHorario {
    return bloque.tipoBloque ?? (bloque.esRecreo ? 'RECREO' : 'CLASE');
  }

  duracionConfigurada(nivelId: number | null, tipo: TipoBloqueHorario | boolean): number {
    const periodo = this.periodoSeleccionado();
    const secundaria = this.niveles().find((nivel) => nivel.id === nivelId)?.nombre.toUpperCase().includes('SECUNDARIA') ?? false;
    const tipoBloque = typeof tipo === 'boolean' ? (tipo ? 'RECREO' : 'CLASE') : tipo;
    if (tipoBloque !== 'CLASE') {
      return secundaria ? periodo?.duracionRecreoSecundariaMinutos ?? 20 : periodo?.duracionRecreoPrimariaMinutos ?? 20;
    }
    return secundaria ? periodo?.duracionHoraSecundariaMinutos ?? 90 : periodo?.duracionHoraPrimariaMinutos ?? 50;
  }

  limitesJornada(nivelId: number | null): { inicio: number; fin: number } {
    const periodo = this.periodoSeleccionado();
    const secundaria = this.niveles().find((nivel) => nivel.id === nivelId)?.nombre.toUpperCase().includes('SECUNDARIA') ?? false;
    const inicio = secundaria ? periodo?.horaInicioJornadaSecundaria : periodo?.horaInicioJornadaPrimaria;
    const fin = secundaria ? periodo?.horaFinJornadaSecundaria : periodo?.horaFinJornadaPrimaria;
    return { inicio: this.minutos(inicio ?? '07:00'), fin: this.minutos(fin ?? '18:00') };
  }

  calcularFinHorario(inicio: string, nivelId: number, tipo: TipoBloqueHorario | boolean): string {
    return inicio ? this.formatearMinuto(this.minutos(inicio) + this.duracionConfigurada(nivelId, tipo)) : '';
  }

  opcionesInicioEdicion(bloque: BloqueHorario): string[] {
    const duracion = this.duracionConfigurada(bloque.nivelId, this.tipoDeBloque(bloque));
    const { inicio: limiteInicio, fin: limiteFin } = this.limitesJornada(bloque.nivelId);
    const otros = this.bloques().filter((item) => item.nivelId === bloque.nivelId && item.id !== bloque.id);
    const valores = new Set<number>([limiteInicio, this.minutos(bloque.horaInicio)]);
    otros.forEach((item) => valores.add(this.minutos(item.horaFin)));
    return [...valores]
      .filter((inicio) => inicio >= limiteInicio && inicio + duracion <= limiteFin
        && otros.every((item) => inicio >= this.minutos(item.horaFin)
          || inicio + duracion <= this.minutos(item.horaInicio)))
      .sort((a, b) => a - b)
      .map((minuto) => this.formatearMinuto(minuto));
  }

  cambiarInicioEdicion(bloqueId: number, horaInicio: string): void {
    this.bloques.update((items) => items.map((item) => item.id === bloqueId
      ? { ...item, horaInicio, horaFin: this.calcularFinHorario(horaInicio, item.nivelId, this.tipoDeBloque(item)) }
      : item));
  }

  bloqueHorarioValido(bloque: BloqueHorario): boolean {
    const { fin: limiteFin } = this.limitesJornada(bloque.nivelId);
    return this.opcionesInicioEdicion(bloque).includes(bloque.horaInicio.slice(0, 5))
      && this.minutos(bloque.horaFin) - this.minutos(bloque.horaInicio) === this.duracionConfigurada(bloque.nivelId, this.tipoDeBloque(bloque))
      && this.minutos(bloque.horaFin) <= limiteFin;
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
    const { fin: limiteFin } = this.jornadaConfigurada();
    return Boolean(this.nuevaHoraInicio && this.nuevaHoraFin)
      && this.opcionesInicioBloque().includes(this.nuevaHoraInicio)
      && this.minutos(this.nuevaHoraInicio) < this.minutos(this.nuevaHoraFin)
      && this.minutos(this.nuevaHoraFin) - this.minutos(this.nuevaHoraInicio) === this.duracionBloqueNuevo()
      && this.minutos(this.nuevaHoraFin) <= limiteFin;
  }

  duracionHueco(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (!horas) return `${resto} min`;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
  }

  cambiarAsignacion(value: string): void {
    this.asignacionId.set(Number(value) || null);
    this.horarioPendienteSeleccionadoId.set(null);
    this.bloqueHorarioId.set(null);
    const bloque = this.bloquesAsignacion()[0];
    this.bloqueHorarioId.set(bloque?.id ?? null);
  }

  seleccionarAsignacionPendiente(asignacionId: number): void {
    this.cambiarAsignacion(String(asignacionId));
  }

  seleccionarCursoPendiente(pendiente: CursoPendiente): void {
    this.cambiarAsignacion(String(pendiente.asignacion.id));
    this.horarioPendienteSeleccionadoId.set(pendiente.horarioPendienteId ?? null);
  }

  cambiarBloque(value: string): void {
    this.bloqueHorarioId.set(Number(value) || null);
  }

  guardarBloque(): void {
    if (!this.esPeriodoEditable()) return;
    const periodoAcademicoId = this.periodoId();
    const nivelId = this.nivelId();
    if (!periodoAcademicoId || !nivelId) {
      this.mostrarAlerta('warning', 'No se puede crear el bloque', 'Selecciona un período y un nivel antes de guardar.');
      return;
    }
    if (!this.nuevoNombre.trim()) {
      this.mostrarAlerta('warning', 'Falta el nombre', 'Escribe un nombre para el bloque antes de continuar.');
      return;
    }
    if (!this.validarRangoNuevoBloque()) {
      this.mostrarAlerta('warning', 'Rango no disponible', 'El horario seleccionado ya no es válido. Elige uno de los espacios libres disponibles.');
      return;
    }
    const orden = Math.max(0, ...this.bloques().map((item) => item.orden)) + 1;
    this.guardando.set(true);
    const tipoBloque = this.nuevoTipoBloque();
    this.horarioService.crearBloque({ periodoAcademicoId, nivelId, nombre: this.nuevoNombre.trim(), orden, horaInicio: this.nuevaHoraInicio, horaFin: this.nuevaHoraFin, tipoBloque, esRecreo: tipoBloque === 'RECREO' })
      .subscribe({
        next: (creado) => {
          this.bloques.update((items) => [...items, creado].sort((a, b) => a.orden - b.orden));
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
    if (!this.esPeriodoEditable()) return;
    const periodoAcademicoId = this.periodoId();
    if (!periodoAcademicoId) return;
    this.guardando.set(true);
    this.horarioService.actualizarBloque(bloque.id, {
      periodoAcademicoId, nivelId: bloque.nivelId, nombre: bloque.nombre.trim(), orden: bloque.orden,
      horaInicio: bloque.horaInicio, horaFin: bloque.horaFin,
      tipoBloque: this.tipoDeBloque(bloque), esRecreo: this.tipoDeBloque(bloque) === 'RECREO'
    }).subscribe({
      next: (actualizado) => {
        this.bloques.update((items) => items.map((item) => item.id === actualizado.id ? actualizado : item));
        this.mostrarAlerta('success', 'Bloque actualizado', 'Los cambios del bloque se guardaron correctamente.');
        this.guardando.set(false);
      },
      error: (e) => this.mostrarError(e, 'No se pudo actualizar el bloque.')
    });
  }

  desactivarBloque(bloque: BloqueHorario): void {
    if (!this.esPeriodoEditable()) return;
    this.horarioService.cambiarEstadoBloque(bloque.id, false).subscribe({
      next: () => { this.mostrarAlerta('success', 'Bloque desactivado', 'El bloque ya no estará disponible para programar clases.'); this.cargarBloques(); },
      error: (e) => this.mostrarError(e, 'No se pudo desactivar el bloque.')
    });
  }

  cargarPlantillaSanMarcos(): void {
    if (!this.esPeriodoEditable()) return;
    const nivelId = this.nivelId();
    const periodoAcademicoId = this.periodoId();
    const nivel = this.niveles().find((item) => item.id === nivelId)?.nombre.toUpperCase();
    if (!nivelId || !periodoAcademicoId || this.bloques().length) return;
    const horarios = nivel?.includes('SECUND')
      ? [['Bloque 1', '07:45', '09:15'], ['Bloque 2', '09:30', '11:00'], ['Bloque 3', '11:00', '12:30'], ['Bloque 4', '12:45', '14:15']]
      : [['Bloque 1', '08:00', '08:50'], ['Bloque 2', '08:50', '09:40'], ['Bloque 3', '10:00', '10:50'], ['Bloque 4', '10:50', '11:40'], ['Bloque 5', '12:00', '12:50'], ['Bloque 6', '12:50', '13:40']];
    const payloads: BloqueHorarioPayload[] = horarios.map(([nombre, horaInicio, horaFin], index) => ({
      periodoAcademicoId, nivelId, nombre, horaInicio, horaFin, orden: index + 1, esRecreo: false, tipoBloque: 'CLASE'
    }));
    this.guardando.set(true);
    from(payloads).pipe(concatMap((payload) => this.horarioService.crearBloque(payload)), toArray()).subscribe({
      next: () => { this.mostrarAlerta('success', 'Plantilla cargada', 'Se agregaron los bloques de referencia. Puedes editarlos para ajustarlos.'); this.cargarBloques(); },
      error: (e) => this.mostrarError(e, 'No se pudo cargar la plantilla completa.'),
      complete: () => this.guardando.set(false)
    });
  }

  guardarHorario(): void {
    if (!this.esPeriodoEditable()) return;
    const asignacionId = this.asignacionId();
    const bloqueHorarioId = this.bloqueHorarioId();
    if (!asignacionId || !bloqueHorarioId) return;
    const horarioPendienteId = !this.horarioEditandoId() ? this.horarioPendienteSeleccionadoId() : null;
    const payload = { asignacionId, bloqueHorarioId, diaSemana: this.diaSemana(), ...(horarioPendienteId ? { horarioPendienteId } : {}) };
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
        if (horarioPendienteId) {
          this.horariosPendientesReprogramacion.update((items) => items.filter((pendiente) => pendiente.id !== horarioPendienteId));
          this.horarioPendienteSeleccionadoId.set(null);
        }
        this.mostrarAlerta('success', horarioId ? 'Programación actualizada' : 'Clase programada', horarioId
          ? 'Los cambios de la clase se guardaron correctamente.'
          : 'La clase se repetirá según el día y bloque asignados durante el período académico.');
        this.guardando.set(false);
      },
      error: (e) => this.mostrarError(e, horarioId ? 'No se pudo actualizar la programación.' : 'No se pudo programar la clase.')
    });
  }

  iniciarEdicionHorario(item: HorarioSemanal): void {
    if (!this.esPeriodoEditable()) return;
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
    if (!this.esPeriodoEditable()) return;
    this.horarioService.cambiarEstado(item.id, false, true).subscribe({
      next: () => {
        this.horarios.update((items) => items.filter((horario) => horario.id !== item.id));
        this.horariosPendientesReprogramacion.update((items) => [...items.filter((horario) => horario.id !== item.id), item]);
        this.mostrarAlerta('success', 'Clase retirada', 'La clase quedó disponible en Cursos pendientes para programarla nuevamente.');
      },
      error: (e) => this.mostrarError(e, 'No se pudo retirar la clase.')
    });
  }

  // ==========================================
  // DRAG & DROP PROGRAMMING
  // ==========================================

  iniciarArrastrePendiente(event: DragEvent, pendiente: CursoPendiente): void {
    if (!this.esPeriodoEditable()) { event.preventDefault(); return; }
    const asignacion = pendiente.asignacion;
    this.dragItem.set({
      tipo: 'PENDIENTE',
      asignacionId: asignacion.id,
      curso: asignacion.curso,
      docente: asignacion.docenteNombreCompleto,
      cursoId: asignacion.cursoId,
      horarioPendienteId: pendiente.horarioPendienteId
    });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', JSON.stringify({ tipo: 'PENDIENTE', asignacionId: asignacion.id, horarioPendienteId: pendiente.horarioPendienteId }));
    }
  }

  iniciarArrastreHorario(event: DragEvent, item: HorarioSemanal): void {
    if (!this.esPeriodoEditable()) { event.preventDefault(); return; }
    this.dragItem.set({
      tipo: 'HORARIO',
      horarioId: item.id,
      asignacionId: item.asignacionId,
      curso: item.curso,
      docente: item.docente,
      cursoId: item.cursoId,
      diaSemana: item.diaSemana,
      bloqueId: item.bloqueHorarioId
    });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ tipo: 'HORARIO', horarioId: item.id, asignacionId: item.asignacionId }));
    }
  }

  finalizarArrastre(): void {
    this.dragItem.set(null);
    this.dropTargetSlot.set(null);
    this.dropTargetClassId.set(null);
    this.dropTargetUnschedule.set(false);
  }

  isDropTarget(dia: DiaSemana, bloqueId: number): boolean {
    const t = this.dropTargetSlot();
    return t !== null && t.dia === dia && t.bloqueId === bloqueId;
  }

  isDropTargetClass(horarioId: number): boolean {
    return this.dropTargetClassId() === horarioId;
  }

  onDragOverSlot(event: DragEvent, dia: DiaSemana, bloqueId: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const cur = this.dropTargetSlot();
    if (!cur || cur.dia !== dia || cur.bloqueId !== bloqueId) {
      this.dropTargetSlot.set({ dia, bloqueId });
      this.dropTargetClassId.set(null);
    }
  }

  onDragLeaveSlot(event: DragEvent, dia: DiaSemana, bloqueId: number): void {
    const cur = this.dropTargetSlot();
    if (cur && cur.dia === dia && cur.bloqueId === bloqueId) {
      this.dropTargetSlot.set(null);
    }
  }

  onDropOnSlot(event: DragEvent, dia: DiaSemana, bloqueId: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.esPeriodoEditable()) return;
    const data = this.dragItem();
    this.finalizarArrastre();
    if (!data) return;

    if (data.tipo === 'PENDIENTE') {
      this.programarAsignacionEnSlot(data.asignacionId, dia, bloqueId, data.horarioPendienteId);
    } else if (data.tipo === 'HORARIO' && data.horarioId) {
      if (data.diaSemana === dia && data.bloqueId === bloqueId) return;
      this.moverHorarioASlot(data.horarioId, data.asignacionId, dia, bloqueId);
    }
  }

  onDragOverOccupied(event: DragEvent, item: HorarioSemanal): void {
    const data = this.dragItem();
    if (!data || (data.tipo === 'HORARIO' && data.horarioId === item.id)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dropTargetClassId() !== item.id) {
      this.dropTargetClassId.set(item.id);
      this.dropTargetSlot.set(null);
    }
  }

  onDragLeaveOccupied(event: DragEvent, item: HorarioSemanal): void {
    if (this.dropTargetClassId() === item.id) {
      this.dropTargetClassId.set(null);
    }
  }

  onDropOnOccupied(event: DragEvent, itemExistente: HorarioSemanal): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.esPeriodoEditable()) return;
    const data = this.dragItem();
    this.finalizarArrastre();
    if (!data) return;

    if (data.tipo === 'HORARIO' && data.horarioId) {
      if (data.horarioId === itemExistente.id) return;
      this.intercambiarHorarios(data, itemExistente);
    } else if (data.tipo === 'PENDIENTE') {
      this.mostrarAlerta(
        'warning',
        'Horario ocupado',
        `El bloque ya está asignado a "${itemExistente.curso}". Arrastra el curso a una celda disponible o retira primero la clase programada.`
      );
    }
  }

  onDragOverUnschedule(event: DragEvent): void {
    if (this.dragItem()?.tipo !== 'HORARIO') return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTargetUnschedule.set(true);
  }

  onDragLeaveUnschedule(event: DragEvent): void {
    this.dropTargetUnschedule.set(false);
  }

  onDropUnschedule(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.esPeriodoEditable()) return;
    const data = this.dragItem();
    this.finalizarArrastre();
    if (!data || data.tipo !== 'HORARIO' || !data.horarioId) return;

    const itemAQuitar = this.horarios().find((h) => h.id === data.horarioId);
    if (itemAQuitar) {
      this.quitarHorario(itemAQuitar);
    }
  }

  programarAsignacionEnSlot(asignacionId: number, diaSemana: DiaSemana, bloqueHorarioId: number, horarioPendienteId?: number): void {
    if (!this.esPeriodoEditable()) return;
    const payload = { asignacionId, bloqueHorarioId, diaSemana, ...(horarioPendienteId ? { horarioPendienteId } : {}) };
    this.guardando.set(true);
    this.horarioService.crear(payload).subscribe({
      next: (item) => {
        this.horarios.update((items) => [...items, item]);
        if (horarioPendienteId) {
          this.horariosPendientesReprogramacion.update((items) => items.filter((pendiente) => pendiente.id !== horarioPendienteId));
        }
        this.guardando.set(false);
        this.mostrarAlerta(
          'success',
          'Clase programada',
          `Se ubicó "${item.curso}" el ${this.etiquetaDia(diaSemana)} en ${item.bloque}.`
        );
      },
      error: (e) => {
        this.guardando.set(false);
        this.mostrarError(e, 'No se pudo programar la clase en este bloque.');
      }
    });
  }

  moverHorarioASlot(horarioId: number, asignacionId: number, diaSemana: DiaSemana, bloqueHorarioId: number): void {
    if (!this.esPeriodoEditable()) return;
    const payload = { asignacionId, bloqueHorarioId, diaSemana };
    this.guardando.set(true);
    this.horarioService.actualizar(horarioId, payload).subscribe({
      next: (item) => {
        this.horarios.update((items) => items.map((h) => h.id === item.id ? item : h));
        this.guardando.set(false);
        this.mostrarAlerta(
          'success',
          'Horario reubicado',
          `Se trasladó "${item.curso}" a ${this.etiquetaDia(diaSemana)} en ${item.bloque}.`
        );
      },
      error: (e) => {
        this.guardando.set(false);
        this.mostrarError(e, 'No se pudo mover la clase a este horario.');
      }
    });
  }

  intercambiarHorarios(itemA: DragItemData, itemB: HorarioSemanal): void {
    if (!this.esPeriodoEditable()) return;
    if (!itemA.horarioId || !itemA.diaSemana || !itemA.bloqueId) return;
    this.guardando.set(true);
    this.horarioService.cambiarEstado(itemB.id, false).pipe(
      switchMap(() =>
        this.horarioService.actualizar(itemA.horarioId!, {
          asignacionId: itemA.asignacionId,
          diaSemana: itemB.diaSemana,
          bloqueHorarioId: itemB.bloqueHorarioId
        })
      ),
      switchMap((horarioAActualizado) =>
        this.horarioService.crear({
          asignacionId: itemB.asignacionId,
          diaSemana: itemA.diaSemana!,
          bloqueHorarioId: itemA.bloqueId!
        }).pipe(
          map((horarioBNuevo) => ({ horarioA: horarioAActualizado, horarioB: horarioBNuevo }))
        )
      )
    ).subscribe({
      next: ({ horarioA, horarioB }) => {
        this.horarios.update((items) =>
          items.filter((h) => h.id !== itemB.id && h.id !== itemA.horarioId)
            .concat([horarioA, horarioB])
        );
        this.guardando.set(false);
        this.mostrarAlerta(
          'success',
          'Clases intercambiadas',
          `Se intercambió "${horarioA.curso}" con "${horarioB.curso}".`
        );
      },
      error: (e) => {
        this.guardando.set(false);
        if (this.periodoId()) {
          this.cargarAsignaciones(this.periodoId()!);
        }
        this.mostrarError(e, 'No se pudieron intercambiar los horarios.');
      }
    });
  }

  seleccionarCeldaVacia(dia: DiaSemana, bloqueId: number): void {
    this.diaSemana.set(dia);
    this.bloqueHorarioId.set(bloqueId);
    const pendientes = this.asignacionesPendientes();
    if (pendientes.length && (!this.asignacionId() || !pendientes.some((p) => p.id === this.asignacionId()))) {
      this.asignacionId.set(pendientes[0].id);
    }
  }


  etiquetaDia(value: DiaSemana): string {
    return this.dias.find((dia) => dia.value === value)?.label ?? value;
  }

  formatearHora(hora: string): string {
    return hora?.slice(0, 5) ?? '';
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.ajustarAltoHorario();
  }

  ajustarAltoHorario(): void {
    if (this.vista() !== 'semanal') return;
    const scrollEl: HTMLElement | null = this.elementRef.nativeElement.querySelector('.section-timetable-scroll');
    if (!scrollEl) return;
    const clientHeight = scrollEl.clientHeight;
    const headerHeight = 44;
    const available = clientHeight - headerHeight;
    const rango = this.rangoProgramacion();
    const horas = (rango.fin - rango.inicio) / 60;
    if (horas > 0 && available > 150) {
      const ideal = Math.max(100, Math.floor(available / horas));
      if (this.altoHora() !== ideal) {
        this.altoHora.set(ideal);
      }
    }
  }

  porcentajeProgramacion(seccion: ResumenSeccion): number {
    return seccion.asignaciones ? Math.round((seccion.programadas / seccion.asignaciones) * 100) : 0;
  }

  readonly mapaTonoCursos = computed(() => {
    const mapa = new Map<number, number>();
    const totalTonos = 16;

    // 1. Obtener todos los cursos de la sección actual
    const cursosSeccion = new Set<number>();
    for (const a of this.asignacionesSeccion()) {
      cursosSeccion.add(a.cursoId);
    }
    for (const h of this.horariosSeccion()) {
      cursosSeccion.add(h.cursoId);
    }

    // Ordenar alfabéticamente para que cada curso siempre conserve su color
    const seccionOrdenada = [...cursosSeccion].sort((a, b) => {
      const nombreA = this.cursos().find((c) => c.id === a)?.nombre ?? '';
      const nombreB = this.cursos().find((c) => c.id === b)?.nombre ?? '';
      return nombreA.localeCompare(nombreB, 'es') || (a - b);
    });

    let toneIndex = 0;
    seccionOrdenada.forEach((cursoId) => {
      mapa.set(cursoId, (toneIndex % totalTonos) + 1);
      toneIndex++;
    });

    // 2. Registrar los demás cursos del catálogo por consistencia
    const otrosCursos = this.cursos()
      .filter((c) => !mapa.has(c.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || (a.id - b.id));

    otrosCursos.forEach((c) => {
      mapa.set(c.id, (toneIndex % totalTonos) + 1);
      toneIndex++;
    });

    return mapa;
  });

  tonoClase(item: HorarioSemanal): string {
    const tono = this.mapaTonoCursos().get(item.cursoId);
    return `tone-${tono ?? ((item.cursoId % 16) + 1)}`;
  }

  tonoCursoPorId(cursoId: number): string {
    const tono = this.mapaTonoCursos().get(cursoId);
    return `tone-${tono ?? ((cursoId % 16) + 1)}`;
  }

  posicionProgramacion(item: HorarioSemanal): number {
    return Math.max(0, ((this.minutos(item.horaInicio) - this.rangoProgramacion().inicio) / 60) * this.altoHora() + 2);
  }

  altoProgramacion(item: HorarioSemanal): number {
    const duracion = this.minutos(item.horaFin) - this.minutos(item.horaInicio);
    return Math.max(48, (duracion / 60) * this.altoHora() - 4);
  }

  posicionBloque(bloque: BloqueHorario): number {
    return Math.max(0, ((this.minutos(bloque.horaInicio) - this.rangoProgramacion().inicio) / 60) * this.altoHora() + 2);
  }

  altoBloque(bloque: BloqueHorario): number {
    const duracion = this.minutos(bloque.horaFin) - this.minutos(bloque.horaInicio);
    return Math.max(26, (duracion / 60) * this.altoHora() - 4);
  }

  posicionMarcaProgramacion(minuto: number): number {
    return ((minuto - this.rangoProgramacion().inicio) / 60) * this.altoHora();
  }

  formatearMinuto(minuto: number): string {
    return `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`;
  }

  private cargarAsignaciones(periodoId: number): void {
    this.cargando.set(true);
    forkJoin({
      asignaciones: this.asignacionesService.listarPorPeriodo(periodoId),
      horarios: this.horarioService.listar(periodoId),
      horariosPendientesReprogramacion: this.horarioService.listarPendientesReprogramacion(periodoId),
      secciones: this.seccionesService.listar(periodoId)
    }).subscribe({
      next: ({ asignaciones, horarios, horariosPendientesReprogramacion, secciones }) => {
        const activas = asignaciones.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
        this.asignaciones.set(activas);
        this.secciones.set(secciones);
        this.horarios.set(horarios);
        this.horariosPendientesReprogramacion.set(horariosPendientesReprogramacion);
        const niveles = new Map<number, string>();
        this.cursos()
          .filter((curso) => (curso.estado ?? 'ACTIVO') === 'ACTIVO')
          .forEach((curso) => {
            niveles.set(curso.nivelId, curso.nivelNombre);
        });
        secciones
          .filter((seccion) => (seccion.estado ?? 'ACTIVO') === 'ACTIVO' && seccion.nivelId && seccion.nivelNombre)
          .forEach((seccion) => niveles.set(seccion.nivelId!, seccion.nivelNombre!));
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
        const bloquesDeClase = items.filter((item) => this.tipoDeBloque(item) === 'CLASE');
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
