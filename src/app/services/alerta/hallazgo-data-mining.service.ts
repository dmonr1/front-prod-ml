import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface HallazgoDataMining {
  id: number;
  periodoAcademicoId: number;
  periodoEvaluacionId: number | null;
  periodoEvaluacion: string | null;
  seccionId: number | null;
  seccion: string | null;
  cursoId: number | null;
  curso: string | null;
  codigo: string | null;
  tipo: string;
  titulo: string;
  descripcion: string;
  nivelRelevancia: string;
  fuente: string;
  resultado: string | null;
  fechaGeneracion: string | null;
}

@Injectable({ providedIn: 'root' })
export class HallazgoDataMiningService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/hallazgos`;

  listar(periodoEvaluacionId: number, seccionId: number): Observable<HallazgoDataMining[]> {
    return this.http.get<HallazgoDataMining[]>(this.api, {
      params: { periodoEvaluacionId, seccionId }
    });
  }

  generar(periodoEvaluacionId: number, seccionId: number): Observable<HallazgoDataMining[]> {
    return this.http.post<HallazgoDataMining[]>(`${this.api}/generar`, null, {
      params: { periodoEvaluacionId, seccionId }
    });
  }
}
