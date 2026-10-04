import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface RegistroAuditoria {
  id: string;
  modulo: string;
  tipoEvento: string;
  descripcion: string;
  entidadAfectada: string;
  usuarioUsername: string;
  usuarioNombre: string;
  nivelCriticidad: 'CRITICO' | 'ADVERTENCIA' | 'INFO';
  fechaEvento: string;
  detalleAdicional?: string;
}

export interface EstadisticasAuditoria {
  totalEventos: number;
  totalCriticos: number;
  totalAdvertencias: number;
  totalInformativos: number;
  totalEdicionesAsistencia: number;
  totalCargasArchivos: number;
  totalModificacionesEvaluacion: number;
}

export interface FiltrosAuditoria {
  modulo?: string;
  nivelCriticidad?: string;
  busqueda?: string;
  fechaInicio?: string;
  fechaFin?: string;
  limite?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/auditoria`;

  listarLogs(filtros?: FiltrosAuditoria): Observable<RegistroAuditoria[]> {
    let params = new HttpParams();
    if (filtros?.modulo) params = params.set('modulo', filtros.modulo);
    if (filtros?.nivelCriticidad) params = params.set('nivelCriticidad', filtros.nivelCriticidad);
    if (filtros?.busqueda) params = params.set('busqueda', filtros.busqueda);
    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros?.limite) params = params.set('limite', filtros.limite.toString());

    return this.http.get<RegistroAuditoria[]>(`${this.api}/logs`, { params });
  }

  obtenerEstadisticas(): Observable<EstadisticasAuditoria> {
    return this.http.get<EstadisticasAuditoria>(`${this.api}/estadisticas`);
  }
}
