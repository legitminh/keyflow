import { test, expect, type Page } from '@playwright/test';

async function flick(page: Page, key: string, side: 'up' | 'down' | 'left' | 'right' | 'tap', returnInside = false) {
  const button = page.locator('.keyboard-dock').getByRole('button', { name: key, exact: true });
  const box = (await button.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = { ...center };
  if (side === 'up') end.y = box.y - 4;
  if (side === 'down') end.y = box.y + box.height + 4;
  if (side === 'left') end.x = box.x - 4;
  if (side === 'right') end.x = box.x + box.width + 4;
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  if (side !== 'tap') await expect(button).toHaveAttribute('data-flick', side);
  if (returnInside) await page.mouse.move(center.x, center.y);
  await page.mouse.up();
}

test('release position selects each direction exactly once; returning inside selects the center', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Text playground (virtual keys type here)').check();
  for (const [key, side, expected] of [
    ['q', 'up', '1'], ['q', 'down', 'Q'], ['b', 'left', '['], ['b', 'right', ']'],
    ['c', 'left', '{'], ['c', 'right', '}'], ['escape', 'up', '~'], ['escape', 'down', '`'], ['escape', 'right', 'tab'], [',', 'left', '<'], [',', 'right', '>'],
    ['space', 'up', 'arrowup'], ['space', 'down', 'arrowdown'],
    ['space', 'left', 'arrowleft'], ['space', 'right', 'arrowright'], ['q', 'tap', 'q']
  ] as const) {
    await flick(page, key, side);
    await expect(page.getByLabel('Last virtual key')).toHaveText(`Last key: ${expected}`);
  }
  await expect(page.getByLabel('Custom text output')).toHaveText('1Q[]{}~`<>q');
  await flick(page, 'q', 'up', true);
  await expect(page.getByLabel('Custom text output')).toHaveText('1Q[]{}~`<>qq');
  await flick(page, 'q', 'right'); // Removed mappings must not emit a character or a tap.
  await flick(page, '.', 'up');
  await expect(page.getByLabel('Custom text output')).toHaveText('1Q[]{}~`<>qq');
});

test('cancellation, capture loss and non-primary mouse buttons emit no input', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Text playground (virtual keys type here)').check();
  const q = page.locator('.keyboard-dock').getByRole('button', { name: 'q', exact: true });
  for (const cancel of ['pointercancel', 'lostpointercapture', 'blur']) {
    const box = (await q.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    if (cancel === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else await q.evaluate((element, type) => {
      element.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true }));
    }, cancel);
    await page.mouse.up();
    await expect(page.getByLabel('Last virtual key')).toHaveText('Last key: none');
  }
  await q.click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Custom text output')).toHaveText('(empty)');
});

test('native keyboard activation and Alt+arrow provide accessible flick input', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Text playground (virtual keys type here)').check();
  const q = page.locator('.keyboard-dock').getByRole('button', { name: 'q', exact: true });
  await q.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+ArrowUp');
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.getByLabel('Custom text output')).toHaveText('q1Q');
});

test('all layouts are selectable from the frame menu and the dock remains the lower half', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  const dock = page.getByLabel('Persistent keyboard');
  const original = await dock.elementHandle();
  for (const [label, count] of [
    ['Alphabet', 26], ['Alphanumeric', 36], ['60% keyboard', 61], ['Ortholinear keyboard', 48],
    ['16-key keyboard', 16], ['32-key keyboard', 32], ['Mixed flick + regular', 26], ['Flick alpha keyboard', 30]
  ] as const) {
    await page.getByRole('button', { name: 'Choose keyboard', exact: true }).click();
    await page.getByRole('region', { name: 'Keyboard menu' }).getByRole('button', { name: new RegExp(`${label.replace(/[+]/g, '\\+')}( · selected)?$`) }).click();
    const keyboard = dock.getByRole('region', { name: label, exact: true });
    await expect(keyboard.locator('.keyflow-key')).toHaveCount(count);
    if (label === 'Mixed flick + regular') await expect(keyboard.locator('.keyflow-flick-key')).toHaveCount(4);
    const box = (await dock.boundingBox())!;
    expect(box.y).toBe(384); expect(box.height).toBe(384);
    expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('tablet-flick.png') });
  await page.setViewportSize({ width: 430, height: 900 });
  const box = (await dock.boundingBox())!;
  expect(box.y).toBe(450); expect(box.height).toBe(450);
  await expect(page.locator('.keyflow')).toHaveCount(1);
  const main = (await page.locator('main').boundingBox())!;
  expect(main.y).toBe(0); expect(main.height).toBe(450);
  // Reload before the portrait capture so Chrome's screenshot surface is repainted after resizing.
  await page.reload();
  await expect(dock.getByRole('region', { name: 'Flick alpha keyboard', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('phone-flick.png') });
});

test('real touch dragging releases beyond the key border and does not tap the underlying key', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Text playground (virtual keys type here)').check();
  const key = page.locator('.keyboard-dock').getByRole('button', { name: 'q', exact: true });
  const box = (await key.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: box.y - 15 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByLabel('Custom text output')).toHaveText('1');
  await expect(page.getByLabel('Last virtual key')).toHaveText('Last key: 1');
  await context.close();
});

test('mixed layouts keep regular taps, customizable flicks and unmapped-direction cancellation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose keyboard', exact: true }).click();
  await page.getByRole('region', { name: 'Keyboard menu' }).getByRole('button', { name: /Mixed flick \+ regular/ }).click();
  await page.getByLabel('Text playground (virtual keys type here)').check();
  await flick(page, 'q', 'down'); // Mixed sample defines only up.
  await expect(page.getByLabel('Last virtual key')).toHaveText('Last key: none');
  await flick(page, 'q', 'up');
  await page.locator('.keyboard-dock').getByRole('button', { name: 'a', exact: true }).click();
  await expect(page.getByLabel('Custom text output')).toHaveText('1a');
  // Unmount the gesture's source while held: releasing must not send a stray input.
  const q = page.locator('.keyboard-dock').getByRole('button', { name: 'q', exact: true });
  const box = (await q.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.getByRole('button', { name: 'Choose keyboard', exact: true }).evaluate((element) => (element as HTMLButtonElement).click());
  await page.getByRole('region', { name: 'Keyboard menu' }).getByRole('button', { name: /Alphabet$/ }).evaluate((element) => (element as HTMLButtonElement).click());
  await page.mouse.up();
  await expect(page.getByLabel('Last virtual key')).toHaveText('Last key: a');
  await expect(page.getByLabel('Custom text output')).toHaveText('1a');
});


test('capital flick hints emit uppercase text and still match case-insensitive shortcuts', async ({ page }) => {
  await page.goto('/');
  const a = page.locator('.keyboard-dock').getByRole('button', { name: 'a', exact: true });
  await expect(a.locator('.hint.down')).toHaveText('A');
  await flick(page, 'a', 'down');
  await expect(page.getByLabel('Last virtual key')).toHaveText('Last key: A');
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 1');
});
