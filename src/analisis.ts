import * as fs from 'fs';
import type {
  Clasificacion,
  ConfigExclusion,
  Corrida,
  EstadisticaTest,
  Reporte,
  ResultadoTest,
} from './tipos';

export function cargarConfigExclusion(ruta: string): ConfigExclusion {
  const vacia: ConfigExclusion = { excluir: { titulos: [], archivos: [] } };
  if (!fs.existsSync(ruta)) return vacia;

  const leido = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  return {
    excluir: {
      titulos: leido.excluir?.titulos ?? [],
      archivos: leido.excluir?.archivos ?? [],
    },
  };
}

function estaExcluido(titulo: string, archivo: string, config: ConfigExclusion): boolean {
  const porTitulo = config.excluir.titulos.includes(titulo);
  const porArchivo = config.excluir.archivos.some((a) => archivo.endsWith(a));
  return porTitulo || porArchivo;
}

// Comparación de dos lados: pasó / no pasó
function clasificar(passed: number, total: number, excluido: boolean): Clasificacion {
  if (excluido) return 'excluido';
  if (passed === total) return 'estable';
  if (passed === 0) return 'fallo-determinista';
  return 'flaky';
}

export function analizar(corrida: Corrida, config: ConfigExclusion, umbral = 0.3): Reporte {
  // Un resultado 'skipped' no es éxito ni fallo: el test no se ejecutó
  const ejecutados = corrida.resultados.filter((r) => r.status !== 'skipped');
  const clavesEjecutadas = new Set(ejecutados.map((r) => r.clave));
  const clavesOmitidas = new Set(
    corrida.resultados
      .filter((r) => r.status === 'skipped' && !clavesEjecutadas.has(r.clave))
      .map((r) => r.clave)
  );

  const porTest = new Map<string, ResultadoTest[]>();
  for (const r of ejecutados) {
    if (!porTest.has(r.clave)) {
      porTest.set(r.clave, []);
    }
    porTest.get(r.clave)!.push(r);
  }

  const estadisticas: EstadisticaTest[] = [];
  for (const [clave, resultados] of porTest) {
    const total = resultados.length;
    const passed = resultados.filter((r) => r.status === 'passed').length;
    const noPasaron = total - passed;
    const otros = resultados.filter((r) => r.status !== 'passed' && r.status !== 'failed').length;
    const tasa = Math.min(passed, noPasaron) / total;
    const primero = resultados[0];
    const clasificacion = clasificar(passed, total, estaExcluido(primero.titulo, primero.archivo, config));

    estadisticas.push({
      clave,
      titulo: primero.titulo,
      archivo: primero.archivo,
      proyecto: primero.proyecto,
      totalCorridas: total,
      passed,
      failed: noPasaron,
      otros,
      tasaInestabilidad: tasa,
      clasificacion,
      // Equivale a PruebaInestable en la ontología
      altaInestabilidad: clasificacion === 'flaky' && tasa >= umbral,
    });
  }

  const deClase = (c: Clasificacion) => estadisticas.filter((e) => e.clasificacion === c);
  const flaky = deClase('flaky').sort((a, b) => b.tasaInestabilidad - a.tasaInestabilidad);
  const deterministas = deClase('fallo-determinista');
  const estables = deClase('estable');
  const excluidos = deClase('excluido');

  return {
    generado: new Date().toISOString(),
    repeticiones: Math.max(0, ...estadisticas.map((e) => e.totalCorridas)),
    umbral,
    resumen: {
      flaky: flaky.length,
      falloDeterminista: deterministas.length,
      estables: estables.length,
      excluidos: excluidos.length,
      altaInestabilidad: flaky.filter((t) => t.altaInestabilidad).length,
      omitidos: clavesOmitidas.size,
    },
    tests: [...flaky, ...deterministas, ...estables, ...excluidos],
  };
}

export function imprimirResumen(reporte: Reporte): void {
  const secciones: [string, Clasificacion, boolean][] = [
    ['TESTS INESTABLES (FLAKY), ranking', 'flaky', true],
    ['DETERMINISTAS (siempre falla)', 'fallo-determinista', false],
    ['DETERMINISTAS (siempre pasa)', 'estable', false],
    ['EXCLUIDOS POR CONFIGURACIÓN', 'excluido', false],
  ];

  for (const [titulo, clase, conPorcentaje] of secciones) {
    const lista = reporte.tests.filter((t) => t.clasificacion === clase);
    console.log(`\n=== ${titulo} (${lista.length}) ===`);
    if (lista.length === 0) {
      console.log('  (ninguno)');
      continue;
    }
    for (const t of lista) {
      const prefijo = conPorcentaje
        ? `${(t.tasaInestabilidad * 100).toFixed(1).padStart(5)}%  |`
        : '        |';
      const alta = t.altaInestabilidad ? '  [INESTABLE]' : '';
      const timeouts = t.otros > 0 ? `, ${t.otros} por timeout/interrupción` : '';
      console.log(`${prefijo}  ${t.titulo}  (${t.passed} passed / ${t.failed} failed de ${t.totalCorridas}${timeouts})${alta}`);
    }
  }

  console.log(
    `\n${reporte.resumen.altaInestabilidad} de ${reporte.resumen.flaky} tests flaky son pruebas inestables (tasa >= ${(reporte.umbral * 100).toFixed(0)}%)`
  );
  if (reporte.resumen.omitidos > 0) {
    console.log(`(${reporte.resumen.omitidos} tests omitidos con skip: no se ejecutaron y no se analizaron)`);
  }
}

export function pareceFallaDeEntorno(reporte: Reporte): boolean {
  const analizados = reporte.tests.filter((t) => t.clasificacion !== 'excluido');
  return analizados.length > 1 && analizados.every((t) => t.clasificacion === 'fallo-determinista');
}
