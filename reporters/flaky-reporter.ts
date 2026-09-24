import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';

interface ResultadoTest {
  id: string;
  clave: string;
  titulo: string;
  archivo: string;
  status: string;
  duracionMs: number;
  repeticion: number;
  worker: number;
  etiquetas: string[];  // etiquetas del test, por ejemplo ['@flaky']
}

class FlakyReporter implements Reporter {
  private resultados: ResultadoTest[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    this.resultados.push({
      id: test.id,
      clave: test.titlePath().filter(Boolean).join(' > '),
      titulo: test.title,
      archivo: test.location.file,
      status: result.status,
      duracionMs: result.duration,
      repeticion: test.repeatEachIndex,
      worker: result.workerIndex,
      etiquetas: test.tags,
    });
  }

  onEnd(): void {
    const salida = {
      timestamp: new Date().toISOString(),
      resultados: this.resultados,
    };

    fs.writeFileSync('run-result.json', JSON.stringify(salida, null, 2), 'utf-8');

    console.log(`\n[FlakyReporter] Guardados ${this.resultados.length} resultados en run-result.json`);
  }
}

export default FlakyReporter;
