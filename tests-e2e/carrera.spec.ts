import { test, expect } from '@playwright/test';
import { abrirApp } from './app';

test.describe('condiciones de carrera', () => {
  for (const maxB of [20, 40, 80]) {
    test(`asume orden AB con A 0-20ms y B 0-${maxB}ms`, { tag: '@flaky' }, async ({ page }) => {
      await abrirApp(page, { query: `?maxA=20&maxB=${maxB}` });
      await page.locator('#carrera-lista').waitFor();
      expect(await page.locator('#orden').textContent()).toBe('AB');
    });
  }

  test('verifica ambas letras sin asumir orden', { tag: '@estable' }, async ({ page }) => {
    await abrirApp(page, { query: '?maxA=20&maxB=20' });
    await page.locator('#carrera-lista').waitFor();
    const letras = (await page.locator('#orden').textContent()) ?? '';
    expect(letras.split('').sort().join('')).toBe('AB');
  });

  test('bug real: espera tres letras', { tag: '@determinista' }, async ({ page }) => {
    await abrirApp(page, { query: '?maxA=20&maxB=20' });
    await page.locator('#carrera-lista').waitFor();
    expect(await page.locator('#orden').textContent()).toBe('ABC');
  });
});
