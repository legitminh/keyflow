import { test, expect, type Page } from '@playwright/test';

async function freezeFeedbackClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-11T12:00:01Z'));
}

test('automatic buttons share their highlight for hardware, pointer, virtual keys and native clicks', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: /Page A/ });
  const display = button.locator('.button');
  await expect(button.locator('.pending_route')).toHaveText('a');
  await freezeFeedbackClock(page);
  await page.keyboard.down('a');
  await expect(display).toHaveClass(/highlighted/);
  const highlightedColor = await button.locator('.content').evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.keyboard.up('a');
  await expect(display).toHaveClass(/highlighted/);
  await page.clock.runFor(181);
  await expect(display).not.toHaveClass(/highlighted/);

  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(button.locator('.content')).toHaveCSS('background-color', highlightedColor);
  await page.mouse.up();
  await expect(display).toHaveClass(/highlighted/);
  await page.clock.runFor(181);
  await expect(display).not.toHaveClass(/highlighted/);

  await page.locator('.keyboard-dock').getByRole('button', { name: 'a', exact: true }).click();
  await expect(display).toHaveClass(/highlighted/);
  await expect(button.locator('.content')).toHaveCSS('background-color', highlightedColor);
  await page.clock.runFor(181);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(display).toHaveClass(/highlighted/);
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 4');
});

test('static buttons highlight on direct clicks, keyboard releases and virtual input', async ({ page }) => {
  await page.goto('/frames');
  const button = page.getByRole('button', { name: /root: \d+$/ });
  const display = button.locator('.button');
  await expect(button.locator('.pending_route')).toHaveText('q');
  await freezeFeedbackClock(page);
  await button.click();
  await expect(display).toHaveClass(/highlighted/);
  await page.clock.runFor(181);
  await page.keyboard.press('q');
  await expect(display).toHaveClass(/highlighted/);
  await page.clock.runFor(181);
  await page.getByRole('region', { name: '16-key keyboard' }).getByRole('button', { name: 'q', exact: true }).click();
  await expect(display).toHaveClass(/highlighted/);
  await expect(button).toContainText('root: 3');
  await page.getByRole('button', { name: 'Toggle menu frame' }).click();
  await expect(button).toBeDisabled();
  await expect(display).not.toHaveClass(/highlighted/);
  await button.dispatchEvent('click');
  await expect(display).not.toHaveClass(/highlighted/);
  await expect(button).toContainText('root: 3');
});

test('touch taps receive the same brief action highlight', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  await page.goto('/');
  const button = page.getByRole('button', { name: /Page A/ });
  await expect(button.locator('.pending_route')).toHaveText('a');
  await freezeFeedbackClock(page);
  await button.tap();
  await expect(button.locator('.button')).toHaveClass(/highlighted/);
  await page.clock.runFor(181);
  await page.locator('.keyboard-dock').getByRole('button', { name: 'a', exact: true }).tap();
  await expect(button.locator('.button')).toHaveClass(/highlighted/);
  await expect(page.getByLabel('Page action count')).toHaveText('Page actions: 2');
  await context.close();
});
