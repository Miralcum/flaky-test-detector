import { test, expect } from '@playwright/test';

test('fallo consistente no es flaky, es un bug real', async () => {
  expect(1).toBe(2);
});
