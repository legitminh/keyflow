import { test, expect, type Page } from '@playwright/test';

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const themeButton = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`${name}$`) });

test('system preference persists, follows live OS changes, and cycles back to explicit themes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/flow');
  await themeButton(page, 'dark').click();
  await themeButton(page, 'light').click();
  await expect(themeButton(page, 'system')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(255, 255, 255)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => background(page)).toBe('rgb(0, 0, 0)');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('keyflow:theme_id'))).toBe('system');
  await page.reload();
  await expect(themeButton(page, 'system')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(0, 0, 0)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => background(page)).toBe('rgb(255, 255, 255)');
  await themeButton(page, 'system').click();
  await expect(themeButton(page, 'dark')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => background(page)).toBe('rgb(255, 255, 255)');
  await themeButton(page, 'dark').click();
  await expect.poll(() => background(page)).toBe('rgb(0, 0, 0)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => background(page)).toBe('rgb(0, 0, 0)');
});

test('initial system mode resolves custom palettes and stops tracking on unmount', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/themes');
  await expect(themeButton(page, 'system')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(221, 238, 255)');
  await expect(page.getByLabel('Resolved palette')).toHaveText('paper');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => background(page)).toBe('rgb(17, 34, 51)');
  await expect(page.getByLabel('Resolved palette')).toHaveText('night');
  await page.getByLabel('Mount Keyflow').uncheck();
  await page.emulateMedia({ colorScheme: 'light' });
  // Rendering two frames lets the media-query event finish before checking cleanup.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(() => background(page)).toBe('rgb(17, 34, 51)');
  await page.getByLabel('Mount Keyflow').check();
  await expect(themeButton(page, 'system')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(221, 238, 255)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => background(page)).toBe('rgb(17, 34, 51)');
});

test('system mode works without preference storage', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.goto('/themes');
  await expect(themeButton(page, 'system')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(221, 238, 255)');
  await themeButton(page, 'system').click();
  await expect(themeButton(page, 'night')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(17, 34, 51)');
});

test('invalid saved IDs fall back to the existing initial theme', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('keyflow:theme_id', '999'));
  await page.goto('/flow');
  await expect(themeButton(page, 'dark')).toBeVisible();
  await expect.poll(() => background(page)).toBe('rgb(255, 255, 255)');
});
