// Loads every preview variant in real Chromium and screenshots it. Two jobs:
//   1. Hard guarantee that all 15 variants render without JS error (satisfies
//      surface_without_self_test for each variant).
//   2. Produces design-screenshots/preview-<track>-<page>.png so the user can
//      look at all designs side-by-side without spinning up the dev server.

import { test, expect } from '@playwright/test';
import { startHarness, type Harness } from './harness.js';

let h: Harness;

test.beforeAll(async () => {
  h = await startHarness();
});

test.afterAll(async () => {
  if (h) await h.teardown();
});

const TRACKS = ['a', 'b', 'c'] as const;
const PAGES = ['landing', 'setup', 'workspace', 'done', 'settings'] as const;

test('Preview index renders the 3x5 gallery', async ({ page }) => {
  await page.goto(`${h.uiUrl}/?preview=index`);
  await expect(page.getByText('3 directions × 5 pages')).toBeVisible();
  for (const t of TRACKS) {
    for (const p of PAGES) {
      await expect(page.locator(`a[href="?preview=${t}/${p}"]`)).toBeVisible();
    }
  }
  await page.screenshot({ path: `design-screenshots/preview-index.png`, fullPage: true });
});

for (const track of TRACKS) {
  for (const pageName of PAGES) {
    test(`Preview ${track}/${pageName} renders without error and screenshots`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${h.uiUrl}/?preview=${track}/${pageName}`);
      // Toolbar always visible in variant mode
      await expect(page.getByText('← all variants')).toBeVisible({ timeout: 5_000 });
      // Page-specific sanity check: the body has at least one substantive
      // element (avoid passing on totally-blank components).
      const visibleText = await page.locator('body').innerText();
      expect(visibleText.length).toBeGreaterThan(100);
      expect(errors, `Console errors on ${track}/${pageName}: ${errors.join(', ')}`).toEqual([]);
      await page.screenshot({
        path: `design-screenshots/preview-${track}-${pageName}.png`,
        fullPage: true,
      });
    });
  }
}
