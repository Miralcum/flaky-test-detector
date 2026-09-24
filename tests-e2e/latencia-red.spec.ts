import { test, expect } from '@playwright/test';
import { abrirApp } from './app';

test.describe('latencia de red', () => {
  for (const limite of [50, 100, 150]) {
    test(`timeout de ${limite}ms con latencia 0-200ms`, { tag: '@flaky' }, async ({ page }) => {
      await abrirApp(page, { latenciaRedMs: 200 });
      await page.click('#cargar');
      await expect(page.locator('#datos')).toHaveText('datos cargados', { timeout: limite });
    });
  }

  test('timeout por defecto con latencia 0-200ms', { tag: '@estable' }, async ({ page }) => {
    await abrirApp(page, { latenciaRedMs: 200 });
    await page.click('#cargar');
    await expect(page.locator('#datos')).toHaveText('datos cargados');
  });

  test('sin latencia de red', { tag: '@estable' }, async ({ page }) => {
    await abrirApp(page, { latenciaRedMs: 0 });
    await page.click('#cargar');
    await expect(page.locator('#datos')).toHaveText('datos cargados');
  });

  test('bug real: texto esperado incorrecto (red)', { tag: '@determinista' }, async ({ page }) => {
    await abrirApp(page, { latenciaRedMs: 200 });
    await page.click('#cargar');
    await expect(page.locator('#datos')).toHaveText('otro texto', { timeout: 1000 });
  });
});
