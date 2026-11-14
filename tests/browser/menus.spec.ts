import { test, expect, type Page } from '@playwright/test';
const stack = (page: Page) => page.getByLabel('Frame stack');
const file = (page: Page) => page.getByRole('region', { name: 'File', exact: true });
const button = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`${label}$`) });
let errors: string[];
test.beforeEach(async ({ page }) => { errors = []; page.on('pageerror', (error) => errors.push(error.message)); await page.goto('/menus'); });
test.afterEach(() => { expect(errors).toEqual([]); });

test('a dropdown owns its frame, focuses its first item, selects, and restores its trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'File', exact: true });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(stack(page)).toHaveText('root → File');
  await expect(button(page, 'New file')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Tools', exact: true })).toBeDisabled();
  await button(page, 'New file').click();
  await expect(file(page)).toHaveCount(0);
  await expect(stack(page)).toHaveText('root');
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel('Selected item')).toHaveText('New file');
  await expect(page.getByLabel('Menu sessions')).toHaveText('Entries: 1; exits: 1; selections: 1');
});

test('automatic/static item routes work and disabled items have no action or reserved shortcut', async ({ page }) => {
  await page.keyboard.press('f');
  await expect(button(page, 'Delete file')).toBeDisabled();
  await button(page, 'Delete file').dispatchEvent('click');
  await page.keyboard.press('x');
  await expect(page.getByLabel('Selected item')).toHaveText('none');
  await expect(stack(page)).toHaveText('root → File');
  await page.keyboard.press('p');
  await expect(stack(page)).toHaveText('root → File');
  await expect(page.getByLabel('Selected item')).toHaveText('Pin menu');
  const route = (await button(page, 'New file').locator('.pending_route').textContent())!;
  await page.keyboard.type(route);
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Selected item')).toHaveText('New file');
  await page.keyboard.press('f'); await page.keyboard.press('o');
  await expect(page.getByLabel('Selected item')).toHaveText('Open file');
  await expect(stack(page)).toHaveText('root');
});

test('nested dropdowns mask their parent and Escape/Back return one frame at a time', async ({ page }) => {
  await page.keyboard.press('f'); await page.keyboard.press('m'); await page.keyboard.press('a');
  await expect(stack(page)).toHaveText('root → File → More → Advanced');
  await expect(button(page, 'New file')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(stack(page)).toHaveText('root → File → More');
  await expect(page.getByRole('button', { name: 'Advanced', exact: true })).toBeFocused();
  await page.getByRole('region', { name: 'More', exact: true }).getByRole('button', { name: /Back$/ }).click();
  await expect(stack(page)).toHaveText('root → File');
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  await page.keyboard.press('m'); await page.keyboard.press('c');
  await expect(stack(page)).toHaveText('root → File');
  await expect(page.getByLabel('Selected item')).toHaveText('Copy');
  await page.keyboard.press('Escape');
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByRole('button', { name: 'File', exact: true })).toBeFocused();
});

test('custom content inherits the frame and can extend the list or embed a nested editor', async ({ page }) => {
  await page.keyboard.press('f');
  await button(page, 'Custom action').click();
  await expect(page.getByLabel('Selected item')).toHaveText('Custom action');
  await expect(stack(page)).toHaveText('root');
  await page.keyboard.press('f'); await page.keyboard.press('u'); await page.keyboard.press('t');
  await expect(page.getByRole('textbox', { name: 'Menu notes', exact: true })).toBeFocused();
  await expect(stack(page)).toHaveText('root → File → Custom submenu → textbox');
  await page.keyboard.type('saved'); await page.keyboard.press('Escape');
  await expect(stack(page)).toHaveText('root → File → Custom submenu');
  await button(page, 'Close custom submenu').click();
  await expect(stack(page)).toHaveText('root → File');
});

test('API, binding, external stack pops and closing a parent synchronize open state once', async ({ page }) => {
  const open = page.getByRole('button', { name: 'Open through API' });
  await open.dispatchEvent('click'); await open.dispatchEvent('click');
  await expect(page.getByLabel('Menu sessions')).toHaveText('Entries: 1; exits: 0; selections: 0');
  await page.keyboard.press('m'); await page.keyboard.press('a');
  await page.getByRole('button', { name: 'Close through API' }).dispatchEvent('click');
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Open binding')).toHaveText('false');
  await page.getByRole('button', { name: 'Toggle binding' }).dispatchEvent('click');
  await expect(stack(page)).toHaveText('root → File');
  await page.getByRole('button', { name: 'Pop frame externally' }).dispatchEvent('click');
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Open binding')).toHaveText('false');
  await expect(page.getByLabel('Menu sessions')).toHaveText('Entries: 2; exits: 2; selections: 0');
});

test('arrow navigation skips disabled items and Home/End focus boundaries', async ({ page }) => {
  await page.keyboard.press('f');
  await expect(button(page, 'New file')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(button(page, 'Open file')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(button(page, 'Pin menu')).toBeFocused();
  await page.keyboard.press('End'); await expect(file(page).getByRole('button', { name: /Back$/ })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(button(page, 'New file')).toBeFocused();
  await page.keyboard.press('Home'); await expect(button(page, 'New file')).toBeFocused();
});

test('outside input closes the entire open dropdown tree without consuming the clicked action', async ({ page }) => {
  await page.keyboard.press('f'); await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Outside action', exact: true }).click();
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Selected item')).toHaveText('outside');
  await expect(page.getByLabel('Open binding')).toHaveText('false');
});

test('reactive triggers and item lists update without leaving stale bindings', async ({ page }) => {
  await page.keyboard.press('f');
  await page.getByLabel('Exit key').selectOption('F2');
  await page.keyboard.press('Escape'); await expect(stack(page)).toHaveText('root → File');
  await page.getByRole('button', { name: 'Remove item', exact: true }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Add item', exact: true }).dispatchEvent('click');
  await expect(button(page, 'Open file')).toHaveCount(0);
  await page.keyboard.press('o'); await expect(stack(page)).toHaveText('root → File');
  await page.keyboard.press('z'); await expect(page.getByLabel('Selected item')).toHaveText('Added item');
  await page.keyboard.press('f'); await page.keyboard.press('F2'); await expect(stack(page)).toHaveText('root');
  await page.getByLabel('Entry key').selectOption('none');
  await page.keyboard.press('f'); await expect(stack(page)).toHaveText('root');
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(stack(page)).toHaveText('root → File');
});

test('disabling or unmounting a parent unwinds all descendants and permits clean reuse', async ({ page }) => {
  await page.keyboard.press('f'); await page.keyboard.press('m');
  await page.getByLabel('Disable menu').check();
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByRole('button', { name: 'File', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open through API' }).click(); await expect(stack(page)).toHaveText('root');
  await page.getByLabel('Disable menu').uncheck();
  await page.keyboard.press('f'); await page.keyboard.press('u'); await page.keyboard.press('t');
  await page.getByLabel('Mount menu').uncheck();
  await expect(stack(page)).toHaveText('root');
  await page.getByLabel('Mount menu').check(); await page.getByRole('heading').click(); await page.keyboard.press('f');
  await expect(stack(page)).toHaveText('root → File');
});

test('external-only trigger UI can be hidden while the API and shortcut still own entry', async ({ page }) => {
  await page.getByLabel('Show trigger').uncheck();
  await expect(page.getByRole('button', { name: 'File', exact: true })).toHaveCount(0);
  await page.getByRole('heading').click();
  await page.keyboard.press('f'); await expect(stack(page)).toHaveText('root → File');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open through API' }).click(); await expect(stack(page)).toHaveText('root → File');
});

test('touch can open a dropdown, enter a submenu, and return to its parent', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 768, height: 1024 } });
  const page = await context.newPage(); await page.goto('/menus');
  await page.getByRole('button', { name: 'File', exact: true }).tap();
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await expect(stack(page)).toHaveText('root → File → More');
  await page.getByRole('region', { name: 'More', exact: true }).getByRole('button', { name: /Back$/ }).tap();
  await expect(stack(page)).toHaveText('root → File');
  await context.close();
});

test('an outside control can open another frame after the previous dropdown closes', async ({ page }) => {
  await page.keyboard.press('f'); await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Open tools externally' }).click();
  await expect(stack(page)).toHaveText('root → Tools');
  await expect(page.getByLabel('Open binding')).toHaveText('false');
});

test('programmatic disable/unmount while a descendant owns input disposes the entire subtree', async ({ page }) => {
  const setChecked = async (label: string, value: boolean) => {
    await page.getByLabel(label).evaluate((node: HTMLInputElement, checked) => {
      node.checked = checked; node.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  };
  await page.keyboard.press('f'); await page.keyboard.press('u'); await page.keyboard.press('t');
  await setChecked('Disable menu', true);
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Open binding')).toHaveText('false');
  await expect(page.getByLabel('Menu sessions')).toHaveText('Entries: 1; exits: 1; selections: 0');
  await setChecked('Disable menu', false);
  await page.getByRole('heading').click();
  await page.keyboard.press('f'); await page.keyboard.press('u'); await page.keyboard.press('t');
  await setChecked('Mount menu', false);
  await expect(stack(page)).toHaveText('root');
  await expect(page.getByLabel('Menu sessions')).toHaveText('Entries: 2; exits: 2; selections: 0');
  await setChecked('Mount menu', true);
  await page.getByRole('heading').click(); await page.keyboard.press('f');
  await expect(stack(page)).toHaveText('root → File');
});

test('initial open state activates one owned frame and nullable exit still provides Back', async ({ page }) => {
  await page.goto('/menus?open');
  await expect(stack(page)).toHaveText('root → File');
  await expect(page.getByLabel('Menu sessions')).toHaveText('Entries: 1; exits: 0; selections: 0');
  await page.getByLabel('Exit key').selectOption({ label: 'Back button only' });
  await page.keyboard.press('Escape');
  await expect(stack(page)).toHaveText('root → File');
  await file(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(stack(page)).toHaveText('root');
});

test('close policies can retain a dropdown and are inherited by nested lists', async ({ page }) => {
  await page.getByLabel('Close on select').uncheck();
  await page.getByLabel('Close on outside').uncheck();
  await page.getByRole('heading').click();
  await page.keyboard.press('f');
  await page.getByRole('button', { name: 'Outside action', exact: true }).click();
  await expect(stack(page)).toHaveText('root → File');
  await page.keyboard.press('m'); await page.keyboard.press('c');
  await expect(page.getByLabel('Selected item')).toHaveText('Copy');
  await expect(stack(page)).toHaveText('root → File → More');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(stack(page)).toHaveText('root');
});
