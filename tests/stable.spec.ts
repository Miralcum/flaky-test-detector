import { test, expect } from '@playwright/test';

test('suma simple siempre correcta', async () => {
  expect(1 + 1).toBe(2);
});
