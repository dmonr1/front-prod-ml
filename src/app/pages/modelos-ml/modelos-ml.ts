import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Shell } from '../../layouts/shell/shell';
import {
  AlgoritmoComparativa,
  ComparativaModelos,
  ConfiguracionPredictores,
  MlAdminService,
  PlanificadorReentrenamiento,
  PredictorFeature
} from '../../services/ml/ml-admin.service';

type TabMl = 'predictores' | 'comparador' | 'planificador';

@Component({
  selector: 'app-modelos-ml',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, Shell],
  templateUrl: './modelos-ml.html',
  styleUrl: './modelos-ml.scss'
})
export class ModelosMl implements OnInit {
  private readonly mlAdminService = inject(MlAdminService);

  readonly tabActiva = signal<TabMl>('predictores');
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly reentrenando = signal(false);
  readonly mensajeExito = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // Datos
  readonly configuracion = signal<ConfiguracionPredictores | null>(null);
  readonly comparativa = signal<ComparativaModelos | null>(null);
  readonly planificador = signal<PlanificadorReentrenamiento | null>(null);

  // Filtros internos en pestaña de predictores
  tipoPredictorFiltro = 'TODOS'; // TODOS, GLOBAL, CURSO
  categoriaFiltro = 'TODAS'; // TODAS, ACADEMICO, ASISTENCIA, EVALUATIVO

  ngOnInit(): void {
    this.cargarDatos();
  }

  cambiarTab(tab: TabMl): void {
    this.tabActiva.set(tab);
    this.mensajeExito.set(null);
    this.error.set(null);
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.mlAdminService.obtenerConfiguracionPredictores().subscribe({
      next: (cfg) => {
        this.configuracion.set(cfg);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la configuración de predictores.');
        this.cargando.set(false);
      }
    });

    this.mlAdminService.obtenerComparativaModelos().subscribe({
      next: (comp) => this.comparativa.set(comp),
      error: () => undefined
    });

    this.mlAdminService.obtenerPlanificadorReentrenamiento().subscribe({
      next: (plan) => this.planificador.set(plan),
      error: () => undefined
    });
  }

  guardarConfiguracionPredictores(): void {
    const config = this.configuracion();
    if (!config) return;

    this.guardando.set(true);
    this.mensajeExito.set(null);
    this.error.set(null);

    this.mlAdminService.actualizarConfiguracionPredictores(config).subscribe({
      next: (res) => {
        this.configuracion.set(res);
        this.guardando.set(false);
        this.mensajeExito.set('Configuración de variables predictoras actualizada con éxito en el servicio de ML.');
        setTimeout(() => this.mensajeExito.set(null), 4000);
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No se pudo guardar la configuración de predictores.');
      }
    });
  }

  restablecerPredictores(): void {
    const config = this.configuracion();
    if (!config) return;

    config.globalFeatures.forEach((f) => (f.activo = true));
    config.courseFeatures.forEach((f) => (f.activo = true));
    this.guardarConfiguracionPredictores();
  }

  ejecutarReentrenamientoManual(): void {
    this.reentrenando.set(true);
    this.mensajeExito.set(null);
    this.error.set(null);

    this.mlAdminService.ejecutarReentrenamiento().subscribe({
      next: (res) => {
        this.planificador.set(res);
        this.reentrenando.set(false);
        this.mensajeExito.set('Reentrenamiento multialgoritmo completado. Se actualizaron los pesos y métricas del modelo activo.');
        this.mlAdminService.obtenerComparativaModelos().subscribe({
          next: (comp) => this.comparativa.set(comp),
          error: () => undefined
        });
      },
      error: () => {
        this.reentrenando.set(false);
        this.error.set('Ocurrió un error al ejecutar el reentrenamiento del pipeline.');
      }
    });
  }

  predictoresFiltrados(): PredictorFeature[] {
    const config = this.configuracion();
    if (!config) return [];

    let lista: PredictorFeature[] = [];
    if (this.tipoPredictorFiltro === 'TODOS') {
      lista = [...config.globalFeatures, ...config.courseFeatures];
    } else if (this.tipoPredictorFiltro === 'GLOBAL') {
      lista = config.globalFeatures;
    } else {
      lista = config.courseFeatures;
    }

    if (this.categoriaFiltro !== 'TODAS') {
      lista = lista.filter((f) => f.categoria === this.categoriaFiltro);
    }

    return lista;
  }

  conteoActivos(tipo: 'GLOBAL' | 'CURSO'): number {
    const config = this.configuracion();
    if (!config) return 0;
    const lista = tipo === 'GLOBAL' ? config.globalFeatures : config.courseFeatures;
    return lista.filter((f) => f.activo).length;
  }

  conteoTotal(tipo: 'GLOBAL' | 'CURSO'): number {
    const config = this.configuracion();
    if (!config) return 0;
    return tipo === 'GLOBAL' ? config.globalFeatures.length : config.courseFeatures.length;
  }

  obtenerClaseCategoria(cat: string): string {
    switch (cat) {
      case 'ACADEMICO':
        return 'cat-academic';
      case 'ASISTENCIA':
        return 'cat-attendance';
      case 'EVALUATIVO':
        return 'cat-eval';
      default:
        return '';
    }
  }

  obtenerIconoCategoria(cat: string): string {
    switch (cat) {
      case 'ACADEMICO':
        return 'fa-solid fa-graduation-cap';
      case 'ASISTENCIA':
        return 'fa-solid fa-user-clock';
      case 'EVALUATIVO':
        return 'fa-solid fa-clipboard-list';
      default:
        return 'fa-solid fa-circle';
    }
  }
}
