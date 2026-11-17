// Nombre de la variable de entorno con la que el comando le dice al reporter dónde guardar
export const VARIABLE_SALIDA = 'FLAKY_DETECTOR_SALIDA';

export interface ResultadoTest {
  id: string;
  clave: string;
  titulo: string;
  archivo: string;
  proyecto: string;
  status: string;
  duracionMs: number;
  repeticion: number;
  worker: number;
  etiquetas: string[];
}

export interface Corrida {
  timestamp: string;
  resultados: ResultadoTest[];
}

export type Clasificacion = 'flaky' | 'estable' | 'fallo-determinista' | 'excluido';

export interface EstadisticaTest {
  clave: string;
  titulo: string;
  archivo: string;
  proyecto: string;
  totalCorridas: number;   // ejecuciones reales (sin contar las omitidas con skip)
  passed: number;
  failed: number;          // todo lo que no pasó: fallo de aserción, timeout o interrupción
  otros: number;           // de los fallos, cuántos fueron timeout o interrupción
  tasaInestabilidad: number;
  clasificacion: Clasificacion;
  altaInestabilidad: boolean; // flaky con tasa >= umbral (PruebaInestable)
}

export interface ConfigExclusion {
  excluir: {
    titulos: string[];
    archivos: string[];
  };
}

export interface Reporte {
  generado: string;
  repeticiones: number;
  umbral: number;
  resumen: {
    flaky: number;
    falloDeterminista: number;
    estables: number;
    excluidos: number;
    altaInestabilidad: number;
    omitidos: number;      // tests que nunca se ejecutaron (skip); no se analizan
  };
  tests: EstadisticaTest[];
}
