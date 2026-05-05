import { test, expect } from '@playwright/test';

const URL = '/v2/psalms.html';
const VERSE_1 = 'Hospodin je môj pastier * a nič mi nechýba.';
const VERSE_2 = 'V zelených pastvinách ma ukladá * k tichým vodám ma privádza.';

async function buildVerses(page, verses = [VERSE_1, VERSE_2]) {
  await page.fill('#editorRawText', verses.join('\n'));
  await page.click('#editorBuildBtn');
  // After Build, stanzas stay hidden — wait for the Edit melody toggle to appear instead
  await page.waitForSelector('#editorEditToggle:not(.hidden)');
}

// ── Controls ──────────────────────────────────────────────────────────────────

test('controls: language dropdown has Slovak option', async ({ page }) => {
  await page.goto(URL);
  const options = page.locator('#editorLang option');
  await expect(options).not.toHaveCount(0);
  const labels = await options.allTextContents();
  expect(labels.some(l => l.toLowerCase().includes('slovak'))).toBe(true);
});

test('controls: tone dropdown is populated', async ({ page }) => {
  await page.goto(URL);
  const options = page.locator('#editorTone option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);
});

test('controls: termination dropdown is populated on load', async ({ page }) => {
  await page.goto(URL);
  const options = page.locator('#editorTerm option');
  const count = await options.count();
  expect(count).toBeGreaterThan(0);
});

// ── Build default view ─────────────────────────────────────────────────────────

test('build: textarea stays visible after Build (not hidden like transcriber)', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await expect(page.locator('#editorTextInputArea')).toBeVisible();
});

test('build: stanzas are hidden after Build', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await expect(page.locator('#editorStanzas')).toBeHidden();
});

test('build: Edit melody toggle is revealed with correct label', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await expect(page.locator('#editorEditToggle')).toBeVisible();
  expect(await page.textContent('#editorEditToggle')).toBe('Edit melody');
});

test('build: note inputs are auto-filled by pointing algorithm', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  // Inputs are in hidden #editorStanzas — use evaluate to read values directly
  const notes = await page.evaluate(() =>
    [...document.querySelectorAll('.editor-melody-input')].map(i => i.value)
  );
  expect(notes).toHaveLength(2);
  notes.forEach(v => expect(v.trim().length).toBeGreaterThan(0));
});

test('build: Build button hidden, Re-Point and Fit Text visible after Build', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await expect(page.locator('#editorBuildBtn')).toBeHidden();
  await expect(page.locator('#editorRebuildBtn')).toBeVisible();
  await expect(page.locator('#editorFitTextBtn')).toBeVisible();
});

// ── Edit melody toggle ─────────────────────────────────────────────────────────

test('toggle: click reveals melody editor and hides textarea', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await page.click('#editorEditToggle');

  await expect(page.locator('#editorTextInputArea')).toBeHidden();
  await expect(page.locator('#editorStanzas')).toBeVisible();
  expect(await page.textContent('#editorEditToggle')).toBe('Edit text');
});

test('toggle: alignment track chips are rendered when melody view is open', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await page.click('#editorEditToggle');

  const chips = page.locator('.track-chip-matched');
  const count = await chips.count();
  expect(count).toBeGreaterThan(0);
});

test('toggle: second click restores textarea and hides melody editor', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await page.click('#editorEditToggle'); // open melody view
  await page.click('#editorEditToggle'); // back to text view

  await expect(page.locator('#editorTextInputArea')).toBeVisible();
  await expect(page.locator('#editorStanzas')).toBeHidden();
  expect(await page.textContent('#editorEditToggle')).toBe('Edit melody');
});

// ── GABC tab ──────────────────────────────────────────────────────────────────

test('gabc tab: switches correctly and shows generated GABC', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);

  await page.click('#tabGabcBtn');
  await expect(page.locator('#gabcTab')).toBeVisible();
  await expect(page.locator('#editorTab')).toBeHidden();

  const gabc = await page.inputValue('#gabcEditor');
  expect(gabc).toContain('%%');
  expect(gabc).toContain('Hos'); // first syllable of verse 1
});

test('gabc tab: textarea is read-only', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await page.click('#tabGabcBtn');

  const isReadOnly = await page.locator('#gabcEditor').getAttribute('readonly');
  expect(isReadOnly).not.toBeNull();
});

test('gabc tab: switching back to Editor tab restores Editor view', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);
  await page.click('#tabGabcBtn');
  await page.click('#tabEditorBtn');

  await expect(page.locator('#editorTab')).toBeVisible();
  await expect(page.locator('#gabcTab')).toBeHidden();
});

// ── Tone change ────────────────────────────────────────────────────────────────

test('tone: changing tone updates note inputs', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page, [VERSE_1]);

  // Inputs are in hidden #editorStanzas — read via evaluate
  const notesBefore = await page.evaluate(() =>
    document.querySelector('.editor-melody-input')?.value ?? ''
  );

  // Switch to Tone 1 (guaranteed different from Tone 8 default)
  await page.selectOption('#editorTone', 'tone1');

  const notesAfter = await page.evaluate(() =>
    document.querySelector('.editor-melody-input')?.value ?? ''
  );
  expect(notesAfter).not.toBe(notesBefore);
});

test('tone: changing tone updates GABC output', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page, [VERSE_1]);

  const gabcBefore = await page.inputValue('#gabcEditor');
  await page.selectOption('#editorTone', 'tone1');
  const gabcAfter = await page.inputValue('#gabcEditor');

  expect(gabcAfter).not.toBe(gabcBefore);
  expect(gabcAfter).toContain('%%');
});

// ── Controls: Large Initial ───────────────────────────────────────────────────

test('controls: Large Initial toggle updates initial-style in GABC', async ({ page }) => {
  await page.goto(URL);
  await buildVerses(page);

  const chk = page.locator('#editorLargeInitial');
  if (await chk.isChecked()) await chk.uncheck();
  expect(await page.inputValue('#gabcEditor')).toContain('initial-style: 0;');

  await chk.check();
  expect(await page.inputValue('#gabcEditor')).toContain('initial-style: 1;');
});

// ── Export ────────────────────────────────────────────────────────────────────

test('export: PNG button triggers without JS error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(URL);
  await buildVerses(page);
  await page.waitForTimeout(400); // allow Exsurge render debounce

  await page.click('#btnDownloadPng');

  const status = await page.textContent('#statusMessage');
  expect(status).not.toMatch(/failed/i);
  expect(errors).toHaveLength(0);
});

test('export: SVG button triggers without JS error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(URL);
  await buildVerses(page);
  await page.waitForTimeout(400);

  await page.click('#btnDownloadSvg');

  const status = await page.textContent('#statusMessage');
  expect(status).not.toMatch(/failed/i);
  expect(errors).toHaveLength(0);
});

// ── Preview ───────────────────────────────────────────────────────────────────

test('preview: Exsurge SVG is rendered after Build', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(URL);
  await buildVerses(page);
  await page.waitForTimeout(400); // render debounce

  // Exsurge renders SVG or canvas elements into #chantPreview
  const svgCount = await page.locator('#chantPreview svg, #chantPreview canvas').count();
  expect(svgCount).toBeGreaterThan(0);
  expect(errors).toHaveLength(0);
});

test('preview: play button is hidden before Build', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('#previewControls')).toBeHidden();
});
