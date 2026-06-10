import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { CustomAlertComponent, CustomAlertType } from '../../../components/custom-alert/custom-alert';
import { AuthService } from '../../../services/auth/auth.service';

interface LoginAlertState {
  open: boolean;
  type: CustomAlertType;
  title: string;
  message: string;
  confirmText: string | null;
  cancelText: string | null;
  autoCloseMs: number | null;
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CustomAlertComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private animationContext: gsap.Context | null = null;
  private previewIntervalId: ReturnType<typeof setInterval> | null = null;
  private titleIntervalId: ReturnType<typeof setInterval> | null = null;

  @ViewChild('visualPanel', { static: true }) visualPanel?: ElementRef<HTMLElement>;
  @ViewChild('authCard', { static: true }) authCard?: ElementRef<HTMLElement>;

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly recoveryError = signal('');
  readonly recoverySuccess = signal('');
  readonly mostrarPassword = signal(false);
  readonly mostrarRecoveryPassword = signal(false);
  readonly mostrarRecoveryConfirmPassword = signal(false);
  readonly panelMode = signal<'login' | 'recover'>('login');
  readonly recoveryStep = signal<'solicitar' | 'verificar' | 'cambiar'>('solicitar');
  readonly recoveryLoading = signal(false);
  readonly recoveryToken = signal('');
  readonly introVisible = signal(true);
  readonly alertState = signal<LoginAlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Entendido',
    cancelText: null,
    autoCloseMs: null
  });
  readonly previewMode = signal<'global' | 'curso'>('global');
  readonly titleIndex = signal(0);
  readonly titlePhrases = [
    { badge: 'Seguimiento', title: 'de riesgo', tone: 'blue' },
    { badge: 'Predicción académica ', title: ' temprana', tone: 'amber' },
    { badge: 'Alertas', title: 'para actuar a tiempo', tone: 'rose' },
    { badge: 'Control inteligente', title: ' del rendimiento', tone: 'mint' }
  ] as const;
  readonly activeTitle = computed(() => this.titlePhrases[this.titleIndex()]);

  readonly form = this.fb.nonNullable.group({
    identificador: ['', Validators.required],
    password: ['', Validators.required],
    recordar: [false]
  });

  readonly recoveryForm = this.fb.nonNullable.group({
    identificador: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    codigo: ['', Validators.required],
    nuevaPassword: ['', Validators.required],
    confirmarPassword: ['', Validators.required]
  });

  readonly previewData = computed(() =>
    this.previewMode() === 'global'
      ? {
          headerTitle: 'Seguimiento global por alumno',
          switchLabel: 'Riesgo global',
          chips: ['PERIODO I', '1RO PRIMARIA A'],
          kpis: [
            { label: 'Alumnos evaluados', icon: 'users', tone: 'blue', valueWidth: '22%', detailWidth: '58%' },
            { label: 'Casos prioritarios', icon: 'target', tone: 'amber', valueWidth: '18%', detailWidth: '66%' },
            { label: 'Riesgo promedio', icon: 'chart', tone: 'blue', valueWidth: '30%', detailWidth: '72%' },
            { label: 'Riesgo alto', icon: 'alert', tone: 'rose', valueWidth: '16%', detailWidth: '52%' }
          ],
          chart: {
            title: 'Alumnos por nivel de riesgo',
            total: '6',
            segments: {
              high: 50,
              medium: 0,
              low: 50
            },
            legend: [
              { label: 'Riesgo alto', value: '50%', tone: 'high' },
              { label: 'Riesgo medio', value: '0%', tone: 'medium' },
              { label: 'Riesgo bajo', value: '50%', tone: 'low' }
            ]
          },
          rows: [
            { risk: 'BAJO', tone: 'low', failure: '3%', nameWidth: '72%' },
            { risk: 'ALTO', tone: 'high', failure: '77%', nameWidth: '64%' },
            { risk: 'MEDIO', tone: 'medium', failure: '39%', nameWidth: '58%' },
            { risk: 'BAJO', tone: 'low', failure: '8%', nameWidth: '68%' },
            { risk: 'ALTO', tone: 'high', failure: '62%', nameWidth: '54%' }
          ],
          sideTitle: 'Riesgo global',
          sideMetrics: [
            { label: 'Riesgo promedio de fracaso', valueWidth: '26%' },
            { label: 'Asistencia promedio', valueWidth: '22%' },
            { label: 'Meta de asistencia del periodo', valueWidth: '18%' },
            { label: 'Casos prioritarios', valueWidth: '20%' },
            { label: 'Riesgo alto', valueWidth: '24%' },
            { label: 'Inasistencias', valueWidth: '18%' },
            { label: 'Clases programadas', valueWidth: '22%' }
          ]
        }
      : {
          headerTitle: 'Seguimiento focalizado por curso',
          switchLabel: 'Riesgo por curso',
          chips: ['PERIODO I', '1RO PRIMARIA A'],
          kpis: [
            { label: 'Curso seleccionado', icon: 'book', tone: 'blue', valueWidth: '28%', detailWidth: '58%' },
            { label: 'Alumnos evaluados', icon: 'users-group', tone: 'blue', valueWidth: '18%', detailWidth: '56%' },
            { label: 'Riesgo promedio', icon: 'chart', tone: 'amber', valueWidth: '26%', detailWidth: '68%' },
            { label: 'Riesgo alto', icon: 'alert', tone: 'rose', valueWidth: '14%', detailWidth: '48%' }
          ],
          chart: {
            title: 'Cursos por nivel de riesgo',
            total: '6',
            segments: {
              high: 33,
              medium: 17,
              low: 50
            },
            legend: [
              { label: 'Riesgo alto', value: '33%', tone: 'high' },
              { label: 'Riesgo medio', value: '17%', tone: 'medium' },
              { label: 'Riesgo bajo', value: '50%', tone: 'low' }
            ]
          },
          rows: [
            { risk: 'BAJO', tone: 'low', failure: '8%', nameWidth: '70%' },
            { risk: 'ALTO', tone: 'high', failure: '94%', nameWidth: '62%' },
            { risk: 'MEDIO', tone: 'medium', failure: '28%', nameWidth: '56%' },
            { risk: 'BAJO', tone: 'low', failure: '15%', nameWidth: '66%' },
            { risk: 'MEDIO', tone: 'medium', failure: '44%', nameWidth: '60%' }
          ],
          sideTitle: 'Riesgo por curso',
          sideMetrics: [
            { label: 'Riesgo promedio de fracaso', valueWidth: '22%' },
            { label: 'Asistencia promedio', valueWidth: '24%' },
            { label: 'Meta de asistencia del periodo', valueWidth: '18%' },
            { label: 'Casos prioritarios', valueWidth: '26%' },
            { label: 'Riesgo alto', valueWidth: '20%' },
            { label: 'Inasistencias', valueWidth: '18%' },
            { label: 'Clases programadas', valueWidth: '24%' }
          ]
        }
  );

  ngAfterViewInit(): void {
    this.animationContext = gsap.context(() => {
      gsap.set('.login-title', { x: -42, opacity: 0 });
      gsap.set('.dashboard-preview', { y: 20, opacity: 0 });
      gsap.set('.login-shape, .login-decor-card', { opacity: 0, scale: 0.9, x: -24, y: 10 });
      gsap.set('.auth-card-shell', { x: 90, opacity: 0 });
      gsap.set('.auth-orbit', { opacity: 0 });
      gsap.set('.auth-orbit path', { strokeDashoffset: 100 });
      gsap.set('.auth-panel-stage--login h2', { y: 18, opacity: 0 });
      gsap.set(
        '.auth-panel-stage--login label, .auth-panel-stage--login .field-error, .auth-panel-stage--login .auth-form-meta, .auth-panel-stage--login .request-error, .auth-panel-stage--login .primary-button',
        { y: 16, opacity: 0 }
      );
      gsap.set('.auth-floating', { scale: 0.92, opacity: 0 });
      gsap.set('.login-intro-overlay', { opacity: 1 });
      gsap.set('.login-intro-text', { opacity: 0, x: -28 });
      gsap.set('.login-intro-text-inner', { clipPath: 'inset(0 0 0 0)' });

      const timeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
        paused: true
      });
      timeline
        .to('.auth-card-shell', {
          opacity: 1,
          x: 0,
          duration: 0.82,
          ease: 'power4.out'
        })
        .to(
          '.auth-panel-stage--login h2',
          {
            opacity: 1,
            y: 0,
            duration: 0.48,
            ease: 'power3.out'
          },
          '-=0.5'
        )
        .to(
          '.auth-panel-stage--login label, .auth-panel-stage--login .field-error, .auth-panel-stage--login .auth-form-meta, .auth-panel-stage--login .request-error, .auth-panel-stage--login .primary-button',
          {
            opacity: 1,
            y: 0,
            duration: 0.44,
            stagger: 0.08
          },
          '-=0.24'
        )
        .to(
          '.auth-orbit',
          {
            opacity: 1,
            duration: 0.4,
            stagger: 0.08
          },
          '-=0.5'
        )
        .to(
          '.auth-orbit path',
          {
            strokeDashoffset: 0,
            duration: 1.05,
            ease: 'power2.out',
            stagger: 0.12
          },
          '-=0.92'
        )
        .to(
          '.auth-floating',
          {
            opacity: 1,
            scale: 1,
            duration: 0.62,
            stagger: 0.08
          },
          '-=0.96'
        )
        .to(
          '.login-shape--circle-pink, .login-shape--capsule-cream, .login-decor-card--top',
          {
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            duration: 0.68,
            stagger: 0.1,
            ease: 'power3.out'
          },
          '-=1.02'
        )
        .to(
          '.dashboard-preview',
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out'
          },
          '-=0.96'
        )
        .to(
          '.login-title',
          {
            opacity: 1,
            x: 0,
            duration: 0.68,
            ease: 'power3.out'
          },
          '-=0.84'
        )
        .to(
          '.login-shape--circle-blue, .login-shape--quarter-peach, .login-decor-card--bottom',
          {
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            duration: 0.66,
            ease: 'power3.out'
          },
          '-=0.62'
        );

      const introTimeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          this.introVisible.set(false);
          timeline.play(0);
          this.iniciarRotacionesPreview();
        }
      });

      introTimeline
        .to('.login-intro-text', {
          opacity: 1,
          x: 0,
          duration: 0.58
        })
        .to('.login-intro-text-inner', {
          clipPath: 'inset(0 0 0 100%)',
          opacity: 0,
          duration: 0.74,
          ease: 'power2.inOut'
        }, '+=0.34')
        .to('.login-intro-overlay', {
          opacity: 0,
          duration: 0.34,
          ease: 'power2.out'
        }, '-=0.18');

      gsap.to('.login-shape--circle-pink', {
        y: -14,
        x: 12,
        duration: 5.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      gsap.to('.login-shape--quarter-peach', {
        y: 10,
        x: -8,
        duration: 6.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      gsap.to('.login-shape--circle-blue, .login-shape--capsule-cream', {
        y: -8,
        x: 8,
        duration: 5.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      gsap.to('.login-decor-card--top', {
        y: -10,
        rotation: -2,
        duration: 6.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: '50% 50%'
      });

      gsap.to('.login-decor-card--bottom', {
        y: 10,
        rotation: 2,
        duration: 6.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: '50% 50%'
      });

      gsap.to('.auth-orbit--one', {
        y: -18,
        x: 16,
        rotation: -4,
        duration: 6.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      gsap.to('.auth-orbit--two', {
        y: 16,
        x: -14,
        rotation: 5,
        duration: 7.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      gsap.to('.auth-orbit--three', {
        y: -12,
        x: -10,
        rotation: -6,
        duration: 5.9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }, this.host.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.previewIntervalId) {
      clearInterval(this.previewIntervalId);
    }
    if (this.titleIntervalId) {
      clearInterval(this.titleIntervalId);
    }
    this.animationContext?.revert();
  }

  tonoPreview(tono: 'low' | 'medium' | 'high'): string {
    return tono;
  }

  iniciarSesion(): void {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      if (this.form.controls.identificador.invalid && this.form.controls.password.invalid) {
        this.mostrarAlerta('warning', 'Faltan tus datos', 'Ingresa tu usuario y tu contrasena para continuar.');
      } else if (this.form.controls.identificador.invalid) {
        this.mostrarAlerta('warning', 'Falta el usuario', 'Ingresa tu usuario para iniciar sesion.');
      } else if (this.form.controls.password.invalid) {
        this.mostrarAlerta('warning', 'Falta la contrasena', 'Ingresa tu contrasena para iniciar sesion.');
      }
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    this.authService.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.cargando.set(false);
        this.router.navigateByUrl(this.obtenerRutaInicial(response.usuario.roles));
      },
      error: (error) => {
        this.cargando.set(false);
        this.error.set(
          error?.error?.mensaje ?? 'No se pudo iniciar sesión. Verifica tus credenciales.'
        );
      }
    });
  }

  campoInvalido(nombre: 'identificador' | 'password'): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword.update((value) => !value);
  }

  toggleMostrarRecoveryPassword(): void {
    this.mostrarRecoveryPassword.update((value) => !value);
  }

  toggleMostrarRecoveryConfirmPassword(): void {
    this.mostrarRecoveryConfirmPassword.update((value) => !value);
  }

  campoRecoveryInvalido(
    nombre: 'identificador' | 'correo' | 'codigo' | 'nuevaPassword' | 'confirmarPassword'
  ): boolean {
    const control = this.recoveryForm.controls[nombre];
    return control.invalid && control.touched;
  }

  enviarRecuperacion(): void {
    if (this.recoveryLoading()) {
      return;
    }

    const step = this.recoveryStep();
    if (step === 'solicitar') {
      this.solicitarCodigoRecuperacion();
      return;
    }

    if (step === 'verificar') {
      this.verificarCodigoRecuperacion();
      return;
    }

    this.actualizarContrasenaRecuperacion();
  }

  abrirRecuperacion(): void {
    if (this.panelMode() === 'recover') {
      return;
    }

    this.reiniciarRecuperacion();
    this.animarCambioPanel('recover');
  }

  volverAlLogin(): void {
    if (this.panelMode() === 'login') {
      return;
    }

    this.reiniciarRecuperacion();
    this.animarCambioPanel('login');
  }

  private obtenerRutaInicial(roles: string[]): string {
    if (roles.includes('ADMIN')) {
      return '/admin';
    }

    if (roles.includes('DOCENTE') || roles.includes('DOCENTE_TUTOR')) {
      return '/docente';
    }

    return '/login';
  }

  private animarCambioPreview(): void {
    if (!this.animationContext) {
      return;
    }

    gsap.fromTo(
      '.preview-donut',
      { scale: 0.94, rotate: -14 },
      {
        scale: 1,
        rotate: 0,
        duration: 0.72,
        ease: 'power3.out',
        clearProps: 'transform'
      }
    );

    gsap.fromTo(
      '.preview-donut-core',
      { opacity: 0.7, y: 4 },
      {
        opacity: 1,
        y: 0,
        duration: 0.56,
        ease: 'power2.out',
        clearProps: 'transform,opacity'
      }
    );

    gsap.fromTo(
      '.dashboard-preview [data-preview-anim]',
      { opacity: 0.72, y: 6, scale: 0.992 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.62,
        ease: 'power3.out',
        stagger: 0.06,
        clearProps: 'transform'
      }
    );
  }

  private animarCambioTitulo(): void {
    if (!this.animationContext) {
      return;
    }

    gsap.fromTo(
      '.login-title',
      { opacity: 0.35, x: -20 },
      {
        opacity: 1,
        x: 0,
        duration: 0.56,
        ease: 'power3.out'
      }
    );
  }

  private animarCambioPanel(mode: 'login' | 'recover'): void {
    this.panelMode.set(mode);
    this.error.set('');
  }

  cerrarAlerta(): void {
    this.alertState.set({
      open: false,
      type: 'info',
      title: '',
      message: '',
      confirmText: 'Entendido',
      cancelText: null,
      autoCloseMs: null
    });
  }

  private iniciarRotacionesPreview(): void {
    this.previewIntervalId = setInterval(() => {
      this.previewMode.update((mode) => (mode === 'global' ? 'curso' : 'global'));
      this.animarCambioPreview();
    }, 7000);

    this.titleIntervalId = setInterval(() => {
      this.titleIndex.update((value) => (value + 1) % this.titlePhrases.length);
      this.animarCambioTitulo();
    }, 5000);
  }

  private solicitarCodigoRecuperacion(): void {
    const { identificador, correo } = this.recoveryForm.getRawValue();
    if (!identificador || !correo || this.recoveryForm.controls.correo.invalid) {
      this.recoveryForm.controls.identificador.markAsTouched();
      this.recoveryForm.controls.correo.markAsTouched();
      if (!identificador && !correo) {
        this.mostrarAlerta('warning', 'Faltan tus datos', 'Ingresa tu usuario y tu correo institucional para enviarte el codigo.');
      } else if (!identificador) {
        this.mostrarAlerta('warning', 'Falta el usuario', 'Ingresa tu usuario para iniciar la recuperacion.');
      } else {
        this.mostrarAlerta('warning', 'Correo no valido', 'Ingresa un correo institucional valido para continuar.');
      }
      return;
    }

    this.recoveryLoading.set(true);
    this.recoveryError.set('');
    this.recoverySuccess.set('');

    this.authService.solicitarRecuperacion({ identificador, correo }).subscribe({
      next: (response) => {
        this.recoveryLoading.set(false);
        this.recoverySuccess.set(response.mensaje);
        this.recoveryStep.set('verificar');
        this.recoveryForm.controls.codigo.markAsUntouched();
      },
      error: (error) => {
        this.recoveryLoading.set(false);
        this.recoveryError.set(
          error?.error?.mensaje ?? 'No se pudo enviar el codigo de recuperacion.'
        );
      }
    });
  }

  private verificarCodigoRecuperacion(): void {
    const { identificador, codigo } = this.recoveryForm.getRawValue();
    if (!identificador || !codigo) {
      this.recoveryForm.controls.identificador.markAsTouched();
      this.recoveryForm.controls.codigo.markAsTouched();
      if (!identificador && !codigo) {
        this.mostrarAlerta('warning', 'Faltan datos de verificacion', 'Ingresa tu usuario y el codigo recibido en tu correo.');
      } else if (!identificador) {
        this.mostrarAlerta('warning', 'Falta el usuario', 'Ingresa tu usuario para verificar el codigo.');
      } else {
        this.mostrarAlerta('warning', 'Falta el codigo', 'Ingresa el codigo de verificacion para continuar.');
      }
      return;
    }

    this.recoveryLoading.set(true);
    this.recoveryError.set('');
    this.recoverySuccess.set('');

    this.authService.verificarRecuperacion({ identificador, codigo }).subscribe({
      next: (response) => {
        this.recoveryLoading.set(false);
        this.recoveryToken.set(response.tokenRecuperacion);
        this.recoverySuccess.set(response.mensaje);
        this.recoveryStep.set('cambiar');
      },
      error: (error) => {
        this.recoveryLoading.set(false);
        this.recoveryError.set(error?.error?.mensaje ?? 'El codigo no pudo verificarse.');
      }
    });
  }

  private actualizarContrasenaRecuperacion(): void {
    const { nuevaPassword, confirmarPassword } = this.recoveryForm.getRawValue();
    if (!nuevaPassword || !confirmarPassword) {
      this.recoveryForm.controls.nuevaPassword.markAsTouched();
      this.recoveryForm.controls.confirmarPassword.markAsTouched();
      if (!nuevaPassword && !confirmarPassword) {
        this.mostrarAlerta('warning', 'Faltan las contrasenas', 'Ingresa y confirma tu nueva contrasena para actualizar tu acceso.');
      } else if (!nuevaPassword) {
        this.mostrarAlerta('warning', 'Falta la nueva contrasena', 'Ingresa tu nueva contrasena para continuar.');
      } else {
        this.mostrarAlerta('warning', 'Falta la confirmacion', 'Confirma tu nueva contrasena para completar el cambio.');
      }
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      this.mostrarAlerta('warning', 'Las contrasenas no coinciden', 'Asegurate de escribir la misma contrasena en ambos campos.');
      return;
    }

    this.recoveryLoading.set(true);
    this.recoveryError.set('');
    this.recoverySuccess.set('');

    this.authService
      .cambiarPasswordRecuperacion({
        tokenRecuperacion: this.recoveryToken(),
        nuevaPassword,
        confirmarPassword
      })
      .subscribe({
        next: (response) => {
          this.recoveryLoading.set(false);
          this.recoverySuccess.set(response.mensaje);
          this.reiniciarRecuperacion(false);
          this.animarCambioPanel('login');
        },
        error: (error) => {
          this.recoveryLoading.set(false);
          this.recoveryError.set(
            error?.error?.mensaje ?? 'No se pudo actualizar la contrasena.'
          );
        }
      });
  }

  private reiniciarRecuperacion(limpiarMensajes: boolean = true): void {
    this.recoveryForm.reset({
      identificador: '',
      correo: '',
      codigo: '',
      nuevaPassword: '',
      confirmarPassword: ''
    });
    this.recoveryStep.set('solicitar');
    this.recoveryToken.set('');
    this.recoveryLoading.set(false);
    this.mostrarRecoveryPassword.set(false);
    this.mostrarRecoveryConfirmPassword.set(false);
    if (limpiarMensajes) {
      this.recoveryError.set('');
      this.recoverySuccess.set('');
    }
  }

  private mostrarAlerta(
    type: CustomAlertType,
    title: string,
    message: string,
    autoCloseMs: number | null = 3200
  ): void {
    this.alertState.set({
      open: true,
      type,
      title,
      message,
      confirmText: 'Entendido',
      cancelText: null,
      autoCloseMs
    });
  }
}
