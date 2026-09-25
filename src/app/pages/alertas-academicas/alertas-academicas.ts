import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Shell } from '../../layouts/shell/shell';
import { AlertaAcademica } from '../../models/alerta-academica';
import { AlertaAcademicaService } from '../../services/alerta/alerta-academica.service';

@Component({
  selector: 'app-alertas-academicas',
  imports: [Shell],
  templateUrl: './alertas-academicas.html',
  styleUrl: './alertas-academicas.scss'
})
export class AlertasAcademicas implements OnInit {
  private readonly router = inject(Router);
  private readonly alertaService = inject(AlertaAcademicaService);

  readonly cargando = signal(true);
  readonly alertas = signal<AlertaAcademica[]>([]);
  readonly filtro = signal<'PENDIENTE' | 'ATENDIDA' | 'TODAS'>('PENDIENTE');
  readonly error = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.alertaService.listar(this.filtro()).subscribe({
      next: (alertas) => {
        this.alertas.set(alertas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las alertas académicas.');
        this.cargando.set(false);
      }
    });
  }

  cambiarFiltro(filtro: 'PENDIENTE' | 'ATENDIDA' | 'TODAS'): void {
    this.filtro.set(filtro);
    this.cargar();
  }

  abrir(alerta: AlertaAcademica): void {
    if (alerta.tipo === 'ASISTENCIA_PENDIENTE') {
      void this.router.navigate(['/asistencias'], {
        queryParams: {
          asignacionId: alerta.asignacionId,
          fecha: this.fechaIso(alerta.fechaReferencia),
          horarioId: alerta.horarioId
        }
      });
      return;
    }

    if (alerta.evaluacionId) {
      void this.router.navigate(['/mis-asignaciones', alerta.asignacionId, 'notas'], {
        queryParams: { periodoEvaluacionId: alerta.periodoEvaluacionId, evaluacionId: alerta.evaluacionId }
      });
    }
  }

  fechaCorta(fecha: string): string {
    const valor = this.fechaIso(fecha);
    const [anio, mes, dia] = valor.split('-').map(Number);
    if (!anio || !mes || !dia) return valor;
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(anio, mes - 1, dia)));
  }

  private fechaIso(fecha: string): string {
    if (Array.isArray(fecha)) {
      const [anio, mes, dia] = fecha as unknown as number[];
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
    return String(fecha).slice(0, 10);
  }
}
