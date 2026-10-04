import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Shell } from '../../layouts/shell/shell';
import {
  AuditoriaService,
  EstadisticasAuditoria,
  FiltrosAuditoria,
  RegistroAuditoria
} from '../../services/auditoria/auditoria.service';

@Component({
  selector: 'app-auditoria-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, Shell],
  templateUrl: './auditoria-logs.html',
  styleUrl: './auditoria-logs.scss'
})
export class AuditoriaLogs implements OnInit {
  private readonly auditoriaService = inject(AuditoriaService);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly logs = signal<RegistroAuditoria[]>([]);
  readonly estadisticas = signal<EstadisticasAuditoria | null>(null);
  readonly registroDetalle = signal<RegistroAuditoria | null>(null);

  // Filtros
  moduloFiltro = '';
  criticidadFiltro = '';
  busquedaTexto = '';
  fechaInicio = '';
  fechaFin = '';

  ngOnInit(): void {
    this.cargarEstadisticas();
    this.cargarLogs();
  }

  cargarLogs(): void {
    this.cargando.set(true);
    this.error.set(null);

    const filtros: FiltrosAuditoria = {
      modulo: this.moduloFiltro || undefined,
      nivelCriticidad: this.criticidadFiltro || undefined,
      busqueda: this.busquedaTexto.trim() || undefined,
      fechaInicio: this.fechaInicio || undefined,
      fechaFin: this.fechaFin || undefined,
      limite: 150
    };

    this.auditoriaService.listarLogs(filtros).subscribe({
      next: (data) => {
        this.logs.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron obtener los logs de auditoría.');
        this.cargando.set(false);
      }
    });
  }

  cargarEstadisticas(): void {
    this.auditoriaService.obtenerEstadisticas().subscribe({
      next: (stats) => this.estadisticas.set(stats),
      error: () => undefined
    });
  }

  aplicarFiltros(): void {
    this.cargarLogs();
  }

  limpiarFiltros(): void {
    this.moduloFiltro = '';
    this.criticidadFiltro = '';
    this.busquedaTexto = '';
    this.fechaInicio = '';
    this.fechaFin = '';
    this.cargarLogs();
  }

  abrirDetalle(log: RegistroAuditoria): void {
    this.registroDetalle.set(log);
  }

  cerrarDetalle(): void {
    this.registroDetalle.set(null);
  }

  obtenerClaseCriticidad(criticidad: string): string {
    switch (criticidad) {
      case 'CRITICO':
        return 'badge-danger';
      case 'ADVERTENCIA':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  }

  obtenerIconoModulo(modulo: string): string {
    switch (modulo) {
      case 'ASISTENCIA':
        return 'fa-solid fa-user-clock';
      case 'CARGA_MASIVA':
        return 'fa-solid fa-file-excel';
      case 'EVALUACION':
        return 'fa-solid fa-graduation-cap';
      default:
        return 'fa-solid fa-shield-halved';
    }
  }
}
