import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Login } from './login';
import { AuthService } from '../../../services/auth/auth.service';

const REMEMBER_KEY = 'auth_remembered_credentials';

describe('Login Component - Recordar Contraseña', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let authServiceMock: {
    login: ReturnType<typeof vi.fn>;
    solicitarRecuperacion: ReturnType<typeof vi.fn>;
    verificarRecuperacion: ReturnType<typeof vi.fn>;
    cambiarPasswordRecuperacion: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();

    authServiceMock = {
      login: vi.fn().mockReturnValue(
        of({
          token: 'fake-jwt',
          tipoToken: 'Bearer',
          expiracionSegundos: 3600,
          usuario: {
            usuarioId: 1,
            docenteId: null,
            username: 'profesor1',
            correo: 'profesor1@escuela.edu',
            roles: ['DOCENTE'],
            esTutor: false,
            debeCambiarPassword: false,
            permisos: []
          }
        })
      ),
      solicitarRecuperacion: vi.fn(),
      verificarRecuperacion: vi.fn(),
      cambiarPasswordRecuperacion: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('debe iniciar con el formulario vacio y recordar en false si no hay datos guardados', () => {
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.form.controls.identificador.value).toBe('');
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.recordar.value).toBe(false);
  });

  it('debe autocompletar usuario, contrasena y marcar recordar si existen credenciales guardadas', () => {
    const credenciales = { identificador: 'admin_test', password: 'SecretPassword123!' };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(credenciales))));
    localStorage.setItem(REMEMBER_KEY, encoded);

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.form.controls.identificador.value).toBe('admin_test');
    expect(component.form.controls.password.value).toBe('SecretPassword123!');
    expect(component.form.controls.recordar.value).toBe(true);
  });

  it('debe eliminar las credenciales de localStorage si el usuario desmarca la opcion recordar', () => {
    const credenciales = { identificador: 'admin_test', password: 'SecretPassword123!' };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(credenciales))));
    localStorage.setItem(REMEMBER_KEY, encoded);

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(localStorage.getItem(REMEMBER_KEY)).toBeTruthy();

    component.form.controls.recordar.setValue(false);

    expect(localStorage.getItem(REMEMBER_KEY)).toBeNull();
  });

  it('debe guardar credenciales en localStorage tras un inicio de sesion exitoso con recordar activado', () => {
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.setValue({
      identificador: 'docente_nuevo',
      password: 'MiPasswordSeguro!',
      recordar: true
    });

    component.iniciarSesion();

    expect(authServiceMock.login).toHaveBeenCalledWith({
      identificador: 'docente_nuevo',
      password: 'MiPasswordSeguro!'
    });

    const storedRaw = localStorage.getItem(REMEMBER_KEY);
    expect(storedRaw).toBeTruthy();

    const decoded = JSON.parse(decodeURIComponent(escape(atob(storedRaw!))));
    expect(decoded.identificador).toBe('docente_nuevo');
    expect(decoded.password).toBe('MiPasswordSeguro!');
  });

  it('debe eliminar credenciales de localStorage si se inicia sesion con recordar desactivado', () => {
    localStorage.setItem(REMEMBER_KEY, 'datos_viejos');

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.setValue({
      identificador: 'docente_nuevo',
      password: 'MiPasswordSeguro!',
      recordar: false
    });

    component.iniciarSesion();

    expect(localStorage.getItem(REMEMBER_KEY)).toBeNull();
  });

  describe('Restriccion de espacios en contrasenas', () => {
    it('debe prevenir el evento de teclado cuando se presiona la barra espaciadora', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { key: ' ' });
      const preventSpy = vi.spyOn(event, 'preventDefault');

      component.bloquearEspacio(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('no debe prevenir el evento de teclado para otras teclas', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const event = new KeyboardEvent('keydown', { key: 'a' });
      const preventSpy = vi.spyOn(event, 'preventDefault');

      component.bloquearEspacio(event);

      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('debe remover espacios reactivamente si se introducen en el campo password', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.form.controls.password.setValue('mi pass word con espacios');

      expect(component.form.controls.password.value).toBe('mipasswordconespacios');
    });

    it('debe remover espacios en nuevaPassword y confirmarPassword en recoveryForm', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.recoveryForm.controls.nuevaPassword.setValue('nueva pass 123');
      component.recoveryForm.controls.confirmarPassword.setValue('confirmar pass 123');

      expect(component.recoveryForm.controls.nuevaPassword.value).toBe('nuevapass123');
      expect(component.recoveryForm.controls.confirmarPassword.value).toBe('confirmarpass123');
    });

    it('debe limpiar espacios manualmente mediante limpiarEspacios si se dispara evento de input', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.form.controls.password.setValue('texto con espacios', { emitEvent: false });
      component.limpiarEspacios('password', 'form');

      expect(component.form.controls.password.value).toBe('textoconespacios');
    });
  });

  describe('Conmutador de Modo Oscuro / Claro en el Login', () => {
    it('debe alternar el tema al llamar a toggleTema()', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const estadoInicial = component.isDark();
      component.toggleTema();
      expect(component.isDark()).toBe(!estadoInicial);

      component.toggleTema();
      expect(component.isDark()).toBe(estadoInicial);
    });

    it('debe renderizar el boton de tema con la clase login-theme-toggle', () => {
      fixture = TestBed.createComponent(Login);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const botonTema = fixture.nativeElement.querySelector('.login-theme-toggle');
      expect(botonTema).toBeTruthy();
    });
  });
});
