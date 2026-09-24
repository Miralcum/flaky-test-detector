import { test, expect } from '@playwright/test';
import { abrirApp } from './app';

test.describe('esperas fijas', () => {
  for (const espera of [10, 30, 50, 70, 90]) {
    test(`espera fija de ${espera}ms con retraso 0-100ms`, { tag: espera >= 90 ? '@estable' : '@flaky' }, async ({ page }) => {
      await abrirApp(page, { query: '?maxRetraso=100' });
      await page.click('#mostrar');
      await page.waitForTimeout(espera);
      expect(await page.locator('#mensaje').isVisible()).toBe(true);
    });
  }

  test('espera fija de 300ms (suficiente)', { tag: '@estable' }, async ({ page }) => {
    await abrirApp(page, { query: '?maxRetraso=100' });
    await page.click('#mostrar');
    await page.waitForTimeout(300);
    expect(await page.locator('#mensaje').isVisible()).toBe(true);
  });

  test('espera automatica de Playwright', { tag: '@estable' }, async ({ page }) => {
    await abrirApp(page, { query: '?maxRetraso=100' });
    await page.click('#mostrar');
    await expect(page.locator('#mensaje')).toBeVisible();
  });

  test('bug real: texto equivocado (esperas)', { tag: '@determinista' }, async ({ page }) => {
    await abrirApp(page, { query: '?maxRetraso=100' });
    await page.click('#mostrar');
    await expect(page.locator('#mensaje')).toHaveText('Mensaje equivocado', { timeout: 1000 });
  });
});
