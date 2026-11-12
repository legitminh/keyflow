import { test, expect, type Page } from '@playwright/test';

const field = (page: Page) => page.getByRole('textbox', { name: 'Keyboard text editor', exact: true });
const tools = (page: Page) => page.getByRole('toolbar', { name: 'Keyboard text editor editing tools' });
const key = (page: Page, name: string) => page.locator('.keyboard-dock').getByRole('button', { name, exact: true });
async function flick(page: Page, name: string, side: 'up' | 'down' | 'left' | 'right') {
  const box = (await key(page, name).boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(side === 'left' ? box.x - 4 : side === 'right' ? box.x + box.width + 4 : x,
    side === 'up' ? box.y - 4 : side === 'down' ? box.y + box.height + 4 : y, { steps: 3 });
  await page.mouse.up();
}
async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard text editor', exact: true }).click();
  await expect(field(page)).toBeFocused();
}

test('entry trigger/click pushes an editing frame; blur does not exit; Escape preserves text', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('t');
  await expect(field(page)).toBeFocused();
  await expect(page.getByLabel('Frame stack')).toHaveText('root → textbox');
  await expect(page.getByRole('button', { name: /Page A/ })).toBeDisabled();
  await page.keyboard.type('a\ne');
  await page.keyboard.insertText('日本語 👩‍💻');
  await expect(field(page)).toHaveValue('a\ne日本語 👩‍💻');
  await page.getByRole('heading', { name: 'Keyflow · touch & flick' }).click();
  await expect(field(page)).toBeFocused();
  await expect(page.getByLabel('Frame stack')).toHaveText('root → textbox');
  await key(page, 'escape').click();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
  await expect(page.getByRole('button', { name: 'Keyboard text editor', exact: true })).toContainText('a\ne日本語 👩‍💻');
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 0');
  await page.getByRole('button', { name: 'Keyboard text editor', exact: true }).click();
  await expect(field(page)).toHaveValue('a\ne日本語 👩‍💻');
});

test('virtual arrows, Shift selection, Unicode-aware backspace, Tab and Enter edit the real selection', async ({ page }) => {
  await enter(page);
  await field(page).fill('ab');
  await tools(page).getByRole('button', { name: 'Shift', exact: true }).click();
  await flick(page, 'space', 'left');
  await expect.poll(() => field(page).evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([1, 2]);
  await key(page, 'q').click();
  await expect(field(page)).toHaveValue('aQ');
  await expect(tools(page).getByRole('button', { name: 'Shift', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await tools(page).getByRole('button', { name: 'Enter', exact: true }).click();
  await flick(page, 'escape', 'right');
  await expect(field(page)).toHaveValue('aQ\n\t');
  await field(page).fill('x👨‍👩‍👧‍👦e\u0301y');
  await field(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length - 1, el.value.length - 1));
  await flick(page, 'escape', 'left');
  await expect(field(page)).toHaveValue('x👨‍👩‍👧‍👦y');
  await flick(page, 'escape', 'left');
  await expect(field(page)).toHaveValue('xy');
  await field(page).fill('ab\ncde\nx');
  await field(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(2, 2));
  await flick(page, 'space', 'down');
  await expect.poll(() => field(page).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(5);
  await key(page, 'q').click();
  await expect(field(page)).toHaveValue('ab\ncdqe\nx');
  await flick(page, 'space', 'up');
  await expect.poll(() => field(page).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(2);
});

test('native Shift and mouse selection are shared with virtual editing', async ({ page }) => {
  await enter(page);
  await field(page).fill('hello');
  await page.keyboard.down('Shift');
  await flick(page, 'space', 'left');
  await page.keyboard.up('Shift');
  await key(page, 'a').click();
  await expect(field(page)).toHaveValue('hella');
  await field(page).fill('hello world');
  await field(page).dblclick({ position: { x: 20, y: 15 } });
  const selection = await field(page).evaluate((el: HTMLTextAreaElement) => ({ value: el.value, start: el.selectionStart, end: el.selectionEnd }));
  expect(selection.end).toBeGreaterThan(selection.start);
  await key(page, 'b').click();
  await expect(field(page)).toHaveValue(selection.value.slice(0, selection.start) + 'b' + selection.value.slice(selection.end));
});

test('copy/cut/paste controls preserve selection and share undo/redo with native typing', async ({ page }) => {
  await page.addInitScript(() => {
    let clipboard = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: async () => clipboard,
      writeText: async (value: string) => { clipboard = value; }
    } });
  });
  await enter(page);
  await field(page).fill('hello😀');
  await field(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 7));
  await tools(page).getByRole('button', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('😀');
  await tools(page).getByRole('button', { name: 'Cut', exact: true }).click();
  await expect(field(page)).toHaveValue('hello');
  await tools(page).getByRole('button', { name: 'Paste', exact: true }).click();
  await expect(field(page)).toHaveValue('hello😀');
  await tools(page).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(field(page)).toHaveValue('hello');
  await tools(page).getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(field(page)).toHaveValue('hello😀');
  await page.keyboard.press('Control+z');
  await expect(field(page)).toHaveValue('hello');
  await page.keyboard.press('Control+Shift+z');
  await expect(field(page)).toHaveValue('hello😀');
  await page.keyboard.type('!');
  await tools(page).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(field(page)).toHaveValue('hello😀');
});

test('custom entry and exit sequences differ; Escape does not exit the custom editor', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Custom entry/exit trigger example', { exact: true }).click();
  const primary = await page.evaluate(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform + navigator.userAgent) ? 'Meta' : 'Control');
  await page.keyboard.press(`${primary}+k`);
  const custom = page.getByRole('textbox', { name: 'Command text editor', exact: true });
  await expect(custom).toBeFocused();
  await page.keyboard.type('custom\ntext');
  await page.keyboard.press('Escape');
  await expect(custom).toBeFocused();
  await expect(custom).toHaveValue('custom\ntext');
  await page.keyboard.press(`${primary}+Enter`);
  await expect(custom).toBeHidden();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
});

test('editing survives keyboard selection in a child frame', async ({ page }) => {
  await enter(page);
  await page.keyboard.type('kept');
  await page.getByRole('button', { name: 'Choose keyboard', exact: true }).click();
  await expect(page.getByLabel('Frame stack')).toHaveText('root → textbox → keyboard-menu');
  await page.getByRole('region', { name: 'Keyboard menu' }).getByRole('button', { name: /60% keyboard/ }).click();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('kept');
  await key(page, 'enter').click();
  await key(page, 'a').click();
  await expect(field(page)).toHaveValue('kept\na');
  await key(page, 'escape').click();
  await expect(page.getByLabel('Frame stack')).toHaveText('root');
});

test('composition input and emoji remain native; composing Escape does not exit', async ({ page }) => {
  await enter(page);
  await field(page).evaluate((el: HTMLTextAreaElement) => {
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    el.value = '日本語';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: '日本語', inputType: 'insertCompositionText', isComposing: true }));
    for (const type of ['keydown', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true, isComposing: true }));
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本語' }));
    el.setSelectionRange(el.value.length, el.value.length);
  });
  await expect(field(page)).toBeFocused();
  await page.keyboard.insertText(' 👩🏽‍💻');
  await expect(field(page)).toHaveValue('日本語 👩🏽‍💻');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Keyboard text editor', exact: true })).toContainText('日本語 👩🏽‍💻');
});

test('pending clipboard reads cannot edit a later session; failed reads keep editing active', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: () => new Promise<string>((resolve) => {
        (window as Window & { finishPaste?: (text: string) => void }).finishPaste = resolve;
      })
    } });
  });
  await enter(page);
  await tools(page).getByRole('button', { name: 'Paste', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keyboard text editor', exact: true }).click();
  await page.evaluate(async () => {
    (window as Window & { finishPaste?: (text: string) => void }).finishPaste?.('late data');
    await Promise.resolve();
  });
  await expect(field(page)).toHaveValue('');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: async () => { throw new Error('Denied in test'); }
    } });
  });
  await tools(page).getByRole('button', { name: 'Paste', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Clipboard access failed');
  await expect(field(page)).toBeFocused();
});

test('physical typing resumes in the editor after native activation of a virtual key', async ({ page }) => {
  await enter(page);
  await key(page, 'q').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ab');
  await expect(field(page)).toHaveValue('qAb');
  await expect(field(page)).toBeFocused();
});

test('virtual edits honor native readonly/maxlength constraints', async ({ page }) => {
  await enter(page);
  await field(page).fill('ab');
  await field(page).evaluate((el: HTMLTextAreaElement) => { el.maxLength = 3; });
  await key(page, 'c').click();
  await key(page, 'd').click();
  await expect(field(page)).toHaveValue('abc');
  await field(page).evaluate((el: HTMLTextAreaElement) => { el.readOnly = true; });
  await flick(page, 'escape', 'left');
  await tools(page).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(field(page)).toHaveValue('abc');
});

test('tablet editor remains above the persistent keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await enter(page);
  await page.keyboard.insertText('Selection, Unicode: 日本語 👩🏽‍💻\nPhysical and virtual keys share this editor.');
  const box = (await field(page).boundingBox())!;
  const dock = (await page.getByLabel('Persistent keyboard').boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
  await page.screenshot({ path: testInfo.outputPath('tablet-editor.png') });
});
