import { test, expect } from '@playwright/test';

// ── Psalm tool: Latin language ────────────────────────────────────────────────

const PSALMS_URL = '/psalms.html';
const TRANSCRIBER_URL = '/transcriber.html';

async function switchToLatin(page) {
    await page.selectOption('#editorLang', 'la');
}

// ── Language selection ─────────────────────────────────────────────────────────

test('psalms: language dropdown includes Latin', async ({ page }) => {
    await page.goto(PSALMS_URL);
    const options = page.locator('#editorLang option');
    const labels = await options.allTextContents();
    expect(labels.some((l) => l.toLowerCase().includes('latin'))).toBe(true);
});

test('transcriber: language dropdown includes Latin', async ({ page }) => {
    await page.goto(TRANSCRIBER_URL);
    const options = page.locator('#editorLang option');
    const labels = await options.allTextContents();
    expect(labels.some((l) => l.toLowerCase().includes('latin'))).toBe(true);
});

// ── Psalm selector: Latin ─────────────────────────────────────────────────────

test('psalms: psalm selector is populated after switching to Latin', async ({ page }) => {
    await page.goto(PSALMS_URL);
    await switchToLatin(page);
    const options = page.locator('#psalmSelect option');
    const count = await options.count();
    expect(count).toBeGreaterThan(1); // blank sentinel + at least 150 psalms
});

test('psalms: selecting Latin psalm loads text into textarea', async ({ page }) => {
    await page.goto(PSALMS_URL);
    await switchToLatin(page);
    await page.selectOption('#psalmSelect', 'ps_001');
    await page.waitForSelector('#editorEditToggle:not(.hidden)');
    const raw = await page.inputValue('#editorRawText');
    expect(raw.trim().length).toBeGreaterThan(0);
    // Latin psalm 1 starts with "Beátus"; strip | syllable markers injected after Build
    expect(raw.replace(/\|/g, '')).toContain('Beátus');
});

test('psalms: selecting Latin psalm sets annotation to psalm label', async ({ page }) => {
    await page.goto(PSALMS_URL);
    await switchToLatin(page);
    await page.selectOption('#psalmSelect', 'ps_001');
    await page.waitForSelector('#editorEditToggle:not(.hidden)');
    const annotation = await page.inputValue('#editorAnnotation');
    expect(annotation).toBe('Ps. 1');
});

test('psalms: Latin psalm renders GABC preview without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PSALMS_URL);
    await switchToLatin(page);
    await page.selectOption('#psalmSelect', 'ps_001');
    await page.waitForSelector('#editorEditToggle:not(.hidden)');
    await page.waitForTimeout(400);

    const svgCount = await page.locator('#chantPreview svg, #chantPreview canvas').count();
    expect(svgCount).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
});

test('psalms: Latin psalm 119 (many verses) loads without error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PSALMS_URL);
    await switchToLatin(page);
    await page.selectOption('#psalmSelect', 'ps_119');
    await page.waitForSelector('#editorEditToggle:not(.hidden)');
    await page.waitForTimeout(400);

    expect(errors).toHaveLength(0);
    const raw = await page.inputValue('#editorRawText');
    expect(raw.trim().length).toBeGreaterThan(0);
});

// ── GABC output: Latin syllabification ────────────────────────────────────────

test('psalms: GABC output contains expected Latin syllable (Beá)', async ({ page }) => {
    await page.goto(PSALMS_URL);
    await switchToLatin(page);
    await page.selectOption('#psalmSelect', 'ps_001');
    await page.waitForSelector('#editorEditToggle:not(.hidden)');

    const gabc = await page.inputValue('#gabcEditor');
    expect(gabc).toContain('%%');
    // "Beátus" → "Be" / "á" / "tus" — first syllable "Be" must appear
    expect(gabc).toContain('Be');
});

// ── Transcriber: Latin syllabification ────────────────────────────────────────

test('transcriber: Latin text builds and renders without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(TRANSCRIBER_URL);
    await switchToLatin(page);

    // Type a simple two-verse Latin phrase
    await page.fill('#editorRawText', 'Beátus vir, qui non ábiit * in consílio impiórum.');
    await page.click('#editorBuildBtn');
    await page.waitForSelector('#editorEditToggle:not(.hidden)');

    // GABC should be generated
    const gabc = await page.inputValue('#gabcEditor');
    expect(gabc).toContain('%%');
    expect(gabc).toContain('Be'); // first syllable of Beátus

    expect(errors).toHaveLength(0);
});
