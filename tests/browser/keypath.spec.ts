import { test, expect } from '@playwright/test';

test('keypath toggle hides labels, keeps shortcuts working, and persists', async ({ page }) => {
  await page.goto('/flow');
  const counter = page.getByRole('button', { name: /count: 0/ });
  await counter.click({ trial: true });
  await expect(counter.locator('.pending_route')).not.toBeEmpty();
  const shortcut = await counter.locator('.pending_route').innerText();

  await page.getByRole('button', { name: /keypaths shown$/ }).click();
  await expect(page.getByRole('button', { name: /keypaths hidden$/ })).toBeVisible();
  await expect(page.locator('.route')).toHaveCount(0);
  // Shortcut colors stay as an indicator without the labels.
  await expect(counter.locator('.colored')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('keyflow:keypath_visible'))).toBe('false');

  await page.keyboard.type(shortcut);
  await expect(page.getByRole('button', { name: /count: 1/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /keypaths hidden$/ })).toBeVisible();
  await expect(page.locator('.route')).toHaveCount(0);
  await page.getByRole('button', { name: /keypaths hidden$/ }).click();
  await expect(page.getByRole('button', { name: /count: 0/ }).locator('.pending_route')).not.toBeEmpty();
});

test('auto keypath visibility follows the device pointer until the user chooses', async ({ browser }) => {
  const desktop = await browser.newPage();
  await desktop.goto('/flow?keypath-auto');
  await expect(desktop.getByRole('button', { name: /keypaths shown$/ })).toBeVisible();
  await desktop.close();

  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const touch = await context.newPage();
  await touch.goto('/flow?keypath-auto');
  await expect(touch.getByRole('button', { name: /keypaths hidden$/ })).toBeVisible();
  await expect(touch.locator('.route')).toHaveCount(0);
  expect(await touch.evaluate(() => localStorage.getItem('keyflow:keypath_visible'))).toBeNull();
  await touch.getByRole('button', { name: /keypaths hidden$/ }).click();
  await touch.reload();
  await expect(touch.getByRole('button', { name: /keypaths shown$/ })).toBeVisible();
  await context.close();
});
