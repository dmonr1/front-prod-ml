import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { BrandMark } from '../../../components/brand-mark/brand-mark';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, BrandMark],
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

  @ViewChild('visualPanel', { static: true }) visualPanel?: ElementRef<HTMLElement>;
  @ViewChild('authCard', { static: true }) authCard?: ElementRef<HTMLElement>;

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly previewMode = signal<'global' | 'curso'>('global');

  readonly form = this.fb.nonNullable.group({
    identificador: ['', Validators.required],
    password: ['', Validators.required]
  });

  readonly previewData = computed(() =>
    this.previewMode() === 'global'
      ? {
          headerTitle: 'Seguimiento global por alumno',
          switchLabel: 'Riesgo global',
          chips: ['PERIODO I', '1RO PRIMARIA A'],
          kpis: [
            { label: 'Alumnos evaluados', value: '6' },
            { label: 'Casos prioritarios', value: '3' },
            { label: 'Riesgo promedio', value: '45.9%' },
            { label: 'Riesgo alto', value: '3' }
          ],
          chart: {
            title: 'Alumnos por nivel de riesgo',
            total: '6',
            legend: [
              { label: 'Riesgo alto', value: '50%', tone: 'high' },
              { label: 'Riesgo medio', value: '0%', tone: 'medium' },
              { label: 'Riesgo bajo', value: '50%', tone: 'low' }
            ]
          },
          rows: [
            { name: 'Maria Flores', risk: 'BAJO', tone: 'low', failure: '3%' },
            { name: 'Diego Mendoza', risk: 'ALTO', tone: 'high', failure: '77%' },
            { name: 'Jose Soto', risk: 'MEDIO', tone: 'medium', failure: '39%' }
          ],
          sideTitle: 'Riesgo global',
          sideMetrics: [
            { label: 'Riesgo promedio', value: '45.9%' },
            { label: 'Asistencia promedio', value: '88.8%' },
            { label: 'Casos prioritarios', value: '3' },
            { label: 'Riesgo alto', value: '3' }
          ]
        }
      : {
          headerTitle: 'Seguimiento focalizado por curso',
          switchLabel: 'Riesgo por curso',
          chips: ['PERIODO I', 'COMUNICACION'],
          kpis: [
            { label: 'Cursos visibles', value: '4' },
            { label: 'Casos en alerta', value: '2' },
            { label: 'Fracaso promedio', value: '31.4%' },
            { label: 'Riesgo alto', value: '1' }
          ],
          chart: {
            title: 'Cursos por nivel de riesgo',
            total: '4',
            legend: [
              { label: 'Riesgo alto', value: '25%', tone: 'high' },
              { label: 'Riesgo medio', value: '25%', tone: 'medium' },
              { label: 'Riesgo bajo', value: '50%', tone: 'low' }
            ]
          },
          rows: [
            { name: 'Maria Flores', risk: 'BAJO', tone: 'low', failure: '8%' },
            { name: 'Diego Mendoza', risk: 'ALTO', tone: 'high', failure: '94%' },
            { name: 'Jose Soto', risk: 'MEDIO', tone: 'medium', failure: '28%' }
          ],
          sideTitle: 'Riesgo por curso',
          sideMetrics: [
            { label: 'Promedio del curso', value: '13.8' },
            { label: 'Asistencia del curso', value: '91.2%' },
            { label: 'Notas criticas', value: '2' },
            { label: 'Mayor riesgo', value: '94%' }
          ]
        }
  );

  ngAfterViewInit(): void {
    this.animationContext = gsap.context(() => {
      gsap.set('.login-copy > *', { y: 24, opacity: 0 });
      gsap.set('.auth-card-shell', { y: 28, opacity: 0, scale: 0.98 });
      gsap.set('.auth-card-shell form > *', { y: 16, opacity: 0 });
      gsap.set('.auth-floating', { scale: 0.92, opacity: 0 });

      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      timeline
        .to('.auth-floating', {
          opacity: 1,
          scale: 1,
          duration: 0.62,
          stagger: 0.08
        })
        .to(
          '.login-copy > *',
          {
            opacity: 1,
            y: 0,
            duration: 0.62,
            stagger: 0.08
          },
          '-=0.4'
        )
        .to(
          '.auth-card-shell',
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.68
          },
          '-=0.42'
        )
        .to(
          '.auth-card-shell form > *',
          {
            opacity: 1,
            y: 0,
            duration: 0.46,
            stagger: 0.06
          },
          '-=0.34'
        );
    }, this.host.nativeElement);

    this.previewIntervalId = setInterval(() => {
      this.previewMode.update((mode) => (mode === 'global' ? 'curso' : 'global'));
      this.animarCambioPreview();
    }, 7000);
  }

  ngOnDestroy(): void {
    if (this.previewIntervalId) {
      clearInterval(this.previewIntervalId);
    }
    this.animationContext?.revert();
  }

  tonoPreview(tono: 'low' | 'medium' | 'high'): string {
    return tono;
  }

  iniciarSesion(): void {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
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
      '.dashboard-preview [data-preview-anim]',
      { opacity: 0.5, y: 10, scale: 0.985 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.42,
        ease: 'power2.out',
        stagger: 0.04,
        clearProps: 'transform'
      }
    );
  }
}
