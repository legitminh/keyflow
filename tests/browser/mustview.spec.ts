import { test, expect, type Page } from '@playwright/test';
const root = (page: Page) => page.locator('.viewport');
const scrollTop = (page: Page) => root(page).evaluate((node) => node.scrollTop);
/** Element edges relative to the scroll viewport's top edge. */
const edges = (page: Page, id: string) => page.locator(`#${id}`).evaluate((node) => {
  const viewport = node.closest('[data-keyflow-scroll-viewport]')!.getBoundingClientRect(), rect = node.getBoundingClientRect();
  return { top: rect.top - viewport.top, bottom: rect.bottom - viewport.top };
});
const settle = async (page: Page) => {
  let previous = -1;
  await expect.poll(async () => { const now = await scrollTop(page); const stable = now === previous; previous = now; return stable; }, { intervals: [150] }).toBe(true);
};

test.describe('lockstep paging around must_view blocks', () => {
  let page_pixels = 0;
  test.beforeEach(async ({ page }) => {
    await page.goto('/mustview');
    await expect(page.locator('#short')).toBeVisible();
    // A full page step from a position where no block is cut off measures the page size.
    await root(page).evaluate((node) => { node.scrollTop = 1200; });
    await settle(page);
    await page.keyboard.press('PageDown'); await settle(page);
    page_pixels = await scrollTop(page) - 1200;
    expect(page_pixels).toBeGreaterThan(0);
    await root(page).evaluate((node) => { node.scrollTop = 0; }); await settle(page);
  });

  test('paging down aligns a partially hidden block to the top when its hidden part is under a page', async ({ page }) => {
    const before = await edges(page, 'short');
    expect(before.top).toBeGreaterThan(0);
    expect(before.top).toBeLessThan(page_pixels);
    expect(before.bottom).toBeGreaterThan(page_pixels);
    await page.keyboard.press('PageDown'); await settle(page);
    expect((await edges(page, 'short')).top).toBeCloseTo(0, 0);
    expect(await scrollTop(page)).toBeCloseTo(before.top, 0);
  });

  test('paging up aligns a partially hidden block to the bottom when its hidden part is under a page', async ({ page }) => {
    const start = (await edges(page, 'short')).top;
    await root(page).evaluate((node, y) => { node.scrollTop = y; }, start + 100); await settle(page);
    const before = await edges(page, 'short');
    expect(before.top).toBeLessThan(0);
    expect(before.bottom).toBeLessThan(page_pixels);
    await page.keyboard.press('PageUp'); await settle(page);
    expect((await edges(page, 'short')).bottom).toBeCloseTo(page_pixels, 0);
  });

  test('blocks whose hidden part exceeds a page are paged through normally', async ({ page }) => {
    const start = (await edges(page, 'tall')).top;
    const down_from = start - 100;
    await root(page).evaluate((node, y) => { node.scrollTop = y; }, down_from); await settle(page);
    await page.keyboard.press('PageDown'); await settle(page);
    expect(await scrollTop(page)).toBeCloseTo(down_from + page_pixels, 0);
    const end = (await edges(page, 'tall')).bottom + await scrollTop(page);
    const up_from = end - page_pixels + 100;
    await root(page).evaluate((node, y) => { node.scrollTop = y; }, up_from); await settle(page);
    await page.keyboard.press('PageUp'); await settle(page);
    expect(await scrollTop(page)).toBeCloseTo(up_from - page_pixels, 0);
  });
});
