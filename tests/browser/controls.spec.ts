import { test, expect, type Page } from '@playwright/test';

const editor = (page: Page) => page.getByRole('textbox', { name: 'Externally opened editor', exact: true });
const stack = (page: Page) => page.getByLabel('Frame stack');

test('all client button types can enter one textbox through its public API and restore focus', async ({ page }) => {
  await page.goto('/controls');
  await expect(page.getByRole('button', { name: 'Externally opened editor', exact: true })).toHaveCount(0);
  const names = ['Ordered opener', 'Positional opener', 'Custom interactable opener', 'Absolute opener',
    'Hover opener', 'Positional hover opener', 'Native API opener'];
  for (const [index, name] of names.entries()) {
    const opener = page.getByRole('button', { name: new RegExp(`${name}$`) });
    await opener.click();
    await expect(editor(page)).toBeFocused();
    await expect(stack(page)).toHaveText('root → textbox');
    await editor(page).fill(`session ${index}`);
    await page.keyboard.press('Escape');
    await expect(stack(page)).toHaveText('root');
    await expect(opener).toBeFocused();
    await expect(page.getByLabel('Editing sessions')).toHaveText(`Entries: ${index + 1}; exits: ${index + 1}`);
  }
  await page.getByRole('button', { name: 'Native API opener', exact: true }).click();
  await expect(editor(page)).toHaveValue('session 6');
  await page.getByRole('button', { name: 'Exit via API' }).click();
  await expect(stack(page)).toHaveText('root');
});

test('externally supplied automatic and absolute keyboard paths enter the textbox', async ({ page }) => {
  await page.goto('/controls');
  const opener = page.getByRole('button', { name: 'Hover opener', exact: true });
  await expect(opener.locator('.pending_route')).not.toBeEmpty();
  const route = (await opener.locator('.pending_route').textContent())!;
  await page.keyboard.type(route);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('z');
  await expect(editor(page)).toBeFocused();
});

test('entry and exit props can change at runtime, including external-only and automatic entry', async ({ page }) => {
  await page.goto('/controls');
  const chooseEntry = async (value: string) => {
    await page.getByLabel('Entry binding').selectOption(value);
    await page.getByRole('heading').click();
  };
  await chooseEntry('t');
  await page.keyboard.press('t');
  await expect(editor(page)).toBeFocused();
  await page.getByLabel('Exit binding').selectOption('F2');
  await editor(page).focus();
  await expect(page.getByRole('status')).toHaveText('Exit with f2');
  await page.keyboard.press('Escape');
  await expect(stack(page)).toHaveText('root → textbox');
  await page.keyboard.press('F2');
  await expect(stack(page)).toHaveText('root');
  await chooseEntry('y');
  await page.keyboard.press('t');
  await expect(stack(page)).toHaveText('root');
  await page.keyboard.press('y');
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('F2');
  await chooseEntry('external');
  await page.keyboard.press('y');
  await expect(stack(page)).toHaveText('root');
  const hover = page.getByRole('button', { name: 'Hover action', exact: true });
  const externalRoute = (await hover.locator('.pending_route').textContent())!;
  await chooseEntry('auto');
  await expect(hover.locator('.pending_route')).not.toHaveText(externalRoute);
  await chooseEntry('external');
  await expect(hover.locator('.pending_route')).toHaveText(externalRoute);
});

test('textbox API respects disabled, active frame, repeated entry, child frames and unmount', async ({ page }) => {
  await page.goto('/controls');
  const open = page.getByRole('button', { name: 'Native API opener', exact: true });
  const exit = page.getByRole('button', { name: 'Exit via API' });
  await page.getByLabel('Disable editor').check();
  await open.click();
  await expect(stack(page)).toHaveText('root');
  await page.getByLabel('Disable editor').uncheck();
  await open.click();
  await open.click();
  await expect(page.getByLabel('Editing sessions')).toHaveText('Entries: 1; exits: 0');
  await page.getByRole('button', { name: 'Push child frame' }).click();
  await open.click();
  await exit.click();
  await expect(stack(page)).toHaveText('root → textbox → child');
  await page.getByRole('button', { name: /Close child$/ }).click();
  await expect(editor(page)).toBeFocused();
  await editor(page).fill('retained');
  await page.getByLabel('Disable editor').check();
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Editing sessions')).toHaveText('Entries: 1; exits: 1');
  await page.getByLabel('Disable editor').uncheck();
  await open.click();
  await expect(editor(page)).toHaveValue('retained');
  await page.getByLabel('Mount editor').uncheck();
  await expect(stack(page)).toHaveText('root');
  await open.click();
  await expect(stack(page)).toHaveText('root');
  await page.getByLabel('Mount editor').check();
  await open.click();
  await expect(editor(page)).toHaveValue('retained');
});

test('built-in entry remains clickable without a binding and supports switching to automatic entry', async ({ page }) => {
  await page.goto('/controls');
  await page.getByLabel('Show built-in entry').check();
  const preview = page.getByRole('button', { name: 'Externally opened editor', exact: true });
  await expect(preview.locator('.route')).toHaveCount(0);
  await preview.click();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(preview).toBeFocused();
  await page.getByLabel('Entry binding').selectOption('auto');
  await expect(preview.locator('.pending_route')).not.toBeEmpty();
  await page.getByRole('heading').click();
  await page.keyboard.type((await preview.locator('.pending_route').textContent())!);
  await expect(editor(page)).toBeFocused();
});

for (const name of ['Hover action', 'Positional hover action']) {
  test(`${name} overlays its live route/progress on hover and keyboard focus`, async ({ page }, testInfo) => {
    await page.goto('/controls');
    const button = page.getByRole('button', { name, exact: true });
    const route = button.locator('.route');
    await expect(button.locator('.pending_route')).not.toBeEmpty();
    const keys = (await button.locator('.pending_route').textContent())!;
    expect(keys.length).toBeGreaterThan(1);
    await expect(route).toBeHidden();
    const before = await button.boundingBox();
    await button.hover();
    await expect(route).toBeVisible();
    expect(await button.boundingBox()).toEqual(before);
    await page.keyboard.press(keys[0]);
    await expect(button.locator('.enter_route')).toHaveText(keys[0]);
    await expect(button.locator('.pending_route')).toHaveText(keys.slice(1));
    await page.screenshot({ path: testInfo.outputPath('hover-progress.png') });
    await page.keyboard.type(keys.slice(1));
    await expect(page.getByLabel('Hover activations')).toHaveText('Hover actions: 1');
    await page.mouse.move(0, 0);
    await expect(route).toBeHidden();
    await button.focus();
    await expect(route).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Hover activations')).toHaveText('Hover actions: 2');
    await button.click();
    await expect(page.getByLabel('Hover activations')).toHaveText('Hover actions: 3');
    await page.getByRole('button', { name: 'Native API opener', exact: true }).click();
    await expect(button).toBeDisabled();
    await button.dispatchEvent('click');
    await expect(page.getByLabel('Hover activations')).toHaveText('Hover actions: 3');
  });
}

test('hover variants retain persistent vs visible-only registration', async ({ page }) => {
  await page.goto('/controls');
  const persistent = page.getByRole('button', { name: 'Persistent offscreen action', exact: true });
  const positional = page.getByRole('button', { name: 'Visible positional action', exact: true });
  await expect(persistent.locator('.pending_route')).not.toBeEmpty();
  await expect(positional.locator('.pending_route')).toHaveCount(0);
  await page.keyboard.type((await persistent.locator('.pending_route').textContent())!);
  await expect(page.getByLabel('Hover activations')).toHaveText('Hover actions: 1');
  await positional.scrollIntoViewIfNeeded();
  await expect(positional.locator('.pending_route')).not.toBeEmpty();
  await page.keyboard.type((await positional.locator('.pending_route').textContent())!);
  await expect(page.getByLabel('Hover activations')).toHaveText('Hover actions: 2');
  await page.getByRole('heading').scrollIntoViewIfNeeded();
  await expect(positional.locator('.pending_route')).toHaveCount(0);
  await expect(persistent.locator('.pending_route')).not.toBeEmpty();
});
