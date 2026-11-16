import { test, expect } from '@playwright/test';

test('shortcuts activate buttons and leave form input alone', async ({ page }) => {
  await page.goto('/flow');
  const counter = page.getByRole('button', { name: /count: 0/ });
  await counter.click({ trial: true }); // wait for layout and visibility-based shortcut registration
  await expect(counter.locator('.pending_route')).not.toBeEmpty();
  const shortcut = await counter.locator('.pending_route').innerText();
  await page.keyboard.type(shortcut);
  await expect(page.getByRole('button', { name: /count: 1/ })).toBeVisible();
  await page.getByLabel('Example input').fill(shortcut);
  await expect(page.getByRole('button', { name: /count: 1/ })).toBeVisible();
});

test('theme and zoom persist after reload', async ({ page }) => {
  await page.goto('/flow');
  await page.getByRole('button', { name: /dark$/ }).click();
  await page.getByRole('button', { name: /zoom in/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /light$/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--min-box'))
    )
    .toBe('60px');
});

test('paged scrolling, hash navigation, and native mode share the camera', async ({ page }) => {
  await page.goto('/flow');
  const world = page.locator('.world');
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => world.evaluate((node) => node.getBoundingClientRect().top))
    .toBeLessThan(-100);
  await page.goto('/flow#destination');
  await expect(page.getByRole('heading', { name: 'destination', exact: true })).toBeInViewport();
  await page.goto('/flow');
  await page.getByRole('button', { name: /toggle native scrolling/ }).click();
  await expect(page.locator('.viewport')).toHaveClass(/native-scroll/);
  const down = page.getByRole('button', { name: /↓$/ });
  const up = page.getByRole('button', { name: /↑$/ });
  await expect(down).toBeVisible();
  await expect(up).toBeVisible();
  const downShortcut = await down.locator('.pending_route').innerText();
  const upShortcut = await up.locator('.pending_route').innerText();
  await page.keyboard.type(downShortcut);
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  const firstPage = await page.locator('.viewport').evaluate(node => node.scrollTop);
  await page.keyboard.type(upShortcut);
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeLessThan(firstPage);
  await page.keyboard.type(upShortcut.repeat(2));
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBe(0);
  await down.click();
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await up.click();
  await up.click();
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBe(0);
  await page.locator('.viewport').hover();
  await page.mouse.wheel(0, 700);
  await expect
    .poll(() => page.locator('.viewport').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  // Keyboard paging starts from the current wheel position and remains available at the end.
  const wheelPosition = await page.locator('.viewport').evaluate(node => node.scrollTop);
  await page.keyboard.type(downShortcut);
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBeGreaterThan(wheelPosition);
  await expect(down).toBeVisible();
  await expect(up).toBeVisible();
});

test('native-mode paging animates through intermediate positions', async ({ page }) => {
  await page.goto('/flow');
  await page.getByRole('button', { name: /toggle native scrolling/ }).click();
  await expect(page.locator('.viewport')).toHaveClass(/native-scroll/);
  const samples = page.locator('.viewport').evaluate(node => new Promise<number[]>(resolve => {
    const positions: number[] = [];
    const sample = () => {
      positions.push(node.scrollTop);
      if (positions.length < 24) requestAnimationFrame(sample);
      else resolve(positions);
    };
    requestAnimationFrame(sample);
  }));
  await page.getByRole('button', { name: /↓$/ }).click();
  const positions = await samples;
  expect(new Set(positions.map(Math.round)).size).toBeGreaterThan(2);
  expect(positions.at(-1)).toBeGreaterThan(positions[0]);
  const shortcut = await page.getByRole('button', { name: /↑$/ }).locator('.pending_route').innerText();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.type(shortcut);
    await page.waitForTimeout(450); // let content-boundary paging settle before the next page
  }
  await expect.poll(() => page.locator('.viewport').evaluate(node => node.scrollTop)).toBe(0);
});


test('both pointer modes use the same smooth native paging and preserve position on toggle', async ({ page }) => {
  await page.goto('/flow');
  const viewport = page.locator('.viewport');
  const down = page.getByRole('button', { name: /↓$/ });
  const shortcut = await down.locator('.pending_route').innerText();
  const toggle = page.getByRole('button', { name: /toggle native scrolling/ });
  const samples = viewport.evaluate(node => new Promise<number[]>(resolve => {
    const positions: number[] = [];
    const sample = () => {
      positions.push(node.scrollTop);
      if (positions.length < 30) requestAnimationFrame(sample);
      else resolve(positions);
    };
    requestAnimationFrame(sample);
  }));
  await page.keyboard.type(shortcut);
  const positions = await samples;
  expect(new Set(positions.map(Math.round)).size).toBeGreaterThan(2);
  const before = await viewport.evaluate(node => node.scrollTop);
  expect(before).toBeGreaterThan(0);
  await expect(page.locator('.world')).toHaveCSS('transform', 'none');
  await page.keyboard.type(await toggle.locator('.pending_route').innerText());
  await expect(viewport).toHaveClass(/native-scroll/);
  expect(await viewport.evaluate(node => node.scrollTop)).toBeCloseTo(before, 0);
  await page.keyboard.type(await toggle.locator('.pending_route').innerText());
  await expect(viewport).not.toHaveClass(/native-scroll/);
  expect(await viewport.evaluate(node => node.scrollTop)).toBeCloseTo(before, 0);
  // Clamp to the actual bottom instead of leaving a transformed blank page.
  for (let i = 0; i < 15; i++) {
    await down.click();
    await page.waitForTimeout(450);
  }
  expect(await viewport.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2);
  await expect(down).toBeVisible();
  await expect(page.getByRole('button', { name: /↑$/ })).toBeVisible();
});

test('custom paging keys work in both pointer modes and can be omitted', async ({ page }) => {
  await page.goto('/flow?custom-scroll-keys');
  const viewport = page.locator('.viewport');
  await page.keyboard.press('PageDown');
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('PageUp');
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBe(0);
  await page.getByRole('button', { name: /toggle native scrolling/ }).click();
  await page.keyboard.press('PageDown');
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.goto('/flow?no-scroll-keys');
  await expect(page.locator('.scroll')).toHaveCount(0);
  await page.getByRole('button', { name: /toggle native scrolling/ }).click();
  await viewport.hover();
  await page.mouse.wheel(0, 20);
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeGreaterThan(100);
});

test('paging controls follow actual overflow after viewport resizes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2400 });
  await page.goto('/flow?short');
  await expect(page.locator('.scroll')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(page.locator('.scroll')).toBeVisible();
  await page.getByRole('button', { name: /toggle native scrolling/ }).click();
  await expect(page.locator('.scroll')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 2400 });
  await expect(page.locator('.scroll')).toHaveCount(0);
});
