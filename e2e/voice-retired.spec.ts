import { test, expect } from '@playwright/test';

test('voice is retired while local mixing and Groq planning remain available', async ({ page, request }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: true, authorized: true, model: 'openai/gpt-oss-20b' } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'DJ MC', exact: true })).toHaveCount(0);
  await expect(page.locator('#play-btn-A')).toBeVisible();
  await expect(page.locator('#play-btn-B')).toBeVisible();
  await page.getByRole('button', { name: 'Party mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View AI connection', exact: true })).toBeVisible();
  const response = await request.post('/api/ai/speech', { data: { text: 'This endpoint is retired.' } });
  expect(response.status()).toBe(404);
});
