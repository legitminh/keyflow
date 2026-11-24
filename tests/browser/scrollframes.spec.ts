import { test, expect, type Page } from '@playwright/test';
const menu = (page: Page) => page.getByRole('region', { name: 'Long menu', exact: true });
const root = (page: Page) => page.locator('.viewport');
const item = (page: Page, index: number) => menu(page).getByRole('button', { name: new RegExp(`Item ${index}$`) });

test('an unbounded menu scrolls and pages its own frame without moving the document', async ({ page }) => {
  await page.goto('/scrollframes');
  const original = await root(page).evaluate((node) => node.scrollTop);
  await page.keyboard.press('m');
  const panel = menu(page), viewport = panel.locator(':scope > .subkeyframe-viewport');
  await expect(viewport).toHaveCSS('overflow-y', 'auto');
  expect(await panel.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(600.5);
  await expect(item(page, 99).locator('.pending_route')).toHaveCount(0);
  const before = await root(page).evaluate((node) => node.scrollTop);
  await viewport.hover(); await page.mouse.wheel(0, 350);
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  expect(await root(page).evaluate((node) => node.scrollTop)).toBe(before);
  await expect(item(page, 0).locator('.pending_route')).toHaveCount(0);
  const position = await viewport.evaluate((node) => node.scrollTop);
  await panel.locator(':scope > .scroll').getByRole('button', { name: /↓$/ }).click();
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(position);
  expect(await root(page).evaluate((node) => node.scrollTop)).toBe(before);
  await item(page, 0).focus(); await page.keyboard.press('End');
  await expect(panel.getByRole('button', { name: /back$/ })).toBeFocused();
  await expect(item(page, 99).locator('.pending_route')).not.toBeEmpty();
  await page.keyboard.type((await item(page, 99).locator('.pending_route').innerText()).trim());
  await expect(page.getByLabel('Selection')).toHaveText('Item 99');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Long menu', exact: true })).toBeFocused();
  expect(await root(page).evaluate((node) => node.scrollTop)).toBe(original);
});

test('nested menus have independent scroll positions and mask parent paging', async ({ page }) => {
  await page.goto('/scrollframes'); await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Nested menu', exact: true }).click();
  const child = page.getByRole('region', { name: 'Nested menu', exact: true });
  const childViewport = child.locator(':scope > .subkeyframe-viewport');
  const parentViewport = menu(page).locator(':scope > .subkeyframe-viewport');
  const before = await parentViewport.evaluate((node) => node.scrollTop);
  await childViewport.hover(); await page.mouse.wheel(0, 250);
  await expect.poll(() => childViewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await parentViewport.evaluate((node) => node.scrollTop)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nested menu', exact: true })).toBeFocused();
  await expect(menu(page)).toBeVisible();
});

test('fixed keyboards and navbars reserve scroll space and unregister covered positional controls', async ({ page }) => {
  await page.goto('/scrollframes');
  const row = page.getByRole('button', { name: /Root 0$/ });
  await expect(row.locator('.pending_route')).not.toBeEmpty();
  expect(await row.evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(56);
  const down = page.locator('.scroll').getByRole('button', { name: /↓$/ });
  expect(await down.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(600.5);
  await root(page).evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const last = page.getByRole('button', { name: /Root 79$/ });
  await expect(last.locator('.pending_route')).not.toBeEmpty();
  expect(await last.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(600.5);
  await expect(row.locator('.pending_route')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resize keyboard', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
  await expect.poll(() => down.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(480.5);
  await page.getByRole('button', { name: 'Toggle keyboard', exact: true }).evaluate((node: HTMLButtonElement) => node.click());
  await expect.poll(() => down.evaluate((node) => node.getBoundingClientRect().bottom)).toBeGreaterThan(600);
});

test('lockstep wheel input is confined to the active menu camera', async ({ page }) => {
  await page.goto('/scrollframes?lockstep'); await page.keyboard.press('m');
  const viewport = menu(page).locator(':scope > .subkeyframe-viewport');
  const before = await root(page).evaluate((node) => node.scrollTop);
  await viewport.hover(); await page.mouse.wheel(0, 100);
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(50);
  expect(await root(page).evaluate((node) => node.scrollTop)).toBe(before);
});

test('sticky toolbars restrict registration without adding recursive layout offsets', async ({ page }) => {
  await page.goto('/scrollframes?sticky');
  const first = page.getByRole('button', { name: /Root 0$/ });
  await expect(first.locator('.pending_route')).not.toBeEmpty();
  const top = await first.evaluate((node) => node.getBoundingClientRect().top);
  await page.waitForTimeout(150);
  expect(await first.evaluate((node) => node.getBoundingClientRect().top)).toBe(top);
  await root(page).evaluate((node) => { node.scrollTop = 200; });
  const covered = page.getByRole('button', { name: /Root 3$/ });
  await expect(covered.locator('.pending_route')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Root 4$/ }).locator('.pending_route')).not.toBeEmpty();
});
