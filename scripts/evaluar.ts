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

interface TestEvaluado {
  titulo: string;
  real: Clase;
  resultados: ResultadoTest[];
}

interface FilaEvaluacion {
  n: number;
  ventanas: number;
  precision: number;
  recall: number;
  exactitud: number;
}

const carpetaRuns = 'runs';
const tamanosN = [3, 5, 10, 20, 30, 50, 100, 200];

function claseReal(etiquetas: string[] = []): Clase | null {
  if (etiquetas.includes('@flaky')) return 'flaky';
  if (etiquetas.includes('@estable')) return 'estable';
  if (etiquetas.includes('@determinista')) return 'fallo-determinista';
  return null;
}

function clasificar(estados: string[]): Clase {
  const total = estados.length;
  const passed = estados.filter((s) => s === 'passed').length;
  const failed = estados.filter((s) => s === 'failed').length;
  const otros = total - passed - failed;
  const mayoritario = Math.max(passed, failed, otros);

  if (mayoritario < total) return 'flaky';
  if (passed === total) return 'estable';
  return 'fallo-determinista';
}

function porcentaje(valor: number): string {
  return `${(valor * 100).toFixed(1)}%`.padStart(7);
}

if (!fs.existsSync(carpetaRuns)) {
  console.error(`No existe la carpeta '${carpetaRuns}/'. Corre primero: npm run run-paralelo -- <N> 16 e2e`);
  process.exit(1);
}

const archivos = fs.readdirSync(carpetaRuns).filter((f) => f.endsWith('.json'));
const porTest = new Map<string, TestEvaluado>();

for (const nombreArchivo of archivos) {
  const corrida: CorridaJSON = JSON.parse(
    fs.readFileSync(path.join(carpetaRuns, nombreArchivo), 'utf-8')
  );

  for (const r of corrida.resultados) {
    const real = claseReal(r.etiquetas);
    if (real === null) continue;

    const clave = r.clave ?? r.id;
    if (!porTest.has(clave)) {
      porTest.set(clave, { titulo: r.titulo, real, resultados: [] });
    }
    porTest.get(clave)!.resultados.push(r);
  }
}

if (porTest.size === 0) {
  console.error('No hay tests con etiquetas (@flaky, @estable, @determinista) en los resultados.');
  console.error('Vuelve a correr: npm run run-paralelo -- <N> 16 e2e');
  process.exit(1);
}

for (const t of porTest.values()) {
  t.resultados.sort((a, b) => (a.repeticion ?? 0) - (b.repeticion ?? 0));
}

const nDisponible = Math.min(...[...porTest.values()].map((t) => t.resultados.length));
console.log(`Evaluando ${porTest.size} tests etiquetados con ${nDisponible} repeticiones cada uno.\n`);

const filas: FilaEvaluacion[] = [];

for (const n of tamanosN.filter((x) => x <= nDisponible)) {
  const ventanas = Math.floor(nDisponible / n);
  let sumaPrecision = 0;
  let sumaRecall = 0;
  let sumaExactitud = 0;

  for (let v = 0; v < ventanas; v++) {
    let verdaderosPositivos = 0;
    let falsosPositivos = 0;
    let falsosNegativos = 0;
    let aciertos = 0;

    for (const t of porTest.values()) {
      const muestra = t.resultados.slice(v * n, (v + 1) * n).map((r) => r.status);
      const predicha = clasificar(muestra);

      if (predicha === t.real) aciertos++;
      if (predicha === 'flaky' && t.real === 'flaky') verdaderosPositivos++;
      if (predicha === 'flaky' && t.real !== 'flaky') falsosPositivos++;
      if (predicha !== 'flaky' && t.real === 'flaky') falsosNegativos++;
    }

    const marcadosFlaky = verdaderosPositivos + falsosPositivos;
    const flakyReales = verdaderosPositivos + falsosNegativos;

    sumaPrecision += marcadosFlaky === 0 ? 1 : verdaderosPositivos / marcadosFlaky;
    sumaRecall += flakyReales === 0 ? 1 : verdaderosPositivos / flakyReales;
    sumaExactitud += aciertos / porTest.size;
  }

  filas.push({
    n,
    ventanas,
    precision: sumaPrecision / ventanas,
    recall: sumaRecall / ventanas,
    exactitud: sumaExactitud / ventanas,
  });
}

console.log('   N  | ventanas | precisión | exhaustividad | exactitud');
console.log('------+----------+-----------+---------------+----------');
for (const f of filas) {
  console.log(
    `${String(f.n).padStart(5)} | ${String(f.ventanas).padStart(8)} | ${porcentaje(f.precision)}   | ${porcentaje(f.recall)}       | ${porcentaje(f.exactitud)}`
  );
}

console.log(`\nTests mal clasificados usando las ${nDisponible} repeticiones:`);
let errores = 0;
for (const t of porTest.values()) {
  const estados = t.resultados.slice(0, nDisponible).map((r) => r.status);
  const predicha = clasificar(estados);
  if (predicha !== t.real) {
    errores++;
    const tasaFallo = estados.filter((s) => s !== 'passed').length / estados.length;
    console.log(
      `  - ${t.titulo}: etiqueta '${t.real}', detector dijo '${predicha}' (falló ${(tasaFallo * 100).toFixed(1)}% de las veces)`
    );
  }
}
if (errores === 0) console.log('  (ninguno)');

fs.writeFileSync('evaluacion.json', JSON.stringify(filas, null, 2), 'utf-8');

const csv = [
  'N,ventanas,precision,recall,exactitud',
  ...filas.map((f) =>
    [f.n, f.ventanas, f.precision.toFixed(4), f.recall.toFixed(4), f.exactitud.toFixed(4)].join(',')
  ),
].join('\n');
fs.writeFileSync('evaluacion.csv', csv, 'utf-8');

console.log('\nResultados guardados en evaluacion.json y evaluacion.csv');
