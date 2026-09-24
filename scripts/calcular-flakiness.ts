import * as fs from 'fs';
import * as path from 'path';

interface ResultadoTest {
  id: string;
  clave?: string;
  titulo: string;
  archivo: string;
  status: string;
  duracionMs: number;
}

interface CorridaJSON {
  timestamp: string;
  resultados: ResultadoTest[];
}

type Clasificacion = 'flaky' | 'estable' | 'fallo-determinista' | 'excluido';

interface EstadisticaTest {
  id: string;
  titulo: string;
  archivo: string;
  totalCorridas: number;
  passed: number;
  failed: number;
  otros: number;
  tasaInestabilidad: number;
  clasificacion: Clasificacion;
}

interface ConfigFlaky {
  excluir: {
    titulos: string[];
    archivos: string[];
  };
}

const carpetaRuns = 'runs';
const rutaConfig = 'flaky.config.json';


function cargarConfig(ruta: string): ConfigFlaky {
  const porDefecto: ConfigFlaky = { excluir: { titulos: [], archivos: [] } };

  if (!fs.existsSync(ruta)) {
    console.log(`(No se encontró ${ruta}, se analizan todos los tests sin exclusiones)`);
    return porDefecto;
  }

  try {
    const leido = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    return {
      excluir: {
        titulos: leido.excluir?.titulos ?? [],
        archivos: leido.excluir?.archivos ?? [],
      },
    };
  } catch (error) {
    console.error(`Error: ${ruta} no es un JSON válido. Revisa comas y comillas.`);
    process.exit(1);
  }
}

function estaExcluido(titulo: string, archivo: string, config: ConfigFlaky): boolean {
  const porTitulo = config.excluir.titulos.some((t) => titulo === t);
  const porArchivo = config.excluir.archivos.some((a) => archivo.endsWith(a));
  return porTitulo || porArchivo;
}

function clasificar(
  passed: number,
  totalCorridas: number,
  tasa: number,
  excluido: boolean
): Clasificacion {
  if (excluido) return 'excluido';
  if (tasa > 0) return 'flaky';
  if (passed === totalCorridas) return 'estable';
  return 'fallo-determinista';
}

function imprimirSeccion(titulo: string, lista: EstadisticaTest[], mostrarPorcentaje: boolean): void {
  console.log(`\n=== ${titulo} (${lista.length}) ===`);
  if (lista.length === 0) {
    console.log('  (ninguno)');
    return;
  }
  for (const est of lista) {
    const prefijo = mostrarPorcentaje
      ? `${(est.tasaInestabilidad * 100).toFixed(1).padStart(5)}%  |`
      : '        |';
    console.log(
      `${prefijo}  ${est.titulo}  (${est.passed} passed / ${est.failed} failed de ${est.totalCorridas})`
    );
  }
}


const config = cargarConfig(rutaConfig);

const archivos = fs.readdirSync(carpetaRuns).filter((f) => f.endsWith('.json'));

if (archivos.length === 0) {
  console.error(`No se encontraron archivos JSON en '${carpetaRuns}/'. Corre primero: npm run run-n -- <N>`);
  process.exit(1);
}

console.log(`Leyendo ${archivos.length} archivo(s) de resultados...`);

const resultadosPorTest = new Map<string, ResultadoTest[]>();

for (const nombreArchivo of archivos) {
  const contenido = fs.readFileSync(path.join(carpetaRuns, nombreArchivo), 'utf-8');
  const corrida: CorridaJSON = JSON.parse(contenido);

  for (const resultado of corrida.resultados) {
    const clave = resultado.clave ?? resultado.id;
    if (!resultadosPorTest.has(clave)) {
      resultadosPorTest.set(clave, []);
    }
    resultadosPorTest.get(clave)!.push(resultado);
  }
}

const estadisticas: EstadisticaTest[] = [];

for (const [id, resultados] of resultadosPorTest) {
  const totalCorridas = resultados.length;
  const passed = resultados.filter((r) => r.status === 'passed').length;
  const failed = resultados.filter((r) => r.status === 'failed').length;
  const otros = totalCorridas - passed - failed;

  const conteoMayoritario = Math.max(passed, failed, otros);
  const tasaInestabilidad = (totalCorridas - conteoMayoritario) / totalCorridas;

  const titulo = resultados[0].titulo;
  const archivo = resultados[0].archivo;
  const excluido = estaExcluido(titulo, archivo, config);

  estadisticas.push({
    id,
    titulo,
    archivo,
    totalCorridas,
    passed,
    failed,
    otros,
    tasaInestabilidad,
    clasificacion: clasificar(passed, totalCorridas, tasaInestabilidad, excluido),
  });
}

const flaky = estadisticas
  .filter((e) => e.clasificacion === 'flaky')
  .sort((a, b) => b.tasaInestabilidad - a.tasaInestabilidad);
const deterministas = estadisticas.filter((e) => e.clasificacion === 'fallo-determinista');
const estables = estadisticas.filter((e) => e.clasificacion === 'estable');
const excluidos = estadisticas.filter((e) => e.clasificacion === 'excluido');

imprimirSeccion('TESTS INESTABLES (FLAKY), ranking', flaky, true);
imprimirSeccion('FALLOS DETERMINISTAS (bug real, no flaky)', deterministas, false);
imprimirSeccion('ESTABLES', estables, false);
imprimirSeccion('EXCLUIDOS POR CONFIGURACIÓN', excluidos, false);

const reporte = {
  generado: new Date().toISOString(),
  corridasAnalizadas: archivos.length,
  resumen: {
    flaky: flaky.length,
    falloDeterminista: deterministas.length,
    estables: estables.length,
    excluidos: excluidos.length,
  },
  tests: [...flaky, ...deterministas, ...estables, ...excluidos],
};

fs.writeFileSync('reporte.json', JSON.stringify(reporte, null, 2), 'utf-8');
console.log(`\nReporte completo guardado en reporte.json`);
