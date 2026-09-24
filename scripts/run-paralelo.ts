import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const N = Number(process.argv[2]) || 10;
const workers = Number(process.argv[3]) || 4;
const proyecto = process.argv[4]; // opcional: 'sinteticos' o 'e2e'
const carpetaRuns = 'runs';

if (fs.existsSync(carpetaRuns)) {
  fs.rmSync(carpetaRuns, { recursive: true, force: true });
}
fs.mkdirSync(carpetaRuns);

if (fs.existsSync('run-result.json')) {
  fs.rmSync('run-result.json');
}

const filtroProyecto = proyecto ? ` --project=${proyecto}` : '';
const descripcion = proyecto ? `del proyecto '${proyecto}'` : 'de todos los proyectos';

console.log(`Ejecutando cada test ${descripcion} ${N} veces con ${workers} workers en paralelo...`);

const inicio = performance.now();

try {
  execSync(`npx playwright test --repeat-each=${N} --workers=${workers}${filtroProyecto}`, { stdio: 'ignore' });
} catch {
  // Playwright sale con error si algún test falla. Es esperado.
}

const segundos = ((performance.now() - inicio) / 1000).toFixed(1);

if (!fs.existsSync('run-result.json')) {
  console.error('Error: Playwright no generó run-result.json. Corre "npx playwright test" a mano para ver qué pasó.');
  process.exit(1);
}

fs.copyFileSync('run-result.json', path.join(carpetaRuns, 'run-paralelo.json'));

console.log(`Listo en ${segundos} segundos. Resultados en '${carpetaRuns}/run-paralelo.json'.`);
