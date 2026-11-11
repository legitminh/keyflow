import { test, expect } from '@playwright/test';

test('physical E opens keyboard selection; A returns without activating page A', async ({ page }) => {
  await page.goto('/stack');
  const actions = page.getByRole('group', { name: 'Page actions', exact: true });
  await expect(actions.getByRole('button', { name: /Open menu/ }).locator('.pending_route')).toHaveText('e');
  await page.keyboard.press('a');
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 1');
  await page.keyboard.press('e');
  await expect(page.getByLabel('Frame stack')).toHaveText('root → keyboard-menu');
  for (const button of await actions.getByRole('button').all()) await expect(button).toBeDisabled();
  await page.keyboard.press('a');
  await expect(page.getByRole('region', { name: 'Keyboard menu' })).toBeHidden();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 1');
  await page.keyboard.press('e');
  await page.keyboard.press('c'); // Choose the regular alpha keyboard.
  await expect(page.getByRole('region', { name: 'Alphabet', exact: true })).toBeVisible();
  await expect(page.getByLabel('Keyboard selection count')).toHaveText('Selections: 1');
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
});

test('virtual input and direct menu selection share the frame gate', async ({ page }) => {
  await page.goto('/');
  const keyboard = page.getByRole('region', { name: 'Flick alpha keyboard', exact: true });
  await keyboard.getByRole('button', { name: 'e', exact: true }).click();
  await expect(page.getByLabel('Frame stack')).toHaveText('root → keyboard-menu');
  await page.getByRole('button', { name: /Page A/ }).evaluate((element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 0');
  await keyboard.getByRole('button', { name: 'a', exact: true }).click();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
  await page.getByRole('button', { name: 'Choose keyboard', exact: true }).click();
  await page.getByRole('region', { name: 'Keyboard menu' }).getByRole('button', { name: /32-key keyboard/ }).click();
  await expect(page.getByRole('region', { name: '32-key keyboard', exact: true })).toBeVisible();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
});

test('touch input enters and leaves a referenced frame', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 430, height: 900 } });
  const page = await context.newPage();
  await page.goto('/stack');
  const keyboard = page.getByRole('region', { name: 'Flick alpha keyboard', exact: true });
  await keyboard.getByRole('button', { name: 'e', exact: true }).tap();
  await expect(page.getByLabel('Frame stack')).toHaveText('root → keyboard-menu');
  await expect(page.getByRole('button', { name: /Page A/ })).toBeDisabled();
  await keyboard.getByRole('button', { name: 'a', exact: true }).tap();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 0');
  await context.close();
});
