export interface ConfiguracionEvaluacionCursoResumen {
  cursoId: number;
  nombreCurso: string;
  descripcionCurso: string | null;
  nivelNombre: string;
  usaConfiguracionPersonalizada: boolean;
  totalTiposConfigurados: number;
}

export interface ConfiguracionEvaluacionCursoItem {
  tipoEvaluacionId: number;
  nombreTipoEvaluacion: string;
  descripcionTipoEvaluacion: string | null;
  cantidadBasePeriodo: number;
  cantidadEvaluaciones: number;
  calcularEnPromedio: boolean;
}

export interface ConfiguracionEvaluacionCursoDetalle {
  periodoAcademicoId: number;
  cursoId: number;
  nombreCurso: string;
  descripcionCurso: string | null;
  nivelNombre: string;
  usaConfiguracionPersonalizada: boolean;
  configuraciones: ConfiguracionEvaluacionCursoItem[];
}

export interface ConfiguracionEvaluacionCursoGuardarPayload {
  periodoAcademicoId: number;
  cursoId: number;
  configuraciones: {
    tipoEvaluacionId: number;
    cantidadEvaluaciones: number;
    calcularEnPromedio: boolean;
  }[];
}
