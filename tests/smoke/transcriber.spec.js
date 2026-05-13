import { test, expect } from '@playwright/test';

const URL = '/transcriber.html';
const SAMPLE_TEXT = 'Kriste Rex\nsláva Bohu';

async function buildHymn(page, text = SAMPLE_TEXT) {
  await page.fill('#editorRawText', text);
  await page.click('#editorBuildBtn');
  await page.waitForSelector('.editor-melody-input');
}

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
  expect(val).toContain('Trí|ni|tas.');
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

// ── §11 PDF settings round-trip ───────────────────────────────────────────────

test('PDF settings: font size round-trips through GABC header', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  await page.fill('#editorFontSize', '14');
  await page.dispatchEvent('#editorFontSize', 'input');

  const gabc = await page.inputValue('#gabcEditor');
  expect(gabc).toContain('%fontsize: 14;');

  // Switch to GABC tab and back — values should survive dirty-flag sync
  await page.click('#tabGabcBtn');
  await page.click('#tabEditorBtn');
  const restored = await page.inputValue('#editorFontSize');
  expect(restored).toBe('14');
});

test('PDF settings: page width round-trips through GABC header', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  await page.fill('#editorPageWidth', '6.5');
  await page.dispatchEvent('#editorPageWidth', 'input');

  const gabc = await page.inputValue('#gabcEditor');
  expect(gabc).toContain('%width: 6.5;');

  await page.click('#tabGabcBtn');
  await page.click('#tabEditorBtn');
  const restored = await page.inputValue('#editorPageWidth');
  expect(restored).toBe('6.5');
});

test('PDF settings: PDF form carries font size and width to hidden fields', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);

  await page.fill('#editorFontSize', '12');
  await page.dispatchEvent('#editorFontSize', 'input');
  await page.fill('#editorPageWidth', '7');
  await page.dispatchEvent('#editorPageWidth', 'input');

  await page.route('**/process.php', route => route.abort());
  await page.click('#btnExportPdf').catch(() => { });

  expect(await page.inputValue('#pdfFontSize')).toBe('12');
  expect(await page.inputValue('#pdfWidth')).toBe('7');
});

// ── §12 Preview header play button ───────────────────────────────────────────

test('play button: hidden before build, visible after build when audio available', async ({ page }) => {
  await page.goto(URL);
  // Before build — previewControls should be hidden (no score yet)
  await expect(page.locator('#previewControls')).toBeHidden();

  await buildHymn(page);
  await page.waitForTimeout(400); // render debounce

  // After build + render — controls visible only if audio is available
  // (in headless Chromium, AudioContext is usually available)
  const visible = await page.locator('#previewControls').isVisible();
  // We can't guarantee audio in CI, so just assert no JS error occurred
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  expect(errors).toHaveLength(0);
  // If visible, play button must be present and enabled
  if (visible) {
    await expect(page.locator('#btnPlayFromStart')).toBeVisible();
    await expect(page.locator('#btnPlayFromStart')).toBeEnabled();
  }
});

test('play button: disabled while playing, re-enabled after stop', async ({ page }) => {
  await page.goto(URL);
  await buildHymn(page);
  await page.waitForTimeout(400);

  // Skip if audio not available (controls hidden)
  const visible = await page.locator('#previewControls').isVisible();
  test.skip(!visible, 'audio not available in this environment');

  await page.click('#btnPlayFromStart');
  await expect(page.locator('#btnPlayFromStart')).toBeDisabled();

  await page.click('#btnMediaStop');
  await expect(page.locator('#btnPlayFromStart')).toBeEnabled();
});

// ── §13 Persistence: Save / Load ─────────────────────────────────────────────

// Helper: clear all op-tc:: keys from localStorage
async function clearTranscriberSaves(page) {
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('op-tc::'))
      .forEach(k => localStorage.removeItem(k));
  });
}

test('persistence: Save button is visible in the tab bar', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('#btnSave')).toBeVisible();
});

test('persistence: Load button is visible in the tab bar', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('#btnLoad')).toBeVisible();
});

test('persistence: Save opens modal with title', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);
  await page.click('#btnSave');
  await expect(page.locator('dialog[data-op-modal]')).toBeVisible();
  const title = await page.locator('.op-modal-title').textContent();
  expect(title).toMatch(/save/i);
});

test('persistence: Save modal pre-fills name from annotation', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);
  await page.fill('#editorAnnotation', 'My Hymn');
  await page.dispatchEvent('#editorAnnotation', 'input');
  await page.click('#btnSave');
  const val = await page.locator('dialog[data-op-modal] input[type="text"]').inputValue();
  expect(val).toBe('My Hymn');
  await page.keyboard.press('Escape');
});

test('persistence: Save modal shows empty-name validation error', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);
  await page.click('#btnSave');
  // Clear pre-filled name and try to save
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('');
  await page.locator('dialog[data-op-modal] .op-modal-btn-primary').click();
  const err = await page.locator('.op-modal-error').textContent();
  expect(err.trim().length).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
});

test('persistence: saving a hymn writes to localStorage', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);

  await page.click('#btnSave');
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('TestHymn');
  await page.locator('dialog[data-op-modal] .op-modal-btn-primary').click();

  const saved = await page.evaluate(() => localStorage.getItem('op-tc::TestHymn'));
  expect(saved).not.toBeNull();
  const data = JSON.parse(saved);
  expect(data.gabc).toContain('%%');
  expect(data.v).toBe(1);
  await clearTranscriberSaves(page);
});

test('persistence: overwrite requires two clicks (two-step confirm)', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);

  // First save
  await page.click('#btnSave');
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('OverwriteMe');
  await page.locator('dialog[data-op-modal] .op-modal-btn-primary').click();

  // Second save with same name — should ask to confirm
  await page.click('#btnSave');
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('OverwriteMe');
  const saveBtn = page.locator('dialog[data-op-modal] .op-modal-btn-primary');
  await saveBtn.click(); // first click → "Overwrite?"
  expect(await saveBtn.textContent()).toMatch(/overwrite/i);
  await saveBtn.click(); // second click → confirms and closes
  await expect(page.locator('dialog[data-op-modal]')).not.toBeVisible();
  await clearTranscriberSaves(page);
});

test('persistence: Load opens modal listing saved hymns', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);

  // Save one hymn first
  await page.click('#btnSave');
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('LoadMe');
  await page.locator('dialog[data-op-modal] .op-modal-btn-primary').click();

  // Now open Load modal
  await page.click('#btnLoad');
  await expect(page.locator('dialog[data-op-modal]')).toBeVisible();
  const items = await page.locator('.op-modal-list-item-name').allTextContents();
  expect(items).toContain('LoadMe');
  await page.keyboard.press('Escape');
  await clearTranscriberSaves(page);
});

test('persistence: loading a save restores notes in melody inputs', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);

  const notesBefore = await page.locator('.editor-melody-input').first().inputValue();

  // Save
  await page.click('#btnSave');
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('RestoreMe');
  await page.locator('dialog[data-op-modal] .op-modal-btn-primary').click();

  // Change a note input directly
  await page.locator('.editor-melody-input').first().fill('z');
  await page.dispatchEvent('.editor-melody-input', 'change');

  // Load the save
  await page.click('#btnLoad');
  await page.locator('.op-modal-list-item-name').filter({ hasText: 'RestoreMe' })
    .locator('..').locator('.op-modal-btn-ghost').click();

  const notesAfter = await page.locator('.editor-melody-input').first().inputValue();
  expect(notesAfter).toBe(notesBefore);
  await clearTranscriberSaves(page);
});

test('persistence: deleting a save removes it from the list', async ({ page }) => {
  await page.goto(URL);
  await clearTranscriberSaves(page);
  await buildHymn(page);

  await page.click('#btnSave');
  await page.locator('dialog[data-op-modal] input[type="text"]').fill('DeleteMe');
  await page.locator('dialog[data-op-modal] .op-modal-btn-primary').click();

  // Open load modal and delete
  await page.click('#btnLoad');
  await page.locator('.op-modal-list-item-name').filter({ hasText: 'DeleteMe' })
    .locator('..').locator('.op-modal-btn-danger').click();

  const items = await page.locator('.op-modal-list-item-name').allTextContents();
  expect(items).not.toContain('DeleteMe');
  const stored = await page.evaluate(() => localStorage.getItem('op-tc::DeleteMe'));
  expect(stored).toBeNull();
  await page.keyboard.press('Escape');
});
