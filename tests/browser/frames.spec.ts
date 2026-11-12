import { test, expect } from '@playwright/test';

test('nested frames mask root shortcuts and restore them on close', async ({ page }) => {
  await page.goto('/frames');
  const root = page.getByRole('button', { name: /root: 0$/ });
  await expect(root.locator('.pending_route')).toHaveText('q');
  await page.getByRole('button', { name: 'Toggle menu frame' }).click();
  const menu = page.getByRole('button', { name: /menu: 0$/ });
  await expect(menu.locator('.pending_route')).toHaveText('q');
  await expect(root.locator('.pending_route')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /root automatic/ }).locator('.pending_route')).toHaveCount(0);
  await page.keyboard.press('q');
  await expect(page.getByRole('button', { name: /menu: 1$/ })).toBeVisible();
  await expect(root).toBeVisible();
  await page.getByRole('button', { name: 'Toggle nested frame' }).click();
  await expect(page.getByRole('button', { name: /nested: 0$/ }).locator('.pending_route')).toHaveText('q');
  await page.keyboard.press('q');
  await expect(page.getByRole('button', { name: /nested: 1$/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /nested: 1$/ })).toHaveCount(0);
  await page.keyboard.press('q');
  await expect(page.getByRole('button', { name: /menu: 2$/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(root.locator('.pending_route')).toHaveText('q');
  await page.keyboard.press('q');
  await expect(page.getByRole('button', { name: /root: 1$/ })).toBeVisible();
});

test('mouse virtual keys activate automatic buttons, static buttons and interactables', async ({ page }) => {
  await page.goto('/frames');
  await expect(page.getByRole('button', { name: /root automatic/ }).locator('.pending_route')).toHaveText('a');
  const keyboard = page.getByRole('region', { name: '16-key keyboard' });
  await keyboard.getByRole('button', { name: 'a', exact: true }).click();
  await expect(page.getByRole('button', { name: /root: 1$/ })).toBeVisible();
  await keyboard.getByRole('button', { name: 's', exact: true }).click();
  await expect(page.getByRole('button', { name: /root: 2$/ })).toBeVisible();
  await keyboard.getByRole('button', { name: 'q', exact: true }).click();
  await expect(page.getByRole('button', { name: /root: 3$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle menu frame' }).click();
  await keyboard.getByRole('button', { name: 'q', exact: true }).click();
  await expect(page.getByRole('button', { name: /menu: 1$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /root: 3$/ })).toBeVisible();
});

test('keyboard layouts, optional toolbar, custom adapter and none selection work', async ({ page }) => {
  await page.goto('/frames');
  const select = page.getByLabel('Keyboard layout');
  for (const [id, count] of [['flick-alpha', 30], ['alpha', 26], ['alphanumeric', 36], ['60%', 61], ['ortholinear', 48], ['grid16', 16], ['grid32', 32]] as const) {
    await select.selectOption(id);
    await expect(page.locator('.keyflow-keyboard').first().locator('.keyflow-key')).toHaveCount(count);
  }
  await page.getByLabel('Use custom text adapter').check();
  await page.locator('.keyflow-keyboard').first().getByRole('button', { name: 'a', exact: true }).click();
  await expect(page.getByLabel('Custom text output')).toHaveText('a');
  await expect(page.getByRole('button', { name: /root: 0$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Hide keyboard' }).click();
  await expect(page.getByRole('region', { name: '32-key keyboard' })).toHaveCount(0);
  await expect(select).toHaveValue('');
  await select.selectOption('alpha');
  await expect(page.getByRole('region', { name: 'Alphabet', exact: true })).toBeVisible();
});

test('virtual buttons support native keyboard activation and touch taps', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 430, height: 900 } });
  const page = await context.newPage();
  await page.goto('/frames');
  const keyboard = page.getByRole('region', { name: '16-key keyboard' });
  await keyboard.getByRole('button', { name: 'q', exact: true }).tap();
  await expect(page.getByRole('button', { name: /root: 1$/ })).toBeVisible();
  const key = keyboard.getByRole('button', { name: 'a', exact: true });
  await key.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /root: 2$/ })).toBeVisible();
  await context.close();
});
