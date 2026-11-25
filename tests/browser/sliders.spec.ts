import { test, expect, type Page, type Locator } from '@playwright/test';

const slider = (page: Page, name = 'Horizontal hover') => page.getByRole('slider', { name, exact: true });
const value = async (control: Locator) => Number(await control.getAttribute('aria-valuenow'));
async function freeze(page: Page) {
  await page.clock.install({ time: new Date('2026-11-14T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-14T12:00:01Z'));
}

test('hover controls show arrow bindings, move during holds, and stop on release without a second step', async ({ page }, testInfo) => {
  await page.goto('/sliders');
  const range = slider(page);
  const increase = page.getByRole('button', { name: 'Increase Horizontal hover', exact: true });
  await expect(range).toHaveAttribute('aria-valuenow', '50');
  await expect(increase.locator('.pending_route')).toHaveText('→');
  await expect(increase.locator('.route')).toBeHidden();
  await increase.hover();
  await expect(increase.locator('.route')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('sliders.png') });
  await freeze(page);
  await page.keyboard.down('ArrowRight');
  await expect(range).toHaveAttribute('aria-valuenow', '51');
  await page.clock.runFor(500);
  expect(await value(range)).toBeGreaterThanOrEqual(69);
  await page.keyboard.up('ArrowRight');
  const released = await value(range);
  await page.clock.runFor(500);
  expect(await value(range)).toBe(released);
  await page.keyboard.press('ArrowLeft');
  expect(await value(range)).toBe(released - 1);
  await increase.focus();
  await page.keyboard.down(' ');
  await page.clock.runFor(150);
  expect(await value(range)).toBeGreaterThan(released);
  await page.keyboard.up(' ');
  const nativeReleased = await value(range);
  await page.clock.runFor(250);
  expect(await value(range)).toBe(nativeReleased);
});

test('positional multi-key controls start at terminal keydown and custom interactables compose with core', async ({ page }) => {
  await page.goto('/sliders');
  const increase = page.getByRole('button', { name: /Increase Horizontal positional$/ });
  const route = (await increase.locator('.pending_route').textContent())!;
  expect(route.length).toBeGreaterThan(1);
  await freeze(page);
  await page.keyboard.type(route.slice(0, -1));
  await expect(slider(page, 'Horizontal positional')).toHaveAttribute('aria-valuenow', '50');
  await page.keyboard.down(route.at(-1)!);
  await page.clock.runFor(250);
  expect(await value(slider(page, 'Horizontal positional'))).toBeGreaterThan(55);
  await page.keyboard.up(route.at(-1)!);
  const stopped = await value(slider(page, 'Horizontal positional'));
  await page.clock.runFor(250);
  expect(await value(slider(page, 'Horizontal positional'))).toBe(stopped);
  const verticalUp = page.getByRole('button', { name: /Increase Vertical positional$/ });
  const verticalRoute = (await verticalUp.locator('.pending_route').textContent())!;
  await page.keyboard.type(verticalRoute);
  await expect(slider(page, 'Vertical positional')).toHaveAttribute('aria-valuenow', '51');
  await page.getByRole('button', { name: 'Custom increase', exact: true }).click();
  await expect(slider(page, 'Custom core')).toHaveAttribute('aria-valuenow', '50.5');
});

test('persistent sliders keep page-position shortcuts while offscreen; bounded text auto-scrolls past its limit', async ({ page }) => {
  await page.goto('/sliders');
  const increase = page.getByRole('button', { name: /Increase Horizontal persistent$/ });
  const route = (await increase.locator('.pending_route').textContent())!;
  expect(route.length).toBeGreaterThan(0);
  // Scroll the control out of view: its shortcut stays registered.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.keyboard.type(route);
  await expect(slider(page, 'Horizontal persistent')).toHaveAttribute('aria-valuenow', '51');
  const title = page.locator('.keyflow-bounded-text').first();
  const metrics = await title.evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth, chars: parseFloat(getComputedStyle(node).maxWidth) / parseFloat(getComputedStyle(node).fontSize) }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  // No scrollbar or scroll zone: the content scrolls itself in a loop that rests at its start.
  expect(await title.evaluate((node) => getComputedStyle(node).overflowX)).toBe('hidden');
  await expect(title).not.toHaveAttribute('tabindex', /.*/);
  await expect(title).toHaveAttribute('title', 'a-very-long-file-name-that-scrolls.visual');
  await expect(title.locator('.keyflow-bounded-text-copy')).toHaveAttribute('aria-hidden', 'true');
  const loop = await title.locator('.keyflow-bounded-text-track').evaluate((node) => {
    const [animation] = node.getAnimations();
    const timing = animation?.effect?.getComputedTiming();
    const frames = (animation?.effect as KeyframeEffect | undefined)?.getKeyframes() ?? [];
    return { iterations: timing?.iterations, playState: animation?.playState, rest: frames[1]?.offset, end: frames.at(-1)?.transform };
  });
  expect(loop.iterations).toBe(Infinity);
  expect(loop.playState).toBe('running');
  expect(loop.rest).toBeGreaterThan(0);
  expect(loop.end).toMatch(/^translateX\(-\d/);
});

test('preset control snippets receive the core controller, snap API writes, and respect disabled gating', async ({ page }) => {
  await page.goto('/sliders');
  const range = slider(page, 'Snippet controls');
  await expect(page.getByRole('button', { name: /Decrease Snippet controls$/ })).toHaveCount(0);
  await page.keyboard.press('u');
  await expect(range).toHaveAttribute('aria-valuenow', '-0.1');
  await page.keyboard.press('i');
  await expect(range).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Set snippet maximum', exact: true }).click();
  await expect(range).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('u');
  await expect(range).toHaveAttribute('aria-valuenow', '0.9');
  await page.getByLabel('Disable sliders').check();
  // This custom native button remains enabled; the controller enforces the gate.
  await page.getByRole('button', { name: 'Set snippet maximum', exact: true }).click();
  await expect(range).toHaveAttribute('aria-valuenow', '0.9');
});

test('pointer dragging clamps both axes, vertical uses up as increase, and pointer-held controls repeat', async ({ page }) => {
  await page.goto('/sliders');
  const horizontal = slider(page);
  const rect = (await horizontal.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 1.5, rect.y);
  await expect(horizontal).toHaveAttribute('aria-valuenow', '100');
  await page.mouse.move(rect.x - rect.width, rect.y);
  await expect(horizontal).toHaveAttribute('aria-valuenow', '0');
  await page.mouse.up();
  const vertical = slider(page, 'Vertical hover');
  await vertical.scrollIntoViewIfNeeded();
  const visible = (await vertical.boundingBox())!;
  await page.mouse.move(visible.x + visible.width / 2, visible.y + visible.height - 1);
  await page.mouse.down();
  await page.mouse.move(visible.x + visible.width / 2, visible.y);
  await page.mouse.up();
  await expect(vertical).toHaveAttribute('aria-valuenow', '100');
  await freeze(page);
  const down = page.getByRole('button', { name: 'Decrease Vertical hover', exact: true });
  await down.hover();
  await page.mouse.down();
  await page.clock.runFor(300);
  expect(await value(vertical)).toBeLessThan(90);
  await page.mouse.up();
  const released = await value(vertical);
  await page.clock.runFor(300);
  expect(await value(vertical)).toBe(released);
  await page.keyboard.press('ArrowUp');
  expect(await value(vertical)).toBe(released + 1);
});

test('disabled state, binding changes, frame changes, blur and unmount cancel held motion', async ({ page }) => {
  await page.goto('/sliders');
  await freeze(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(150);
  // Avoid focus changes: cancellation must come from disabled/frame/binding state itself.
  await page.getByLabel('Disable sliders').evaluate((node) => (node as HTMLInputElement).click());
  await expect(slider(page)).toHaveAttribute('aria-disabled', 'true');
  const disabledValue = await value(slider(page));
  await page.clock.runFor(300);
  await page.keyboard.up('ArrowRight');
  expect(await value(slider(page))).toBe(disabledValue);
  await page.getByLabel('Disable sliders').evaluate((node) => (node as HTMLInputElement).click());
  expect(await value(slider(page))).toBe(disabledValue);
  await page.getByLabel('Use J/K instead of left/right').check();
  expect(await value(slider(page))).toBe(disabledValue);
  await page.getByRole('heading', { level: 1 }).click();
  expect(await value(slider(page))).toBe(disabledValue);
  await page.keyboard.press('ArrowRight');
  expect(await value(slider(page))).toBe(disabledValue);
  await page.keyboard.down('k');
  await page.clock.runFor(150);
  expect(await value(slider(page))).toBeGreaterThan(disabledValue);
  await page.getByRole('button', { name: 'Open child frame', exact: true }).dispatchEvent('click');
  await expect(slider(page)).toHaveAttribute('aria-disabled', 'true');
  const maskedValue = await value(slider(page));
  await page.clock.runFor(300);
  await page.keyboard.up('k');
  expect(await value(slider(page))).toBe(maskedValue);
  await page.keyboard.press('Escape');
  await expect(slider(page)).toHaveAttribute('aria-disabled', 'false');
  await page.keyboard.down('k');
  await page.clock.runFor(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurValue = await value(slider(page));
  await page.clock.runFor(300);
  expect(await value(slider(page))).toBe(blurValue);
  await page.keyboard.up('k');
  await page.keyboard.down('k');
  await page.clock.runFor(100);
  await page.getByLabel('Mount sliders').uncheck();
  await page.clock.runFor(300);
  await page.keyboard.up('k');
  await expect(slider(page)).toHaveCount(0);
  await page.getByLabel('Mount sliders').check();
  const remountedValue = await value(slider(page));
  await page.clock.runFor(300);
  expect(await value(slider(page))).toBe(remountedValue);
});

test('rebinding cancels an in-flight shortcut, fractional motion accumulates, and SliderCore has no own shortcuts', async ({ page }) => {
  await page.goto('/sliders');
  await freeze(page);
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(150);
  await page.getByLabel('Use J/K instead of left/right').evaluate((node) => (node as HTMLInputElement).click());
  const reboundValue = await value(slider(page));
  await page.clock.runFor(300);
  expect(await value(slider(page))).toBe(reboundValue);
  await page.keyboard.up('ArrowRight');
  const custom = slider(page, 'Custom core');
  await custom.focus();
  await page.keyboard.press('ArrowRight');
  await expect(custom).toHaveAttribute('aria-valuenow', '50');
  const increase = page.getByRole('button', { name: 'Custom increase', exact: true });
  await increase.focus();
  await page.keyboard.down(' ');
  await page.clock.runFor(300);
  // At 20 units/second, each animation frame is smaller than the 0.5 step.
  expect(await value(custom)).toBeGreaterThanOrEqual(56);
  await page.keyboard.up(' ');
  const released = await value(custom);
  await page.clock.runFor(300);
  expect(await value(custom)).toBe(released);
});

test('real touch drags the core and pointer cancellation ends the drag', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 1000 } });
  const page = await context.newPage();
  await page.goto('/sliders');
  const range = slider(page);
  const box = (await range.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width, y }] });
  await expect(range).toHaveAttribute('aria-valuenow', '100');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(range).not.toHaveClass(/dragging/);
  await context.close();
});

test('buttons and virtual keys share stable hues; out-of-range controls have no highlight color', async ({ page }) => {
  // This fixture mounts 258 routed controls and exercises their offscreen layout.
  // Shared CI runners need more time than the small interaction fixtures.
  test.setTimeout(60_000);
  await page.goto('/sliders');
  await page.getByLabel('Show color samples').check();
  for (const [name, key] of [['Escape color', 'escape'], ['Latin color', 'é']]) {
    const button = page.getByRole('button', { name: new RegExp(`${name}$`) });
    const hue = await button.locator('.button').evaluate((node) => (node as HTMLElement).style.getPropertyValue('--shortcut-hue'));
    const keyColor = await page.getByRole('button', { name: key, exact: true }).evaluate((node) => (node as HTMLElement).style.getPropertyValue('--key-color'));
    expect(keyColor).toContain(`hsl(${hue} `);
  }
  for (const name of ['Outside color space', 'Color sample 256', 'Color sample 257']) {
    const button = page.getByRole('button', { name: new RegExp(`${name}$`) });
    await expect(button.locator('.content')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(button.locator('.content')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
});
