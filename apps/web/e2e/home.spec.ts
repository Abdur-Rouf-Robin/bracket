import { test, expect } from '@playwright/test';

test('home page shows Bracket brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Bracket').first()).toBeVisible();
});
