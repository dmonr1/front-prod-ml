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
  readonly periodos = signal<PeriodoAcademico[]>([]);
  readonly periodoId = signal<number | null>(null);
  readonly periodoSeleccionado = computed(() => this.periodos().find((item) => item.id === this.periodoId()) ?? null);
  readonly niveles = signal<NivelOpcion[]>([]);
  readonly nivelId = signal<number | null>(null);
  readonly asignaciones = signal<AsignacionDocente[]>([]);
  readonly cursos = signal<Curso[]>([]);
  readonly bloques = signal<BloqueHorario[]>([]);
  readonly horarios = signal<HorarioSemanal[]>([]);
  readonly vista = signal<'bloques' | 'semanal'>('bloques');
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly alertState = signal<AlertState>({ open: false, type: 'info', title: '', message: '', confirmText: 'Entendido', cancelText: null, autoCloseMs: null });
  readonly asignacionId = signal<number | null>(null);
  readonly diaSemana = signal<DiaSemana>('LUNES');
  readonly bloqueHorarioId = signal<number | null>(null);
  nuevoNombre = '';
  nuevaHoraInicio = '';
  nuevaHoraFin = '';
  readonly nivelAsignacion = computed(() => {
    const asignacion = this.asignaciones().find((item) => item.id === this.asignacionId());
    return this.cursos().find((curso) => curso.id === asignacion?.cursoId)?.nivelId ?? null;
  });
  readonly bloquesAsignacion = computed(() => this.bloques().filter((bloque) => bloque.nivelId === this.nivelAsignacion()));
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
    if (id) this.cargarAsignaciones(id);
  }

  cambiarNivel(value: string): void {
    this.nivelId.set(Number(value) || null);
    this.cargarBloques();
  }

  cambiarAsignacion(value: string): void {
    this.asignacionId.set(Number(value) || null);
    const nivelId = this.nivelAsignacion();
    if (nivelId) this.nivelId.set(nivelId);
    this.bloqueHorarioId.set(null);
    this.cargarBloques();
  }

  cambiarBloque(value: string): void {
    this.bloqueHorarioId.set(Number(value) || null);
  }

  guardarBloque(): void {
    const periodoAcademicoId = this.periodoId();
    const nivelId = this.nivelId();
    if (!periodoAcademicoId || !nivelId || !this.nuevoNombre.trim() || !this.nuevaHoraInicio || !this.nuevaHoraFin) return;
    const orden = Math.max(0, ...this.bloques().map((item) => item.orden)) + 1;
    this.guardando.set(true);
    this.horarioService.crearBloque({ periodoAcademicoId, nivelId, nombre: this.nuevoNombre.trim(), orden, horaInicio: this.nuevaHoraInicio, horaFin: this.nuevaHoraFin })
      .subscribe({
        next: () => {
          this.nuevoNombre = '';
          this.nuevaHoraInicio = '';
          this.nuevaHoraFin = '';
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
      horaInicio: bloque.horaInicio, horaFin: bloque.horaFin
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
      periodoAcademicoId, nivelId, nombre, horaInicio, horaFin, orden: index + 1
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
    this.guardando.set(true);
    this.horarioService.crear({ asignacionId, bloqueHorarioId, diaSemana: this.diaSemana() }).subscribe({
      next: (item) => {
        this.horarios.update((items) => [...items, item]);
        this.mostrarAlerta('success', 'Clase programada', 'La clase se repetirá según el día y bloque asignados durante el período académico.');
        this.guardando.set(false);
      },
      error: (e) => this.mostrarError(e, 'No se pudo programar la clase.')
    });
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

  private cargarAsignaciones(periodoId: number): void {
    this.cargando.set(true);
    forkJoin({ asignaciones: this.asignacionesService.listarPorPeriodo(periodoId), horarios: this.horarioService.listar(periodoId) }).subscribe({
      next: ({ asignaciones, horarios }) => {
        const activas = asignaciones.filter((item) => (item.estado ?? 'ACTIVO') === 'ACTIVO');
        this.asignaciones.set(activas);
        this.horarios.set(horarios);
        const niveles = new Map<number, string>();
        activas.forEach((asignacion) => {
          const curso = this.cursos().find((item) => item.id === asignacion.cursoId);
          if (curso) niveles.set(curso.nivelId, curso.nivelNombre);
        });
        this.niveles.set([...niveles].map(([id, nombre]) => ({ id, nombre })));
        if (!this.niveles().some((nivel) => nivel.id === this.nivelId())) this.nivelId.set(this.niveles()[0]?.id ?? null);
        if (!this.asignaciones().some((item) => item.id === this.asignacionId())) this.asignacionId.set(activas[0]?.id ?? null);
        const nivelAsignacion = this.nivelAsignacion();
        if (nivelAsignacion) this.nivelId.set(nivelAsignacion);
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
      next: (items) => this.bloques.set(items),
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
}
