import { test, expect } from '@playwright/test';

test('condicion de carrera entre dos tareas async', async () => {
  let resultado = '';

  const tareaLenta = new Promise<void>((resolve) => {
    setTimeout(() => { resultado += 'A'; resolve(); }, Math.random() * 20);
  });

  const tareaRapida = new Promise<void>((resolve) => {
    setTimeout(() => { resultado += 'B'; resolve(); }, Math.random() * 20);
  });

  await Promise.all([tareaLenta, tareaRapida]);

  expect(resultado).toBe('AB');
});
