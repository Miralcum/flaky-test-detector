import * as fs from 'fs';
import * as path from 'path';

interface ResultadoTest {
  id: string;
  clave?: string;
  titulo: string;
  status: string;
  repeticion?: number;
  etiquetas?: string[];
}

interface CorridaJSON {
  resultados: ResultadoTest[];
}

type Clase = 'flaky' | 'estable' | 'fallo-determinista';
type Desenlace = 'oculto' | 'detectado' | 'parece-bug';

interface TestEvaluado {
  titulo: string;
  real: Clase;
  estados: string[];
}

interface FilaEvaluacion {
  n: number;
  recall: number;
  exactitud: number;
}

const reintentos = Number(process.argv[2]) || 2;
const maxIntentos = reintentos + 1;
const carpetaRuns = 'runs';

// ---------- Funciones auxiliares ----------

function claseReal(etiquetas: string[] = []): Clase | null {
  if (etiquetas.includes('@flaky')) return 'flaky';
  if (etiquetas.includes('@estable')) return 'estable';
  if (etiquetas.includes('@determinista')) return 'fallo-determinista';
  return null;
}

// Cómo interpreta cada desenlace un equipo que solo mira los reintentos
function claseSegunRetries(d: Desenlace): Clase {
  if (d === 'oculto') return 'estable';
  if (d === 'detectado') return 'flaky';
  return 'fallo-determinista';
}

// Recorre los resultados en orden, simulando pipelines de CI con reintentos
function simularPipelines(estados: string[]): { desenlaces: Desenlace[]; intentosUsados: number } {
  const desenlaces: Desenlace[] = [];
  let i = 0;
  let intentosUsados = 0;

  // Solo simulamos pipelines completos: debe quedar espacio para todos los intentos posibles
  while (i + maxIntentos <= estados.length) {
    let desenlace: Desenlace = 'parece-bug';

    for (let intento = 1; intento <= maxIntentos; intento++) {
      const estado = estados[i];
      i++;
      intentosUsados++;
      if (estado === 'passed') {
        desenlace = intento === 1 ? 'oculto' : 'detectado';
        break;
      }
    }
    desenlaces.push(desenlace);
  }

  return { desenlaces, intentosUsados };
}

function fraccion(lista: Desenlace[], tipo: Desenlace): number {
  return lista.filter((d) => d === tipo).length / lista.length;
}

function porcentaje(valor: number): string {
  return `${(valor * 100).toFixed(1)}%`.padStart(7);
}

// ---------- Cargar resultados ----------

const archivos = fs.readdirSync(carpetaRuns).filter((f) => f.endsWith('.json'));
const porTest = new Map<string, TestEvaluado & { resultados: ResultadoTest[] }>();

for (const nombreArchivo of archivos) {
  const corrida: CorridaJSON = JSON.parse(fs.readFileSync(path.join(carpetaRuns, nombreArchivo), 'utf-8'));
  for (const r of corrida.resultados) {
    const real = claseReal(r.etiquetas);
    if (real === null) continue;
    const clave = r.clave ?? r.id;
    if (!porTest.has(clave)) {
      porTest.set(clave, { titulo: r.titulo, real, estados: [], resultados: [] });
    }
    porTest.get(clave)!.resultados.push(r);
  }
}

if (porTest.size === 0) {
  console.error('No hay tests etiquetados en runs/. Corre primero: npm run run-paralelo -- 100 16 e2e');
  process.exit(1);
}

for (const t of porTest.values()) {
  t.resultados.sort((a, b) => (a.repeticion ?? 0) - (b.repeticion ?? 0));
  t.estados = t.resultados.map((r) => r.status);
}

// ---------- Simular y medir ----------

let verdaderosPositivos = 0;
let falsosPositivos = 0;
let sumaRecall = 0;
let cantidadFlaky = 0;
let sumaExactitud = 0;
let totalIntentos = 0;
let totalPipelines = 0;

const detalleFlaky: { titulo: string; tasaFallo: number; oculto: number; detectado: number; pareceBug: number }[] = [];

for (const t of porTest.values()) {
  const { desenlaces, intentosUsados } = simularPipelines(t.estados);
  totalIntentos += intentosUsados;
  totalPipelines += desenlaces.length;

  const detectados = desenlaces.filter((d) => d === 'detectado').length;
  if (t.real === 'flaky') {
    verdaderosPositivos += detectados;
  } else {
    falsosPositivos += detectados;
  }

  const correctos = desenlaces.filter((d) => claseSegunRetries(d) === t.real).length;
  sumaExactitud += correctos / desenlaces.length;

  if (t.real === 'flaky') {
    cantidadFlaky++;
    sumaRecall += fraccion(desenlaces, 'detectado');
    detalleFlaky.push({
      titulo: t.titulo,
      tasaFallo: t.estados.filter((s) => s !== 'passed').length / t.estados.length,
      oculto: fraccion(desenlaces, 'oculto'),
      detectado: fraccion(desenlaces, 'detectado'),
      pareceBug: fraccion(desenlaces, 'parece-bug'),
    });
  }
}

const precisionRetries =
  verdaderosPositivos + falsosPositivos === 0 ? 1 : verdaderosPositivos / (verdaderosPositivos + falsosPositivos);
const recallRetries = cantidadFlaky === 0 ? 1 : sumaRecall / cantidadFlaky;
const exactitudRetries = sumaExactitud / porTest.size;
const costoRetries = totalIntentos / totalPipelines;

// ---------- Detalle por test flaky ----------

console.log(`Simulación de pipelines de CI con retries=${reintentos} (hasta ${maxIntentos} intentos por test)\n`);
console.log('Qué ve un equipo que solo usa reintentos, para cada test realmente flaky:\n');
console.log(' fallo real |  oculto | detectado | parece bug | test');
console.log('------------+---------+-----------+------------+-----------------------------');

detalleFlaky.sort((a, b) => b.tasaFallo - a.tasaFallo);
for (const d of detalleFlaky) {
  console.log(
    `    ${porcentaje(d.tasaFallo)} | ${porcentaje(d.oculto)} |   ${porcentaje(d.detectado)} |    ${porcentaje(d.pareceBug)} | ${d.titulo}`
  );
}

// ---------- Comparación contra el detector ----------

console.log('\nComparación con los mismos datos:\n');
console.log(' método                         | ejecuciones por test | precisión | exhaustividad | exactitud');
console.log('--------------------------------+----------------------+-----------+---------------+----------');
console.log(
  ` retries=${reintentos} (1 pipeline de CI)       | ${costoRetries.toFixed(2).padStart(20)} | ${porcentaje(precisionRetries)}   | ${porcentaje(recallRetries)}       | ${porcentaje(exactitudRetries)}`
);

if (fs.existsSync('evaluacion.json')) {
  const filas: FilaEvaluacion[] = JSON.parse(fs.readFileSync('evaluacion.json', 'utf-8'));
  for (const f of filas) {
    const nombre = ` detector N=${f.n}`.padEnd(31);
    console.log(
      `${nombre}| ${String(f.n).padStart(20)} |  100.0%   | ${porcentaje(f.recall)}       | ${porcentaje(f.exactitud)}`
    );
  }
} else {
  console.log(' (corre "npm run evaluar" para agregar las filas del detector)');
}

const salida = {
  reintentos,
  costoPromedio: costoRetries,
  precision: precisionRetries,
  recall: recallRetries,
  exactitud: exactitudRetries,
  detalleFlaky,
};
fs.writeFileSync(`comparacion-retries-${reintentos}.json`, JSON.stringify(salida, null, 2), 'utf-8');
console.log(`\nResultados guardados en comparacion-retries-${reintentos}.json`);
