import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { VARIABLE_SALIDA, type ResultadoTest } from './tipos';

class FlakyReporter implements Reporter {
  private resultados: ResultadoTest[] = [];
  private total = 0;
  private terminados = 0;
  private ultimoAviso = 0;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length;
    console.log(`[flaky-detector] ${this.total} ejecuciones programadas`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.resultados.push({
      id: test.id,
      clave: test.titlePath().filter(Boolean).join(' > '),
      titulo: test.title,
      archivo: test.location.file,
      proyecto: test.parent.project()?.name ?? '',
      status: result.status,
      duracionMs: result.duration,
      repeticion: test.repeatEachIndex,
      worker: result.workerIndex,
      etiquetas: test.tags,
    });

    // Avisa el progreso cada 10%
    this.terminados++;
    if (this.total > 0) {
      const avance = Math.floor((this.terminados / this.total) * 10);
      if (avance > this.ultimoAviso) {
        this.ultimoAviso = avance;
        console.log(`[flaky-detector] ${avance * 10}% completado`);
      }
    }
  }

  onEnd(): void {
    const rutaSalida = process.env[VARIABLE_SALIDA] ?? 'run-result.json';
    fs.mkdirSync(path.dirname(path.resolve(rutaSalida)), { recursive: true });

    const salida = {
      timestamp: new Date().toISOString(),
      resultados: this.resultados,
    };
    fs.writeFileSync(rutaSalida, JSON.stringify(salida, null, 2), 'utf-8');
  }
}

export default FlakyReporter;
