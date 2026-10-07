import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import data from '../../data.js';
import { freshState, exportState, STORAGE_KEY } from '../../core.js';

test.beforeEach(async ({ page }) => { await page.goto('./'); await expect(page.getByRole('heading', { name: 'Take a two-minute inventory', exact: true })).toBeVisible(); });
test('progress persists across reload and updates next task', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Complete task: Take a two-minute inventory', exact: true }).check();
  await expect(page.locator('#next-heading')).toHaveText('Listen to the Lost City radio');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Complete task: Take a two-minute inventory', exact: true })).toBeChecked();
  await expect(page.locator('#next-heading')).toHaveText('Listen to the Lost City radio');
});
test('manual inventory preserves unknown and zero through reload', async ({ page }) => {
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await page.getByLabel('Glimmer', { exact: true }).fill('0');
  await page.getByLabel('Exotic Ciphers', { exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Glimmer', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Exotic Ciphers', { exact: true })).toHaveValue('');
});
test('export download and import restore both steps and counts; bad import is atomic', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Complete task: Take a two-minute inventory', exact: true }).check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Progress', exact: true }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(download.suggestedFilename()).toContain('destiny-roadmap-progress');
  await page.getByRole('button', { name: 'Reset Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Reset this browser', exact: true }).click();
  await page.getByRole('button', { name: 'Import Progress', exact: true }).click();
  await page.locator('#import-file').setInputFiles(filePath);
  await page.getByRole('button', { name: 'Validate & replace' }).click();
  await expect(page.locator('#next-heading')).toHaveText('Listen to the Lost City radio');
  await page.getByRole('button', { name: 'Import Progress', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.getByRole('button', { name: 'Validate & replace' }).click();
  await expect(page.locator('#import-error')).toContainText('Existing progress has not changed');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#next-heading')).toHaveText('Listen to the Lost City radio');
});
test('backup with counters and route imports correctly', async ({ page }) => {
  const s = freshState(data); s.quantities.ciphers = 1; s.route = 'story';
  await page.getByRole('button', { name: 'Import Progress', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(exportState(s)) });
  await page.getByRole('button', { name: 'Validate & replace' }).click();
  await expect(page.locator('#route')).toHaveValue('story');
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByLabel('Exotic Ciphers', { exact: true })).toHaveValue('1');
});
test('reset requires confirmation and cancel keeps progress', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Complete task: Take a two-minute inventory', exact: true }).check();
  await page.getByRole('button', { name: 'Reset Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Keep progress', exact: true }).click();
  await expect(page.locator('#next-heading')).toHaveText('Listen to the Lost City radio');
  await page.getByRole('button', { name: 'Reset Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Reset this browser', exact: true }).click();
  await expect(page.locator('#next-heading')).toHaveText('Take a two-minute inventory');
  await page.reload();
  await expect(page.locator('#next-heading')).toHaveText('Take a two-minute inventory');
});
test('ready filter does not expose locked farms and opening next clears restrictive filters', async ({ page }) => {
  await page.getByRole('button', { name: 'All sections', exact: false }).click();
  await page.locator('#status').selectOption('ready');
  await expect(page.getByText('Get a first usable Refurbished A499', { exact: true })).toHaveCount(0);
  await page.locator('#search').fill('impossible-filter');
  await page.getByRole('button', { name: 'Open this step' }).click();
  await expect(page.locator('#details-audit')).toHaveAttribute('open', '');
  await expect(page.locator('#search')).toHaveValue('');
});
test('mobile pages have no horizontal overflow and controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Checklist', 'Loadouts & after A499', 'Inventory', 'Raids & dungeons', 'Sources & terms']) {
    await page.getByRole('link', { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: 'Checklist', exact: true }).click();
  await page.getByRole('button', { name: 'Open this step' }).click();
  await expect(page.locator('#details-audit')).toHaveAttribute('open', '');
});
test('visible views meet basic WCAG accessibility checks in day and night themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    for (const name of ['Checklist', 'Loadouts & after A499', 'Inventory', 'Raids & dungeons', 'Sources & terms']) {
      await page.getByRole('link', { name, exact: true }).click();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations, theme + ' ' + name).toEqual([]);
    }
  }
});
test('corrupt saved progress is recoverable and never silently replaced', async ({ page }) => {
  await page.evaluate(key => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Export recovery copy' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Complete task: Take a two-minute inventory', exact: true }).check();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken');
});
test('rendered source links are safe and local assets load without errors', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await page.getByRole('link', { name: 'Sources & terms', exact: true }).click();
  for (const link of await page.locator('#source-list a').all()) expect(await link.getAttribute('href')).toMatch(/^https:\/\//);
  expect(errors).toEqual([]);
});
test('expanded task cards remain accessible and use unique element IDs', async ({ page }) => {
  await page.getByRole('button', { name: 'All sections', exact: false }).click();
  await page.locator('#tag').selectOption('Build Critical');
  await page.locator('#details-audit > summary').click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  const duplicates = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.filter((id,i) => ids.indexOf(id) !== i); });
  expect(duplicates).toEqual([]);
  await page.getByRole('link', { name: 'Raids & dungeons', exact: true }).click();
  expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.length === new Set(ids).size; })).toBe(true);
});
