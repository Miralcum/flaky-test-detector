import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const HTML_APP = fs.readFileSync(path.resolve('app/index.html'), 'utf-8');
const URL_BASE = 'http://app.test/';

interface OpcionesApp {
  query?: string;
  latenciaRedMs?: number;
}

export async function abrirApp(page: Page, opciones: OpcionesApp = {}): Promise<void> {
  const latenciaRedMs = opciones.latenciaRedMs ?? 0;

  await page.route(`${URL_BASE}**`, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/datos') {
      const retraso = Math.random() * latenciaRedMs;
      await new Promise((resolve) => setTimeout(resolve, retraso));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mensaje: 'datos cargados' }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'text/html', body: HTML_APP });
  });

  await page.goto(URL_BASE + (opciones.query ?? ''));
}
