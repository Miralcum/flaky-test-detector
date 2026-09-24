import { test, expect } from '@playwright/test';

test('espera fija insuficiente para operacion variable', async () => {
  const inicio = Date.now();

  const duracionSimulada = Math.random() * 100;
  await new Promise((resolve) => setTimeout(resolve, duracionSimulada));

  const transcurrido = Date.now() - inicio;

  expect(transcurrido).toBeLessThan(50);
});
