import { test, expect, type Page } from '@playwright/test';

type Interaction = { control: string; phase: string; kind: string; source: string; duration_ms: number; cancelled: boolean; reason: string; key?: string };
const events = async (page: Page, control: string, kind = 'press'): Promise<Interaction[]> =>
  JSON.parse((await page.getByLabel('Interaction events').textContent())!).filter((e: Interaction) => e.control === control && e.kind === kind);
const clear = async (page: Page) => { await page.getByRole('button', { name: 'Clear events', exact: true }).click(); };

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => { expect(errors).toEqual([]); });

test('pointer press, hover, focus and keyboard activation have independent paired durations', async ({ page }) => {
  await page.goto('/interactions');
  const button = page.getByRole('button', { name: /Automatic action$/ });
  await button.hover();
  await page.mouse.down();
  await expect.poll(async () => (await events(page, 'automatic')).length).toBe(1);
  // A real held input must report its elapsed time, rather than the 180ms display flash.
  await page.waitForTimeout(70);
  await page.mouse.up();
  await expect(page.getByLabel('Actions', { exact: true })).toHaveText('1');
  const press = await events(page, 'automatic');
  expect(press.map((e) => e.phase)).toEqual(['enter', 'exit']);
  expect(press[1].duration_ms).toBeGreaterThanOrEqual(60);
  expect(press[1].cancelled).toBe(false);
  await page.mouse.move(0, 0);
  expect((await events(page, 'automatic', 'cursor')).map((e) => e.phase)).toEqual(['enter', 'exit']);
  await clear(page);
  await button.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(60);
  await page.keyboard.up('Space');
  await expect(page.getByLabel('Actions', { exact: true })).toHaveText('2');
  expect((await events(page, 'automatic')).map((e) => e.phase)).toEqual(['enter', 'exit']);
  expect((await events(page, 'automatic'))[1].duration_ms).toBeGreaterThanOrEqual(50);
  await page.getByRole('button', { name: 'Clear events', exact: true }).focus();
  expect((await events(page, 'automatic', 'focus')).map((e) => e.phase)).toEqual(['enter', 'exit']);
  await clear(page);
  await button.focus();
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  expect((await events(page, 'automatic')).map((e) => e.phase)).toEqual(['enter', 'exit']);
});

test('routed automatic and static keys enter on down and exit on up exactly once', async ({ page }) => {
  await page.goto('/interactions');
  for (const [name, control, key] of [
    ['Automatic action', 'automatic', null], ['Static action', 'static', 'z']
  ] as const) {
    await clear(page);
    const route = key ?? (await page.getByRole('button', { name: new RegExp(`${name}$`) }).locator('.pending_route').textContent())!;
    await page.keyboard.down(route);
    await expect.poll(async () => (await events(page, control)).length).toBe(1);
    await page.keyboard.up(route);
    await expect.poll(async () => (await events(page, control)).length).toBe(2);
    expect((await events(page, control))[1].cancelled).toBe(false);
  }
  await expect(page.getByLabel('Actions', { exact: true })).toHaveText('2');
});

test('every button wrapper forwards lifecycle handlers, including callback-only controls', async ({ page }) => {
  await page.goto('/interactions');
  for (const [name, control] of [
    ['Positional action', 'positional'], ['Hover action', 'hover'], ['Hover positional action', 'hover-positional'],
    ['Custom action', 'interactable'], ['Custom positional action', 'interactable-positional'], ['Custom static action', 'static-interactable']
  ]) {
    await page.getByRole('button', { name: new RegExp(`${name}$`) }).click();
    expect((await events(page, control)).map((e) => e.phase)).toEqual(['enter', 'exit']);
  }
});

test('keyboard defaults, per-key overrides and flick gesture durations work with custom adapters', async ({ page }) => {
  await page.goto('/interactions');
  for (const [key, control] of [['a', 'keyboard'], ['b', 'per-key'], ['c', 'flick']]) {
    const button = page.getByRole('button', { name: key, exact: true });
    await button.hover();
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    const press = await events(page, control);
    expect(press.map((e) => e.phase)).toEqual(['enter', 'exit']);
    expect(press[1].duration_ms).toBeGreaterThanOrEqual(50);
    expect(press[0].key).toBe(key);
    expect(press[1].cancelled).toBe(false);
  }
  expect((await events(page, 'keyboard')).length).toBe(2);
});

test('custom actions cancel outside releases, disabled sessions, blur and unmount cleanly', async ({ page }) => {
  await page.goto('/interactions');
  const button = page.getByRole('button', { name: 'Native custom action', exact: true });
  await button.hover(); await page.mouse.down();
  await page.mouse.move(0, 0); await page.mouse.up();
  expect((await events(page, 'custom'))[1].cancelled).toBe(true);
  await clear(page);
  await button.hover(); await page.mouse.down();
  await page.getByRole('button', { name: 'Toggle disabled' }).dispatchEvent('click');
  await page.mouse.up();
  await expect.poll(async () => (await events(page, 'custom')).length).toBe(2);
  expect((await events(page, 'custom'))[1].reason).toBe('disabled');
  await clear(page);
  await page.getByRole('button', { name: 'Toggle disabled' }).click();
  await button.hover(); await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  expect((await events(page, 'custom'))[1].reason).toBe('reset');
  await clear(page);
  await button.hover(); await page.mouse.down();
  await page.getByRole('button', { name: 'Toggle controls' }).dispatchEvent('click');
  await page.mouse.up();
  await expect.poll(async () => (await events(page, 'custom')).length).toBe(2);
  expect((await events(page, 'custom'))[1].reason).toBe('unmounted');
});

test('frame switches cancel routed presses and do not replay their release in the next frame', async ({ page }) => {
  await page.goto('/interactions');
  const button = page.getByRole('button', { name: /Automatic action$/ });
  const key = (await button.locator('.pending_route').textContent())!;
  await page.keyboard.down(key);
  await page.getByRole('button', { name: 'Change frame' }).dispatchEvent('click');
  await page.keyboard.up(key);
  await expect.poll(async () => (await events(page, 'automatic')).length).toBe(2);
  expect((await events(page, 'automatic'))[1].reason).toBe('frame-change');
  await expect(page.getByLabel('Actions', { exact: true })).toHaveText('0');
});

for (const key of ['a', 'c']) {
  for (const input of ['Enter', 'Space', 'accessibility']) {
    test(`${key} key has one lifecycle for ${input} activation`, async ({ page }) => {
      await page.goto('/interactions');
      const button = page.getByRole('button', { name: key, exact: true });
      const control = key === 'c' ? 'flick' : 'keyboard';
      await button.focus();
      if (input === 'accessibility') await button.dispatchEvent('click', { detail: 0 });
      else {
        await page.keyboard.down(input);
        await page.waitForTimeout(60);
        await page.keyboard.up(input);
      }
      const result = await events(page, control);
      expect(result.map((event) => event.phase)).toEqual(['enter', 'exit']);
      if (input !== 'accessibility') expect(result[1].duration_ms).toBeGreaterThanOrEqual(50);
    });
  }
}

test('synchronous blur and refocus end the old focus session before starting another', async ({ page }) => {
  await page.goto('/interactions');
  const button = page.getByRole('button', { name: 'Native custom action', exact: true });
  await button.focus();
  await button.evaluate((node: HTMLButtonElement) => { node.blur(); node.focus(); });
  expect((await events(page, 'custom', 'focus')).map((event) => event.phase)).toEqual(['enter', 'exit', 'enter']);
});

test('native keyboard focus/activation does not invoke cursor callbacks', async ({ page }) => {
  await page.goto('/interactions');
  const key = page.getByRole('button', { name: 'a', exact: true });
  await key.focus(); await page.keyboard.press('Space');
  expect(await events(page, 'keyboard', 'cursor')).toEqual([]);
  expect((await events(page, 'keyboard')).map((event) => event.phase)).toEqual(['enter', 'exit']);
});

test('real touch contacts enter/exit keys while dragging under implicit pointer capture', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 768, height: 1024 } });
  const page = await context.newPage(); await page.goto('/interactions');
  await page.getByRole('button', { name: 'a', exact: true }).scrollIntoViewIfNeeded();
  const a = (await page.getByRole('button', { name: 'a', exact: true }).boundingBox())!;
  const b = (await page.getByRole('button', { name: 'b', exact: true }).boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await events(page, 'keyboard', 'cursor')).map((event) => event.phase)).toEqual(['enter', 'exit']);
  expect((await events(page, 'per-key', 'cursor')).map((event) => event.phase)).toEqual(['enter', 'exit']);
  expect((await events(page, 'keyboard'))[1].cancelled).toBe(true);
  expect(await events(page, 'per-key')).toEqual([]);
  const raw = JSON.parse((await page.getByLabel('Interaction events').textContent())!);
  expect(raw.filter((event: { kind: string }) => event.kind === 'cursor').every((event: { pointer_type: string }) => event.pointer_type === 'touch')).toBe(true);
  await context.close();
});

test('a cancelled touch ends both press and cursor exactly once', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 768, height: 1024 } });
  const page = await context.newPage(); await page.goto('/interactions');
  await page.getByRole('button', { name: 'a', exact: true }).scrollIntoViewIfNeeded();
  const a = (await page.getByRole('button', { name: 'a', exact: true }).boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  for (const kind of ['press', 'cursor']) {
    const result = await events(page, 'keyboard', kind);
    expect(result.map((event) => event.phase)).toEqual(['enter', 'exit']);
    expect(result[1].cancelled).toBe(true);
  }
  await context.close();
});
