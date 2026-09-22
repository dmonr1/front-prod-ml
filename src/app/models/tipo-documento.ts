export interface TipoDocumento {
  id: number;
  codigo: string;
  descripcionLarga: string;
  descripcionCorta: string;
  longitud: number;
  tipo: 'NUMERICO' | 'ALFANUMERICO';
  alcanceNacionalidad: 'NACIONAL' | 'EXTRANJERO' | 'AMBOS';
  longitudExacta: boolean;
}
