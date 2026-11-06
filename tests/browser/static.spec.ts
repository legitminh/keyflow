import { test, expect, type Page } from '@playwright/test';

const sequenceCounter = (page: Page, count: number) =>
  page.getByRole('button', { name: new RegExp(`sequence: ${count}$`) }).filter({ hasNotText: 'escape' });

test('ordered static sequences work released or overlapping and show progress', async ({ page }) => {
  await page.goto('/static');
  const sequence = sequenceCounter(page, 0);
  await expect(sequence.locator('.pending_route')).toHaveText('ab');
  await expect(page.getByRole('button', { name: /automatic: 0/ }).locator('.pending_route')).toHaveText('f');
  await page.keyboard.press('b'); await page.keyboard.press('a');
  await expect(sequence.locator('.enter_route')).toHaveText('a');
  await page.keyboard.press('b');
  await expect(sequenceCounter(page, 1)).toBeVisible();
  await page.keyboard.down('a'); await page.keyboard.down('b');
  await page.keyboard.up('a');
  await expect(sequenceCounter(page, 1).locator('.enter_route')).toHaveText('ab');
  await page.keyboard.up('b');
  await expect(sequenceCounter(page, 2)).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: /automatic: 1/ })).toBeVisible();
});

for (const platform of ['mac', 'windows', 'linux']) {
  test(`portable primary modifier uses correct input and label on ${platform}`, async ({ page }) => {
    await page.goto(`/static?platform=${platform}`);
    const primary = page.getByRole('button', { name: /primary: 0/ });
    await expect(primary.locator('.pending_route')).toHaveText(platform === 'mac' ? '⌘k' : 'ctrlk');
    await page.keyboard.down(platform === 'mac' ? 'Meta' : 'Control');
    await page.keyboard.down('k');
    await page.keyboard.up('k');
    await expect(primary.locator('.enter_route')).toHaveText(platform === 'mac' ? '⌘k' : 'ctrlk');
    await page.keyboard.up(platform === 'mac' ? 'Meta' : 'Control');
    await expect(page.getByRole('button', { name: /primary: 1/ })).toBeVisible();
  });
}

test('Shift and Escape follow the same ordered sequence rules', async ({ page }) => {
  await page.goto('/static');
  await expect(page.getByRole('button', { name: /shifted: 0/ }).locator('.pending_route')).toHaveText('⇧j');
  await page.keyboard.press('Shift+j');
  await expect(page.getByRole('button', { name: /shifted: 1/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('x');
  await expect(page.getByRole('button', { name: /escape sequence: 1/ })).toBeVisible();
});

test('focus and blur cancel static sequences; typing stays in form fields', async ({ page }) => {
  await page.goto('/static');
  await expect(sequenceCounter(page, 0)).toBeVisible();
  await page.keyboard.press('a');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.press('b');
  await expect(sequenceCounter(page, 0)).toBeVisible();
  const field = page.getByLabel('Static example input');
  await field.focus();
  await page.keyboard.type('abz');
  await expect(field).toHaveValue('abz');
  await field.blur();
  await expect(page.getByRole('button', { name: /custom: 0/ })).toBeVisible();
  await page.keyboard.press('z');
  await expect(page.getByRole('button', { name: /custom: 1/ })).toBeVisible();
  await page.getByRole('button', { name: /custom: 1/ }).click();
  await expect(page.getByRole('button', { name: /custom: 2/ })).toBeVisible();
});

test('static steps prevent defaults, including repeats; unrelated browser shortcuts remain available', async ({ page }) => {
  await page.goto('/static?platform=windows');
  await expect(page.getByRole('button', { name: /primary: 0/ }).locator('.pending_route')).toHaveText('ctrlk');
  const result = await page.evaluate(() => {
    const send = (type: string, init: KeyboardEventInit) => {
      const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const prefix = send('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    const registered = send('keydown', { key: 'k', code: 'KeyK', ctrlKey: true });
    const repeat = send('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, repeat: true });
    send('keyup', { key: 'k', code: 'KeyK', ctrlKey: true });
    send('keyup', { key: 'Control', code: 'ControlLeft' });
    send('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    const unrelated = send('keydown', { key: 'q', code: 'KeyQ', ctrlKey: true });
    send('keyup', { key: 'q', code: 'KeyQ', ctrlKey: true });
    send('keyup', { key: 'Control', code: 'ControlLeft' });
    return { prefix, registered, repeat, unrelated };
  });
  expect(result).toEqual({ prefix: true, registered: true, repeat: true, unrelated: false });
  await expect(page.getByRole('button', { name: /primary: 1/ })).toBeVisible();
});

test('changing and unmounting static controls restores automatic key reservations', async ({ page }) => {
  await page.goto('/static');
  const automatic = page.getByRole('button', { name: /automatic:/ });
  await expect(page.getByRole('button', { name: /dynamic: 0/ }).locator('.pending_route')).toHaveText('e');
  await expect(automatic.locator('.pending_route')).toHaveText('f');
  await page.getByRole('button', { name: 'Change static key' }).click();
  await expect(page.getByRole('button', { name: /dynamic: 0/ }).locator('.pending_route')).toHaveText('g');
  await expect(automatic.locator('.pending_route')).toHaveText('e');
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: /automatic: 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /dynamic: 0/ })).toBeVisible();
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: /dynamic: 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Change static key' }).click();
  await expect(automatic.locator('.pending_route')).toHaveText('f');
  await page.getByRole('button', { name: 'Toggle static control' }).click();
  await expect(page.getByRole('button', { name: /dynamic: 1/ })).toHaveCount(0);
  await expect(automatic.locator('.pending_route')).toHaveText('e');
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: /automatic: 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle static control' }).click();
  await expect(page.getByRole('button', { name: /dynamic: 1/ }).locator('.pending_route')).toHaveText('e');
});

test('positional controls enter and leave the automatic pool without changing a pending fixed sequence', async ({ page }) => {
  await page.goto('/mixed');
  const fixed = page.getByRole('button', { name: /fixed:/ });
  const automatic = page.getByRole('button', { name: /automatic:/ });
  const first = page.getByRole('button', { name: /near 1:/ });
  const far = page.getByRole('button', { name: /far:/ });
  await expect(fixed.locator('.pending_route')).toHaveText('ab');
  await expect(automatic.locator('.pending_route')).toHaveText(/^[cd]$/);
  await expect(far.locator('.pending_route')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle positional controls' }).click();
  await expect(first.locator('.pending_route')).toHaveText(/^[cd]{2}$/);
  await expect(automatic.locator('.pending_route')).toHaveText(/^[cd]{2}$/);
  const shortcut = await first.locator('.pending_route').innerText();
  await page.keyboard.type(shortcut);
  await expect(page.getByRole('button', { name: /near 1: 1/ })).toBeVisible();
  await page.keyboard.press('a');
  await expect(fixed.locator('.enter_route')).toHaveText('a');
  await page.locator('.viewport').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(far).toBeInViewport();
  await expect(far.locator('.pending_route')).toHaveText(/^[cd]$/);
  await expect(first.locator('.pending_route')).toHaveCount(0);
  await expect(automatic.locator('.pending_route')).toHaveText(/^[cd]$/);
  await expect(fixed.locator('.enter_route')).toHaveText('a');
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: /fixed: 1/ })).toHaveCount(1);
  await expect(fixed.locator('.pending_route')).toHaveText('ab');
  await page.keyboard.type(await far.locator('.pending_route').innerText());
  await expect(page.getByRole('button', { name: /far: 2/ })).toBeVisible();
});
