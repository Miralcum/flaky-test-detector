import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const N = Number(process.argv[2]) || 10;
const carpetaRuns = 'runs';

if (fs.existsSync(carpetaRuns)) {
  fs.rmSync(carpetaRuns, { recursive: true, force: true });
}
fs.mkdirSync(carpetaRuns);

console.log(`Ejecutando la suite ${N} veces...`);

for (let i = 1; i <= N; i++) {
  console.log(`--- Corrida ${i} de ${N} ---`);

  try {
    execSync('npx playwright test', { stdio: 'ignore' });
  } catch (error) {
  }

  const origen = 'run-result.json';
  const destino = path.join(carpetaRuns, `run-${i}.json`);

  if (fs.existsSync(origen)) {
    fs.copyFileSync(origen, destino);
  } else {
    console.warn(`Advertencia: no se encontró ${origen} tras la corrida ${i}`);
  }
}

console.log(`Listo. Se guardaron ${N} archivos en la carpeta '${carpetaRuns}/'.`);
