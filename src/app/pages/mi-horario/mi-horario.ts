import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomAlertComponent, CustomAlertType } from '../../components/custom-alert/custom-alert';
import { Shell } from '../../layouts/shell/shell';
import { PeriodoAcademico } from '../../models/periodo-academico';
import { PeriodoEvaluacion } from '../../models/periodo-evaluacion';
import { BloqueHorario, DiaSemana, HorarioSemanal } from '../../models/horario';
import { forkJoin } from 'rxjs';
import { HorarioService } from '../../services/academico/horario.service';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { PeriodoEvaluacionService } from '../../services/academico/periodo-evaluacion.service';
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

interface DiaInfo {
  value: DiaSemana;
  label: string;
  short: string;
  clases?: ClaseHorarioVisual[];
}

interface ClaseHorarioVisual extends HorarioSemanal {
  bloquesContinuos: number;
}

@Component({
  selector: 'app-mi-horario',
  imports: [Shell, FormsModule, CustomAlertComponent],
  templateUrl: './mi-horario.html',
  styleUrl: './mi-horario.scss'
})
export class MiHorario implements OnInit, OnDestroy {
  private readonly periodosService = inject(PeriodoAcademicoService);
  private readonly horarioService = inject(HorarioService);
  private readonly periodoEvaluacionService = inject(PeriodoEvaluacionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Altura por cada hora en píxeles (brinda espacio amplio para atajos de Asistencia y Notas)
  readonly HOUR_HEIGHT = 120;

  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodoId = signal<number | null>(null);
  readonly seccionIdVista = signal<number | null>(null);
  readonly etiquetaSeccionVista = signal<string | null>(null);
  readonly periodosEvaluacion = signal<PeriodoEvaluacion[]>([]);
  readonly periodoEvaluacionId = signal<number | null>(null);
  readonly horarios = signal<HorarioSemanal[]>([]);
  readonly recreos = signal<BloqueHorario[]>([]);
  readonly cargando = signal(true);
  readonly alertState = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Entendido',
    cancelText: null,
    autoCloseMs: null
  });
  readonly animandoCambioPeriodo = signal(false);

  // Navegación de semana y fecha
  readonly fechaReferencia = signal<Date>(new Date());
  readonly mostrarFinDeSemana = signal<boolean>(false);
  readonly horaActualMinutos = signal<number>(this.obtenerMinutosAhora());
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly diasDefinicion: DiaInfo[] = [
    { value: 'LUNES', label: 'Lunes', short: 'LUN' },
    { value: 'MARTES', label: 'Martes', short: 'MAR' },
    { value: 'MIERCOLES', label: 'Miércoles', short: 'MIÉ' },
    { value: 'JUEVES', label: 'Jueves', short: 'JUE' },
    { value: 'VIERNES', label: 'Viernes', short: 'VIE' },
    { value: 'SABADO', label: 'Sábado', short: 'SÁB' },
    { value: 'DOMINGO', label: 'Domingo', short: 'DOM' }
  ];

  readonly lunesSemana = computed(() => this.obtenerLunesSemana(this.fechaReferencia()));

  readonly numeroSemana = computed(() => this.obtenerNumeroSemana(this.lunesSemana()));

  readonly esSemanaActual = computed(() => {
    const lunesHoy = this.obtenerLunesSemana(new Date());
    const lunesActual = this.lunesSemana();
    return this.fechaKey(lunesHoy) === this.fechaKey(lunesActual);
  });

  readonly periodoSeleccionado = computed(() => this.periodos().find((item) => item.id === this.periodoId()) ?? null);

  readonly periodosEvaluacionDelPeriodo = computed(() => {
    const academico = this.periodoSeleccionado();
    if (!academico) return [];
    return this.periodosEvaluacion()
      .filter((item) => item.periodoAcademicoId === academico.id)
      .sort((a, b) => a.numero - b.numero);
  });

  readonly periodoEvaluacionSeleccionado = computed(() => this.periodosEvaluacionDelPeriodo()
    .find((item) => item.id === this.periodoEvaluacionId()) ?? null);

  // Restricciones de navegación al año del período académico
  readonly puedeRetrocederSemana = computed(() => {
    const periodo = this.periodoSeleccionado();
    const anioPeriodo = periodo?.anio || new Date().getFullYear();
    const lunes = this.lunesSemana();
    const prevLunes = new Date(lunes);
    prevLunes.setDate(prevLunes.getDate() - 7);
    const prevViernes = new Date(prevLunes);
    prevViernes.setDate(prevViernes.getDate() + 4);

    if (prevViernes.getFullYear() < anioPeriodo) return false;
    if (periodo?.fechaInicio) {
      const inicio = this.parseFecha(periodo.fechaInicio);
      if (prevViernes < inicio) return false;
    }
    return true;
  });

  readonly puedeAvanzarSemana = computed(() => {
    const periodo = this.periodoSeleccionado();
    const anioPeriodo = periodo?.anio || new Date().getFullYear();
    const lunes = this.lunesSemana();
    const nextLunes = new Date(lunes);
    nextLunes.setDate(nextLunes.getDate() + 7);

    if (nextLunes.getFullYear() > anioPeriodo) return false;
    if (periodo?.fechaFin) {
      const fin = this.parseFecha(periodo.fechaFin);
      if (nextLunes > fin) return false;
    }
    return true;
  });

  readonly textoRangoSemana = computed(() => {
    const lunes = this.lunesSemana();
    const cantDias = this.mostrarFinDeSemana() ? 6 : 4;
    const fin = new Date(lunes);
    fin.setDate(lunes.getDate() + cantDias);

    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const diaInicio = lunes.getDate();
    const diaFin = fin.getDate();
    const mesInicio = meses[lunes.getMonth()];
    const mesFin = meses[fin.getMonth()];
    const anioInicio = lunes.getFullYear();
    const anioFin = fin.getFullYear();

    if (anioInicio !== anioFin) {
      return `${diaInicio} de ${mesInicio.slice(0, 3)}, ${anioInicio} – ${diaFin} de ${mesFin.slice(0, 3)}, ${anioFin}`;
    }
    if (mesInicio !== mesFin) {
      return `${diaInicio} de ${mesInicio} – ${diaFin} de ${mesFin}, ${anioInicio}`;
    }
    return `${diaInicio} – ${diaFin} de ${mesInicio}, ${anioInicio}`;
  });

  readonly columnasDias = computed(() => {
    const lunes = this.lunesSemana();
    const limite = this.mostrarFinDeSemana() ? 7 : 5;
    const diasActivos = this.diasDefinicion.slice(0, limite);
    const hoyStr = this.fechaLocalHoy();

    return diasActivos.map((diaDef, index) => {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + index);
      const fechaStr = this.fechaKey(fecha);
      const esHoy = fechaStr === hoyStr;
      const clases = this.agruparClasesContinuas(this.horarios()
        .filter((item) => item.diaSemana === diaDef.value)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));

      return {
        ...diaDef,
        indice: index,
        fecha,
        fechaStr,
        numero: fecha.getDate(),
        esHoy,
        clases
      };
    });
  });

  readonly semanaContieneHoy = computed(() => {
    const hoyStr = this.fechaLocalHoy();
    return this.columnasDias().some((d) => d.fechaStr === hoyStr);
  });

  readonly estaEnRangoHorario = computed(() => {
    const m = this.horaActualMinutos();
    return m >= this.rango().inicio && m <= this.rango().fin;
  });

  readonly posicionAhora = computed(() => {
    const m = this.horaActualMinutos();
    const horas = m / 60;
    return (horas - this.rango().inicioHora) * this.HOUR_HEIGHT;
  });

  readonly rango = computed(() => {
    const items = this.horarios();
    const tiempos = [
      ...items.flatMap((item) => [this.minutos(item.horaInicio), this.minutos(item.horaFin)]),
      ...this.recreosVisibles().flatMap((item) => [this.minutos(item.horaInicio), this.minutos(item.horaFin)])
    ];
    const horaMin = tiempos.length ? Math.floor(Math.min(...tiempos) / 60) : 8;
    const horaMax = tiempos.length ? Math.ceil(Math.max(...tiempos) / 60) : 18;
    const inicioHora = Math.min(8, horaMin);
    const finHora = Math.max(18, horaMax);
    const horasCount = finHora - inicioHora;
    const marcas = new Set<number>([inicioHora * 60, finHora * 60]);
    for (const item of items) {
      marcas.add(this.minutos(item.horaInicio));
      marcas.add(this.minutos(item.horaFin));
    }
    for (const item of this.recreosVisibles()) {
      marcas.add(this.minutos(item.horaInicio));
      marcas.add(this.minutos(item.horaFin));
    }
    return {
      inicioHora,
      finHora,
      inicio: inicioHora * 60,
      fin: finHora * 60,
      horasCount,
      marcas: [...marcas].sort((a, b) => a - b)
    };
  });

  readonly recreosVisibles = computed(() => {
    const niveles = new Set(this.horarios().map((horario) => horario.nivel.toLocaleUpperCase()));
    const recreos = this.recreos().filter((recreo) => niveles.has(recreo.nivel.toLocaleUpperCase()));
    const unicos = new Map<string, BloqueHorario>();
    for (const recreo of recreos) {
      const clave = `${recreo.horaInicio.slice(0, 5)}-${recreo.horaFin.slice(0, 5)}`;
      if (!unicos.has(clave)) unicos.set(clave, recreo);
    }
    return [...unicos.values()].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  });

  ngOnInit(): void {
    const seccionId = Number(this.route.snapshot.paramMap.get('seccionId')) || null;
    this.seccionIdVista.set(seccionId);
    this.etiquetaSeccionVista.set(this.route.snapshot.queryParamMap.get('seccionLabel'));
    const periodoSolicitadoId = Number(this.route.snapshot.queryParamMap.get('periodoAcademicoId')) || null;
    if (seccionId) this.mostrarFinDeSemana.set(false);

    this.periodoEvaluacionService.listar().subscribe({
      next: (periodos) => {
        this.periodosEvaluacion.set(periodos);
        this.seleccionarPeriodoEvaluacion();
      },
      error: () => this.periodosEvaluacion.set([])
    });

    this.periodosService.listar().subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);
        const solicitado = periodos.find((item) => item.id === periodoSolicitadoId);
        const actual = solicitado ?? periodos.find((item) => item.estado === 'ACTIVO')
          ?? periodos.find((item) => item.anio === new Date().getFullYear())
          ?? periodos[0];
        if (!actual) {
          this.mostrarAlerta('warning', 'No hay período académico', 'No se encontró un período académico para consultar.');
          this.cargando.set(false);
          return;
        }
        this.periodoId.set(actual.id);
        this.seleccionarPeriodoEvaluacion();
        this.cargar(actual.id);
      },
      error: (e) => this.mostrarError(e)
    });

    // Actualizador de tiempo actual cada minuto
    this.timerInterval = setInterval(() => {
      this.horaActualMinutos.set(this.obtenerMinutosAhora());
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  semanaAnterior(): void {
    if (!this.puedeRetrocederSemana()) return;
    this.fechaReferencia.update((f) => {
      const d = new Date(f);
      d.setDate(d.getDate() - 7);
      return d;
    });
    this.animarCambioCalendario();
  }

  semanaSiguiente(): void {
    if (!this.puedeAvanzarSemana()) return;
    this.fechaReferencia.update((f) => {
      const d = new Date(f);
      d.setDate(d.getDate() + 7);
      return d;
    });
    this.animarCambioCalendario();
  }

  irASemanaActual(): void {
    this.fechaReferencia.set(new Date());
    this.animarCambioCalendario();
  }

  toggleFinDeSemana(): void {
    this.mostrarFinDeSemana.update((val) => !val);
  }

  abrirAsistencia(clase: HorarioSemanal, fechaDia?: string): void {
    if (this.seccionIdVista()) return;
    const academico = this.periodoSeleccionado();
    const evaluacion = this.periodoEvaluacionSeleccionado();
    const fechaInicio = evaluacion?.fechaInicio ?? academico?.fechaInicio;
    const fechaFin = evaluacion?.fechaFin ?? academico?.fechaFin;
    if (!fechaInicio || !fechaFin) return;

    let fecha = fechaDia;
    if (!fecha || fecha < fechaInicio || fecha > fechaFin) {
      const hoy = this.fechaLocalHoy();
      const fechaBase = hoy < fechaInicio || hoy > fechaFin ? fechaInicio : hoy;
      fecha = this.proximaFechaDelDia(fechaBase, clase.diaSemana);
    }

    if (fecha > fechaFin) {
      this.mostrarAlerta('warning', 'Sin sesiones disponibles', 'No quedan sesiones de esta clase dentro del período seleccionado.');
      return;
    }
    this.router.navigate(['/asistencias'], { queryParams: { asignacionId: clase.asignacionId, fecha, horarioId: clase.id } });
  }

  abrirNotas(clase: HorarioSemanal): void {
    if (this.seccionIdVista()) return;
    this.router.navigate([`/mis-asignaciones/${clase.asignacionId}/notas`]);
  }

  volverASeccionesTutoradas(): void {
    this.router.navigate(['/seccion-tutorada']);
  }

  formatearHora(minutos: number): string {
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  }

  limpiarHora(hora: string): string {
    if (!hora) return '';
    const parts = hora.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return hora;
  }

  obtenerColumnaDia(indice: number): number {
    return indice + 2;
  }

  posicionMarca(marca: number): number {
    return ((marca - this.rango().inicio) / 60) * this.HOUR_HEIGHT;
  }

  posicionClase(clase: HorarioSemanal): number {
    const offsetMinutos = this.minutos(clase.horaInicio) - this.rango().inicio;
    return (offsetMinutos / 60) * this.HOUR_HEIGHT + 3;
  }

  altoClase(clase: ClaseHorarioVisual): number {
    const duracionMinutos = this.minutos(clase.horaFin) - this.minutos(clase.horaInicio);
    return Math.max(28, (duracionMinutos / 60) * this.HOUR_HEIGHT - 6);
  }

  posicionRecreo(recreo: BloqueHorario): number {
    return ((this.minutos(recreo.horaInicio) - this.rango().inicio) / 60) * this.HOUR_HEIGHT + 2;
  }

  altoRecreo(recreo: BloqueHorario): number {
    const duracion = this.minutos(recreo.horaFin) - this.minutos(recreo.horaInicio);
    return Math.max(20, (duracion / 60) * this.HOUR_HEIGHT - 4);
  }

  tonoClase(clase: HorarioSemanal): string {
    return `tone-${(clase.cursoId % 6) + 1}`;
  }

  cerrarAlerta(): void {
    this.alertState.update((state) => ({ ...state, open: false }));
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    const solicitud = this.seccionIdVista()
      ? this.horarioService.listarPorSeccion(this.seccionIdVista()!, id)
      : this.horarioService.listarMios(id);
    forkJoin({ horarios: solicitud, recreos: this.horarioService.listarRecreos(id) }).subscribe({
      next: ({ horarios, recreos }) => {
        this.horarios.set(horarios);
        this.recreos.set(recreos);
        if (horarios.some((item) => item.diaSemana === 'SABADO' || item.diaSemana === 'DOMINGO')) {
          this.mostrarFinDeSemana.set(true);
        }
        this.cargando.set(false);
      },
      error: (e) => this.mostrarError(e)
    });
  }

  private agruparClasesContinuas(clases: HorarioSemanal[]): ClaseHorarioVisual[] {
    const agrupadas: ClaseHorarioVisual[] = [];

    for (const clase of clases) {
      const anterior = agrupadas[agrupadas.length - 1];
      const mismaAsignacion = anterior && anterior.asignacionId === clase.asignacionId;
      const sonContiguas = anterior && this.minutos(anterior.horaFin) === this.minutos(clase.horaInicio);

      if (mismaAsignacion && sonContiguas) {
        anterior.horaFin = clase.horaFin;
        anterior.bloquesContinuos += 1;
        continue;
      }

      agrupadas.push({ ...clase, bloquesContinuos: 1 });
    }

    return agrupadas;
  }

  private seleccionarPeriodoEvaluacion(): void {
    const evaluaciones = this.periodosEvaluacionDelPeriodo();
    if (!evaluaciones.length) {
      this.periodoEvaluacionId.set(null);
      return;
    }
    if (evaluaciones.some((item) => item.id === this.periodoEvaluacionId())) return;
    const hoy = this.fechaLocalHoy();
    const seleccionada = evaluaciones.find((item) => hoy >= item.fechaInicio && hoy <= item.fechaFin)
      ?? evaluaciones.find((item) => hoy < item.fechaInicio)
      ?? evaluaciones[evaluaciones.length - 1];
    this.periodoEvaluacionId.set(seleccionada.id);
  }

  private animarCambioCalendario(): void {
    this.animandoCambioPeriodo.set(false);
    requestAnimationFrame(() => this.animandoCambioPeriodo.set(true));
    window.setTimeout(() => this.animandoCambioPeriodo.set(false), 480);
  }

  private obtenerLunesSemana(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  private obtenerNumeroSemana(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private obtenerMinutosAhora(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  private proximaFechaDelDia(desde: string, dia: DiaSemana): string {
    const fecha = this.parseFecha(desde);
    const diaObjetivo = this.diasDefinicion.findIndex((item) => item.value === dia);
    while ((fecha.getDay() + 6) % 7 !== diaObjetivo) {
      fecha.setDate(fecha.getDate() + 1);
    }
    return this.fechaKey(fecha);
  }

  private parseFecha(fecha: string): Date {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private fechaKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private fechaLocalHoy(): string {
    return this.fechaKey(new Date());
  }

  private mostrarError(error: unknown): void {
    this.mostrarAlerta('error', 'No se pudo cargar el horario', formatearMensajeError(error, 'No se pudo cargar tu horario.'));
    this.cargando.set(false);
  }

  private mostrarAlerta(type: CustomAlertType, title: string, message: string): void {
    this.alertState.set({ open: true, type, title, message, confirmText: 'Entendido', cancelText: null, autoCloseMs: null });
  }

  private minutos(hora: string): number {
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
  }
}
