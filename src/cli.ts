#!/usr/bin/env node
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';
import { analizar, cargarConfigExclusion, imprimirResumen, pareceFallaDeEntorno } from './analisis';
import { generarHtml } from './html';
import { VARIABLE_SALIDA, type Corrida } from './tipos';

const AYUDA = `
flaky-detector: detecta tests inestables (flaky) en suites de Playwright

Uso:
  flaky-detector [opciones]

Opciones:
  -n, --n <número>         Repeticiones por test (mínimo 5, por defecto 20)
  -w, --workers <número>   Workers en paralelo (por defecto, lo que decida Playwright)
  -p, --project <nombre>   Analizar solo un proyecto de Playwright
      --excluir <archivo>  Archivo de exclusiones (por defecto flaky.config.json)
  -o, --salida <carpeta>   Carpeta de resultados (por defecto flaky-report)
      --estricto           Terminar con error si se encuentra al menos un test flaky
      --umbral <número>    Tasa mínima para marcar alta inestabilidad (por defecto 0.3)
  -h, --help               Mostrar esta ayuda

Ejemplo:
  flaky-detector --n 20 --workers 8 --project chromium
`;

function main(): void {
  const { values } = parseArgs({
    options: {
      n: { type: 'string', short: 'n', default: '20' },
      workers: { type: 'string', short: 'w' },
      project: { type: 'string', short: 'p' },
      excluir: { type: 'string', default: 'flaky.config.json' },
      salida: { type: 'string', short: 'o', default: 'flaky-report' },
      estricto: { type: 'boolean', default: false },
      umbral: { type: 'string', default: '0.3' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(AYUDA);
    return;
  }

  const n = Number(values.n);
  if (!Number.isInteger(n) || n < 5) {
    console.error('Error: --n debe ser un número entero de al menos 5.');
    process.exit(1);
  }

  const carpetaSalida = path.resolve(values.salida);
  fs.mkdirSync(carpetaSalida, { recursive: true });
  const rutaCrudos = path.join(carpetaSalida, 'resultados-crudos.json');
  if (fs.existsSync(rutaCrudos)) {
    fs.rmSync(rutaCrudos);
  }

  // Nuestro reporter compilado vive junto a este archivo, en dist/
  const rutaReporter = path.join(__dirname, 'reporter.js');

  const argumentos = [
    'playwright',
    'test',
    `--repeat-each=${n}`,
    '--retries=0',                  // resultados crudos: sin reintentos
    `--reporter=${rutaReporter}`,   // reemplaza los reporters del proyecto, sin modificar su configuración
  ];
  if (values.workers) argumentos.push(`--workers=${values.workers}`);
  if (values.project) argumentos.push(`--project=${values.project}`);

  console.log(`[flaky-detector] Repitiendo cada test ${n} veces...`);
  const inicio = performance.now();

  const proceso = spawnSync('npx', argumentos, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, [VARIABLE_SALIDA]: rutaCrudos },
  });

  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);

  if (proceso.error) {
    console.error(`Error: no se pudo ejecutar Playwright (${proceso.error.message}).`);
    process.exit(1);
  }
  if (!fs.existsSync(rutaCrudos)) {
    console.error('Error: Playwright terminó sin generar resultados.');
    console.error('Revisa que este proyecto tenga @playwright/test instalado y que "npx playwright test" funcione.');
    process.exit(1);
  }

  const corrida: Corrida = JSON.parse(fs.readFileSync(rutaCrudos, 'utf-8'));
  const reporte = analizar(corrida, cargarConfigExclusion(values.excluir), Number(values.umbral));

  imprimirResumen(reporte);

  if (pareceFallaDeEntorno(reporte)) {
    console.warn('\n[flaky-detector] ADVERTENCIA: todos los tests fallaron en todas las repeticiones.');
    console.warn('Probablemente es un problema del entorno (navegador sin instalar, dependencias faltantes, servidor caído),');
    console.warn('no de los tests. Corre "npx playwright test" una vez y revisa el primer error.');
  }

  fs.writeFileSync(path.join(carpetaSalida, 'reporte.json'), JSON.stringify(reporte, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaSalida, 'reporte.html'), generarHtml(reporte), 'utf-8');

  console.log(`\n[flaky-detector] Terminado en ${segundos} segundos.`);
  console.log(`[flaky-detector] Reportes en: ${carpetaSalida}`);

  if (values.estricto && reporte.resumen.flaky > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  console.error('Usa --help para ver las opciones disponibles.');
  process.exit(1);
}
