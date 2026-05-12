import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Alumno } from '../../models/alumno';
import { Matricula } from '../../models/matricula';

export interface AlumnoPayload {
  codigo: string;
  dni: string | null;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  sexo: string | null;
  direccion: string | null;
  nombreApoderado: string | null;
  telefonoApoderado: string | null;
}

export interface AlumnoMatriculaPayload {
  alumno: AlumnoPayload;
  seccionId: number;
  periodoAcademicoId: number;
}

@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/alumnos`;

  listar(): Observable<Alumno[]> {
    return this.http.get<Alumno[]>(this.api);
  }

  crear(payload: AlumnoPayload): Observable<Alumno> {
    return this.http.post<Alumno>(this.api, payload);
  }

  crearYMatricular(payload: AlumnoMatriculaPayload): Observable<Matricula> {
    return this.http.post<Matricula>(`${this.api}/registro-seccion`, payload);
  }
}
