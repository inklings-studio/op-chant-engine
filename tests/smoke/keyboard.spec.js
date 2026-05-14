import { test, expect } from '@playwright/test';

const URL = '/transcriber.html';
const SAMPLE_TEXT = 'Kriste Rex\nsláva Bohu';

async function buildAndRender(page, text = SAMPLE_TEXT) {
    await page.fill('#editorRawText', text);
    await page.click('#editorBuildBtn');
    await page.waitForSelector('.editor-melody-input');
    await page.waitForTimeout(400); // render debounce
}

async function blurActive(page) {
    await page.evaluate(() => document.activeElement?.blur());
}

test.describe('keyboard: Space blocked in interactive elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL);
        await buildAndRender(page);
    });

    async function assertSpaceDoesNotPlay(page, selector) {
        await page.focus(selector);
        await page.keyboard.press('Space');
        await expect(page.locator('#mediaControls')).toBeHidden();
    }

    test('text input (annotation)', async ({ page }) => {
        await assertSpaceDoesNotPlay(page, '#editorAnnotation');
    });

    test('number input (font size)', async ({ page }) => {
        await assertSpaceDoesNotPlay(page, '#editorFontSize');
    });

    test('select (clef)', async ({ page }) => {
        await assertSpaceDoesNotPlay(page, '#editorClef');
    });

    test('melody input', async ({ page }) => {
        await assertSpaceDoesNotPlay(page, '.editor-melody-input');
    });

    test('textarea (GABC editor)', async ({ page }) => {
        await page.click('#tabGabcBtn');
        await assertSpaceDoesNotPlay(page, '#gabcEditor');
    });

    test('textarea (raw text)', async ({ page }) => {
        await page.click('#editorEditToggle'); // reveal hidden textarea
        await assertSpaceDoesNotPlay(page, '#editorRawText');
    });
});

test('keyboard: Space ignored when no score is rendered', async ({ page }) => {
    await page.goto(URL);
    await blurActive(page);
    await page.keyboard.press('Space');
    await expect(page.locator('#mediaControls')).toBeHidden();
});

test('keyboard: Space plays, pauses, and resumes', async ({ page }) => {
    await page.goto(URL);
    await buildAndRender(page);

    const audioAvailable = await page.locator('#previewControls').isVisible();
    test.skip(!audioAvailable, 'audio not available in this environment');

    await blurActive(page);

    await page.keyboard.press('Space');
    await expect(page.locator('#mediaControls')).toBeVisible();
    await expect(page.locator('#btnPauseResume')).toContainText('⏸');

    await page.keyboard.press('Space');
    await expect(page.locator('#mediaControls')).toBeVisible();
    await expect(page.locator('#btnPauseResume')).toContainText('▶');

    await page.keyboard.press('Space');
    await expect(page.locator('#mediaControls')).toBeVisible();
    await expect(page.locator('#btnPauseResume')).toContainText('⏸');
});

test('keyboard: Space plays, Esc stops while playing', async ({ page }) => {
    await page.goto(URL);
    await buildAndRender(page);

    const audioAvailable = await page.locator('#previewControls').isVisible();
    test.skip(!audioAvailable, 'audio not available in this environment');

    await blurActive(page);

    await page.keyboard.press('Space');
    await expect(page.locator('#mediaControls')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#mediaControls')).toBeHidden();
    await expect(page.locator('#btnPlayFromStart')).toBeEnabled();
});

test('keyboard: Esc stops while paused', async ({ page }) => {
    await page.goto(URL);
    await buildAndRender(page);

    const audioAvailable = await page.locator('#previewControls').isVisible();
    test.skip(!audioAvailable, 'audio not available in this environment');

    await blurActive(page);

    await page.keyboard.press('Space'); // play
    await page.keyboard.press('Space'); // pause
    await expect(page.locator('#mediaControls')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#mediaControls')).toBeHidden();
    await expect(page.locator('#btnPlayFromStart')).toBeEnabled();
});

test('keyboard: Space after pause resumes (next Space plays, not restarts)', async ({ page }) => {
    await page.goto(URL);
    await buildAndRender(page);

    const audioAvailable = await page.locator('#previewControls').isVisible();
    test.skip(!audioAvailable, 'audio not available in this environment');

    await blurActive(page);

    await page.keyboard.press('Space'); // play
    await page.waitForTimeout(200); // let a few notes fire so currentNote is set

    await page.keyboard.press('Space'); // pause — currentNote is saved
    await page.keyboard.press('Space'); // resume — must show ⏸, not start over

    await expect(page.locator('#mediaControls')).toBeVisible();
    await expect(page.locator('#btnPauseResume')).toContainText('⏸');
});
