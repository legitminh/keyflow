import { test, expect } from '@playwright/test';

test('shortcuts activate buttons and leave form input alone', async ({ page }) => {
  await page.goto('/flow');
  const counter = page.getByRole('button', { name: /count: 0/ });
  await counter.click({ trial: true }); // wait for layout and visibility-based shortcut registration
  await expect(counter.locator('.pending_route')).not.toBeEmpty();
  const shortcut = await counter.locator('.pending_route').innerText();
  await page.keyboard.type(shortcut);
  await expect(page.getByRole('button', { name: /count: 1/ })).toBeVisible();
  await page.getByLabel('Example input').fill(shortcut);
  await expect(page.getByRole('button', { name: /count: 1/ })).toBeVisible();
});

test('theme and zoom persist after reload', async ({ page }) => {
  await page.goto('/flow');
  await page.getByRole('button', { name: /dark$/ }).click();
  await page.getByRole('button', { name: /zoom in/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /light$/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--min-box'))
    )
    .toBe('60px');
});

test('paged scrolling, hash navigation, and native mode share the camera', async ({ page }) => {
  await page.goto('/flow');
  const world = page.locator('.world');
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => world.evaluate((node) => node.getBoundingClientRect().top))
    .toBeLessThan(-100);
  await page.goto('/flow#destination');
  await expect(page.getByRole('heading', { name: 'destination', exact: true })).toBeInViewport();
  await page.goto('/flow');
  await page.getByRole('button', { name: /toggle native scrolling/ }).click();
  await expect(page.locator('.viewport')).toHaveClass(/native-scroll/);
  const down = page.getByRole('button', { name: /↓$/ });
  const up = page.getByRole('button', { name: /↑$/ });
  await expect(down).toBeVisible();
  await expect(up).toBeVisible();
  const downShortcut = await down.locator('.pending_route').innerText();
  const upShortcut = await up.locator('.pending_route').innerText();
  await page.keyboard.type(downShortcut);
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const firstPage = await page.locator('.viewport').evaluate(node => node.scrollTop);
  await page.keyboard.type(upShortcut);
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeLessThan(firstPage);
  await page.keyboard.type(upShortcut.repeat(2));
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBe(0);
  await down.click();
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await up.click();
  await up.click();
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBe(0);
  await page.locator('.viewport').hover();
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => page.locator('.viewport').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  // Keyboard paging starts from the current wheel position and remains available at the end.
  const wheelPosition = await page.locator('.viewport').evaluate(node => node.scrollTop);
  await page.keyboard.type(downShortcut);
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeGreaterThan(wheelPosition);
  await expect(down).toBeVisible();
  await expect(up).toBeVisible();
});
