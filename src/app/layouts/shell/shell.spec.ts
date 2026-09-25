import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsuarioSesion } from '../../models/auth';
import { PeriodoAcademicoService } from '../../services/academico/periodo-academico.service';
import { AsignacionAcademicaService } from '../../services/asignaciones/asignacion-academica.service';
import { TutoriaService } from '../../services/asignaciones/tutoria.service';
import { AuthService } from '../../services/auth/auth.service';
import { Shell } from './shell';

describe('Shell sidebar permissions', () => {
  let usuario: UsuarioSesion;
  let asignaciones: Array<{ estado: string }>;
  let tutorias: Array<{ estado: string }>;

  beforeEach(() => {
    usuario = {
      usuarioId: 1, docenteId: null, username: 'usuario', correo: 'usuario@colegio.edu',
      roles: ['ADMIN'], esTutor: false, debeCambiarPassword: false, permisos: ['ROLE_ADMIN']
    };
    asignaciones = [];
    tutorias = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { obtenerUsuario: () => usuario } },
        { provide: PeriodoAcademicoService, useValue: { listar: () => of([
          { id: 1, anio: new Date().getFullYear(), estado: 'ACTIVO' }
        ]) } },
        { provide: AsignacionAcademicaService, useValue: {
          listarAsignaciones: vi.fn(() => of(asignaciones))
        } },
        { provide: TutoriaService, useValue: {
          listarPorDocente: vi.fn(() => of(tutorias))
        } }
      ]
    });
  });

  const rutas = (shell: Shell) => shell.menuItems().flatMap((item) =>
    item.children?.map((child) => child.path) ?? (item.path ? [item.path] : [])
  );

  it('no muestra vistas personales a un administrador sin docente vinculado', () => {
    const shell = TestBed.runInInjectionContext(() => new Shell());
    expect(rutas(shell)).toContain('/predicciones');
    expect(rutas(shell)).toContain('/gestion-estudiantil');
    expect(rutas(shell)).not.toContain('/mis-asignaciones');
    expect(rutas(shell)).not.toContain('/seccion-tutorada');
  });

  it('trata al director como gestor institucional, sin otorgarle vistas personales vacias', () => {
    usuario = { ...usuario, roles: ['DIRECTOR_ACADEMICO'], permisos: ['ROLE_DIRECTOR_ACADEMICO', 'ROLE_ADMIN'] };
    const rutasDirector = rutas(TestBed.runInInjectionContext(() => new Shell()));
    expect(rutasDirector).toContain('/gestion-estudiantil');
    expect(rutasDirector).toContain('/predicciones');
    expect(rutasDirector).not.toContain('/mi-horario');
  });

  it('solo muestra las vistas docentes si existe una asignacion activa', () => {
    usuario = { ...usuario, docenteId: 2, roles: ['DOCENTE'], permisos: ['ROLE_DOCENTE'] };
    asignaciones = [{ estado: 'INACTIVO' }];
    expect(rutas(TestBed.runInInjectionContext(() => new Shell()))).toEqual(['/docente']);

    asignaciones = [{ estado: 'ACTIVO' }];
    const rutasActivas = rutas(TestBed.runInInjectionContext(() => new Shell()));
    expect(rutasActivas).toContain('/mi-horario');
    expect(rutasActivas).toContain('/mis-asignaciones');
    expect(rutasActivas).toContain('/asistencias');
    expect(rutasActivas).toContain('/hallazgos');
  });

  it('muestra solo la seccion tutorada al tutor sin cursos asignados', () => {
    usuario = { ...usuario, docenteId: 2, roles: ['DOCENTE_TUTOR'], esTutor: true };
    tutorias = [{ estado: 'ACTIVO' }];
    const rutasTutor = rutas(TestBed.runInInjectionContext(() => new Shell()));
    expect(rutasTutor).toContain('/seccion-tutorada');
    expect(rutasTutor).not.toContain('/mis-asignaciones');
    expect(rutasTutor).not.toContain('/predicciones');
  });

  it('no ofrece Mi horario al administrador sin rol docente', () => {
    usuario = { ...usuario, docenteId: 2 };
    asignaciones = [{ estado: 'ACTIVO' }];
    const rutasAdmin = rutas(TestBed.runInInjectionContext(() => new Shell()));
    expect(rutasAdmin).toContain('/mis-asignaciones');
    expect(rutasAdmin).toContain('/asistencias');
    expect(rutasAdmin).not.toContain('/mi-horario');
  });

  it('mantiene cursos visibles si falla solo la consulta de tutorias', () => {
    usuario = { ...usuario, docenteId: 2, roles: ['DOCENTE'] };
    asignaciones = [{ estado: 'ACTIVO' }];
    vi.spyOn(TestBed.inject(TutoriaService), 'listarPorDocente').mockReturnValue(throwError(() => new Error('sin tutorias')));
    const rutasDocente = rutas(TestBed.runInInjectionContext(() => new Shell()));
    expect(rutasDocente).toContain('/mis-asignaciones');
    expect(rutasDocente).not.toContain('/seccion-tutorada');
  });

  it('espera la comprobacion de asignaciones antes de mostrar accesos', () => {
    usuario = { ...usuario, docenteId: 2, roles: ['DOCENTE'] };
    const respuesta = new Subject<unknown[]>();
    const periodos = TestBed.inject(PeriodoAcademicoService);
    vi.spyOn(periodos, 'listar').mockReturnValue(respuesta as ReturnType<PeriodoAcademicoService['listar']>);
    const shell = TestBed.runInInjectionContext(() => new Shell());
    expect(rutas(shell)).toEqual(['/docente']);
  });
});
