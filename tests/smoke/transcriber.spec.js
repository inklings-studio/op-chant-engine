import { test, expect } from '@playwright/test';

const URL = '/v2/transcriber.html';
const SAMPLE_TEXT = 'Kriste Rex\nsláva Bohu';

async function buildHymn(page, text = SAMPLE_TEXT) {
  await page.fill('#editorRawText', text);
  await page.click('#editorBuildBtn');
  await page.waitForSelector('.editor-melody-input');
}

// ── §7 Tab switching ──────────────────────────────────────────────────────────

test('tab switch: GABC tab shows gabcTab and hides editorTab', async ({ page }) => {
  await page.goto(URL);
  await page.click('#tabGabcBtn');
  await expect(page.locator('#gabcTab')).toBeVisible();
  await expect(page.locator('#editorTab')).toBeHidden();

  await page.click('#tabEditorBtn');
  await expect(page.locator('#editorTab')).toBeVisible();
  await expect(page.locator('#gabcTab')).toBeHidden();
});

test('tab switch: Build writes GABC into tab 2 textarea', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);
  // gabcEditor is populated by onCompiledGabc even while tab 2 is hidden
  const gabc = await page.inputValue('#gabcEditor');
  expect(gabc).toContain('%%');
  expect(gabc).toContain('Kris');
});

test('tab switch: editing tab 2 then switching back re-parses into editor', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);
  await page.click('#tabGabcBtn');

  await page.fill('#gabcEditor', 'initial-style: 0;\n%%\n(c4) Pa(f)ne(g) (::)');
  await page.click('#tabEditorBtn');

  // Dirty sync should have rebuilt stanzas — at least one melody input present
  await expect(page.locator('.editor-melody-input').first()).toBeVisible();
  // And the melody input for the parsed line should have the synced notes
  const val = await page.locator('.editor-melody-input').first().inputValue();
  expect(val).toMatch(/f|g/);
});

test('tab switch: Tab1→2→1 round-trip without edits leaves notes unchanged', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  const before = await page.locator('.editor-melody-input').first().inputValue();

  await page.click('#tabGabcBtn');
  await page.click('#tabEditorBtn');

  const after = await page.locator('.editor-melody-input').first().inputValue();
  expect(after).toBe(before);
});

// ── §8 Export controls ────────────────────────────────────────────────────────

test('export: PNG button triggers without JS error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(URL);
  await buildHymn(page);
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
  await buildHymn(page);
  await page.waitForTimeout(400);

  await page.click('#btnDownloadSvg');

  const status = await page.textContent('#statusMessage');
  expect(status).not.toMatch(/failed/i);
  expect(errors).toHaveLength(0);
});

test('export: PDF form targets correct endpoint and carries GABC field', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  // Intercept the form submit so the test doesn't navigate away
  await page.route('**/process.php', route => route.abort());

  const action = await page.getAttribute('#pdfForm', 'action');
  expect(action).toContain('sourceandsummit.com');

  // Click PDF — onExportPdf fills #pdfGabc then submits (intercepted)
  await page.click('#btnExportPdf').catch(() => { }); // ignore abort error

  const fieldValue = await page.inputValue('#pdfGabc');
  expect(fieldValue).toContain('%%');
});

// ── §9 Controls UI ────────────────────────────────────────────────────────────

test('controls: language dropdown has at least one option (Slovak)', async ({ page }) => {
  await page.goto(URL);
  const options = page.locator('#editorLang option');
  await expect(options).not.toHaveCount(0);
  const labels = await options.allTextContents();
  expect(labels.some(l => l.toLowerCase().includes('slovak'))).toBe(true);
});

test('controls: clef change updates compiled GABC', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  await page.selectOption('#editorClef', 'c3');

  const gabc = await page.inputValue('#gabcEditor');
  expect(gabc).toContain('(c3)');
});

test('controls: Large Initial toggle updates initial-style in GABC header', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  // Turn Large Initial OFF
  const chk = page.locator('#editorLargeInitial');
  if (await chk.isChecked()) await chk.uncheck();
  expect(await page.inputValue('#gabcEditor')).toContain('initial-style: 0;');

  // Turn Large Initial ON
  await chk.check();
  expect(await page.inputValue('#gabcEditor')).toContain('initial-style: 1;');
});

test('controls: Edit text toggle shows and hides textarea', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  // After Build, textarea is hidden and toggle button is visible
  await expect(page.locator('#editorTextInputArea')).toBeHidden();
  await expect(page.locator('#editorEditToggle')).toBeVisible();

  // Click to show
  await page.click('#editorEditToggle');
  await expect(page.locator('#editorTextInputArea')).toBeVisible();
  expect(await page.textContent('#editorEditToggle')).toBe('Hide');

  // Click to hide again
  await page.click('#editorEditToggle');
  await expect(page.locator('#editorTextInputArea')).toBeHidden();
});

// ── §10 GABC import workflow ──────────────────────────────────────────────────
const IMPORT_GABC = [
  'name: O lux;',
  '%%',
  '(c4) O(f) lux(g) be(h)á(g)ta,(f) (,)',
  'Trí(g)ni(h)tas.(g) (::)',
].join('\n');

async function importGabc(page, gabc = IMPORT_GABC) {
  await page.click('#tabGabcBtn');
  await page.fill('#gabcEditor', gabc);
  await page.click('#tabEditorBtn');
  await page.waitForSelector('.editor-melody-input');
}

test('GABC import: raw text textarea populated with reconstructed syllables', async ({ page }) => {
  await page.goto(URL);
  await importGabc(page);
  // 'Edit text' reveals the textarea — it should contain the reconstructed Latin text
  await page.click('#editorEditToggle');
  const val = await page.inputValue('#editorRawText');
  expect(val).toContain('O lux');
  expect(val).toContain('Trínitas.');
});

test('GABC import: mid-line barlines preserved in melody inputs', async ({ page }) => {
  await page.goto(URL);
  await importGabc(page);
  const inputs = await page.locator('.editor-melody-input').all();
  // Line 0 ends with (,) in the GABC — comma barline must be in the notes
  const line0 = await inputs[0].inputValue();
  expect(line0).toMatch(/,\s*$/);
});

test('GABC import: last line melody input ends with ::', async ({ page }) => {
  await page.goto(URL);
  await importGabc(page);
  const inputs = await page.locator('.editor-melody-input').all();
  const lastLine = await inputs[inputs.length - 1].inputValue();
  expect(lastLine).toMatch(/::$/);
});

test('GABC import: Fit Text preserves imported melody, replaces syllables', async ({ page }) => {
  await page.goto(URL);
  await importGabc(page);
  const originalNotes = await page.locator('.editor-melody-input').first().inputValue();

  await page.click('#editorEditToggle');
  await page.fill('#editorRawText', 'Pane Bože milosrdný\nuslyš naše volanie');
  await page.click('#editorFitTextBtn');

  const newNotes = await page.locator('.editor-melody-input').first().inputValue();
  expect(newNotes).toBe(originalNotes);
  // New syllable chips should reflect Slovak text
  const chips = await page.locator('.track-chip-matched, .track-chip-overflow').all();
  expect(chips.length).toBeGreaterThan(0);
});
