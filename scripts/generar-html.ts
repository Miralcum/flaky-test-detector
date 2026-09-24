import * as fs from 'fs';
import * as path from 'path';

interface EstadisticaTest {
  id: string;
  titulo: string;
  archivo: string;
  totalCorridas: number;
  passed: number;
  failed: number;
  otros: number;
  tasaInestabilidad: number;
  clasificacion: string;
}

interface Reporte {
  generado: string;
  corridasAnalizadas: number;
  resumen: {
    flaky: number;
    falloDeterminista: number;
    estables: number;
    excluidos: number;
  };
  tests: EstadisticaTest[];
}

const rutaEntrada = 'reporte.json';
const rutaSalida = 'reporte.html';

if (!fs.existsSync(rutaEntrada)) {
  console.error(`No se encontró ${rutaEntrada}. Corre primero: npm run calcular`);
  process.exit(1);
}

const reporte: Reporte = JSON.parse(fs.readFileSync(rutaEntrada, 'utf-8'));

// Evita que un título con caracteres como < o > rompa la página
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const etiquetas: Record<string, string> = {
  'flaky': 'Flaky',
  'estable': 'Estable',
  'fallo-determinista': 'Fallo determinista',
  'excluido': 'Excluido',
};

function filaTest(t: EstadisticaTest, posicion: number): string {
  const porcentaje = (t.tasaInestabilidad * 100).toFixed(1);
  // Con dos resultados posibles (pasa/falla), la tasa máxima es 50%.
  // Por eso la barra se llena por completo al llegar a 50%.
  const anchoBarra = Math.min((t.tasaInestabilidad / 0.5) * 100, 100);

  return `
    <tr>
      <td class="num">${posicion}</td>
      <td>
        <div class="titulo">${escaparHtml(t.titulo)}</div>
        <div class="archivo">${escaparHtml(path.basename(t.archivo))}</div>
      </td>
      <td><span class="etiqueta ${t.clasificacion}">${etiquetas[t.clasificacion] ?? t.clasificacion}</span></td>
      <td class="num">${t.passed}</td>
      <td class="num">${t.failed}</td>
      <td class="num">${t.totalCorridas}</td>
      <td>
        <div class="celda-tasa">
          <div class="barra-fondo"><div class="barra" style="width: ${anchoBarra}%"></div></div>
          <span class="porcentaje">${porcentaje}%</span>
        </div>
      </td>
    </tr>`;
}

const repeticiones = reporte.tests[0]?.totalCorridas ?? 0;
const fecha = new Date(reporte.generado).toLocaleString('es-MX');
const filas = reporte.tests.map((t, i) => filaTest(t, i + 1)).join('');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte de tests inestables</title>
<style>
  :root {
    --fondo: #f6f7f9;
    --tarjeta: #ffffff;
    --texto: #1c2430;
    --tenue: #6b7685;
    --borde: #e3e7ec;
    --flaky: #c2410c;
    --estable: #15803d;
    --determinista: #b91c1c;
    --excluido: #6b7280;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fondo: #12161c;
      --tarjeta: #1b2129;
      --texto: #e6e9ee;
      --tenue: #95a0ae;
      --borde: #2b333d;
      --flaky: #fb923c;
      --estable: #4ade80;
      --determinista: #f87171;
      --excluido: #9ca3af;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 16px;
    background: var(--fondo);
    color: var(--texto);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .contenedor { max-width: 1000px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  .subtitulo { color: var(--tenue); margin: 0 0 24px; font-size: 14px; }
  .tarjetas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .tarjeta {
    background: var(--tarjeta);
    border: 1px solid var(--borde);
    border-radius: 10px;
    padding: 16px;
  }
  .tarjeta .valor { font-size: 30px; font-weight: 700; }
  .tarjeta .nombre { color: var(--tenue); font-size: 13px; margin-top: 4px; }
  .tarjeta.flaky .valor { color: var(--flaky); }
  .tarjeta.estable .valor { color: var(--estable); }
  .tarjeta.fallo-determinista .valor { color: var(--determinista); }
  .tarjeta.excluido .valor { color: var(--excluido); }
  .tabla-envoltura {
    background: var(--tarjeta);
    border: 1px solid var(--borde);
    border-radius: 10px;
    overflow-x: auto;
  }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--borde); }
  th { color: var(--tenue); font-weight: 600; font-size: 12px; text-transform: uppercase; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .titulo { font-weight: 600; }
  .archivo { color: var(--tenue); font-size: 12px; margin-top: 2px; font-family: ui-monospace, monospace; }
  .etiqueta {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid currentColor;
    white-space: nowrap;
  }
  .etiqueta.flaky { color: var(--flaky); }
  .etiqueta.estable { color: var(--estable); }
  .etiqueta.fallo-determinista { color: var(--determinista); }
  .etiqueta.excluido { color: var(--excluido); }
  .celda-tasa { display: flex; align-items: center; gap: 10px; min-width: 170px; }
  .barra-fondo { flex: 1; height: 8px; background: var(--borde); border-radius: 999px; overflow: hidden; }
  .barra { height: 100%; background: var(--flaky); }
  .porcentaje { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 48px; text-align: right; }
  .nota { color: var(--tenue); font-size: 12px; margin-top: 16px; }
</style>
</head>
<body>
  <div class="contenedor">
    <h1>Reporte de tests inestables</h1>
    <p class="subtitulo">Generado: ${fecha} · Repeticiones por test: ${repeticiones}</p>

    <div class="tarjetas">
      <div class="tarjeta flaky"><div class="valor">${reporte.resumen.flaky}</div><div class="nombre">Flaky</div></div>
      <div class="tarjeta fallo-determinista"><div class="valor">${reporte.resumen.falloDeterminista}</div><div class="nombre">Fallo determinista</div></div>
      <div class="tarjeta estable"><div class="valor">${reporte.resumen.estables}</div><div class="nombre">Estables</div></div>
      <div class="tarjeta excluido"><div class="valor">${reporte.resumen.excluidos}</div><div class="nombre">Excluidos</div></div>
    </div>

    <div class="tabla-envoltura">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Test</th>
            <th>Clasificación</th>
            <th class="num">Pasó</th>
            <th class="num">Falló</th>
            <th class="num">Total</th>
            <th>Tasa de inestabilidad</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>
    </div>

    <p class="nota">
      Tasa de inestabilidad = proporción de resultados que no coinciden con el resultado mayoritario.
      Con dos resultados posibles (pasa/falla), el valor máximo es 50%.
    </p>
  </div>
</body>
</html>`;

fs.writeFileSync(rutaSalida, html, 'utf-8');
console.log(`Reporte HTML generado en ${rutaSalida}`);
