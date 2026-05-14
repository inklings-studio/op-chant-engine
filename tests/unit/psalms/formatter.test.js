import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateBreviaryHtml, compileBreviaryHtml } from '../../../js/psalms/formatter.js';

// ── generateBreviaryHtml ──────────────────────────────────────────────────────

describe('generateBreviaryHtml: intonation skipping (default)', () => {
    // Verse AST: [intonation, intonation, tenor, acc, fin]
    // Without repeatIntonation the two intonation syllables must not appear.
    const ast = [
        { syl: 'Ve', note: 'f', role: 'intonation' },
        { syl: 'le', note: 'g', role: 'intonation' },
        { syl: 'bí', note: 'h', role: 'tenor' },
        { syl: 'mo', note: 'h', role: 'tenor' },
        { syl: 'ja', note: 'k', role: 'acc' },
        { syl: 'du', note: 'j', role: 'ep' },
        { syl: 'ša', note: 'j.', role: 'fin' },
        { syl: '', note: '|', role: 'mediant' },
    ];
    const wordMap = [0, 0, 1, 2, 2, 3, 3, null];

    test('intonation syllables absent when repeatIntonation=false (default)', () => {
        const html = generateBreviaryHtml(ast, wordMap);
        assert.ok(!html.includes('Ve'), 'first intonation syllable must be hidden');
        assert.ok(!html.includes('le'), 'second intonation syllable must be hidden');
    });

    test('non-intonation syllables still rendered', () => {
        const html = generateBreviaryHtml(ast, wordMap);
        assert.ok(html.includes('bí'), 'tenor syllable must appear');
        assert.ok(html.includes('<b>ja</b>'), 'acc syllable must be bolded');
    });
});

describe('generateBreviaryHtml: intonation shown when repeatIntonation=true', () => {
    const ast = [
        { syl: 'Ve', note: 'f', role: 'intonation' },
        { syl: 'le', note: 'g', role: 'intonation' },
        { syl: 'bí', note: 'h', role: 'tenor' },
        { syl: 'mo', note: 'h', role: 'tenor' },
        { syl: 'ja', note: 'k', role: 'acc' },
        { syl: 'du', note: 'j', role: 'ep' },
        { syl: 'ša', note: 'j.', role: 'fin' },
        { syl: '', note: '|', role: 'mediant' },
    ];
    // word indices: Ve=0, le=0 (same word), bí=1, mo=2, ja=2, du=3, ša=3
    const wordMap = [0, 0, 1, 2, 2, 3, 3, null];

    test('intonation syllables present when repeatIntonation=true', () => {
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        assert.ok(html.includes('Ve'), 'first intonation syllable must appear');
        assert.ok(html.includes('le'), 'second intonation syllable must appear');
    });

    test('intonation syllables rendered as plain text (no wrapper)', () => {
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        // Must not be wrapped in <b> or <i>
        assert.ok(!html.match(/<[bi]>Ve/), 'intonation must not be bolded/italicised');
        assert.ok(!html.match(/<[bi]>le/), 'intonation must not be bolded/italicised');
    });

    test('acc still bolded when repeatIntonation=true', () => {
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        assert.ok(html.includes('<b>ja</b>'), 'acc must still be wrapped');
    });

    test('intonation syllables of the same word are joined without a space', () => {
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        assert.ok(html.includes('Vele'), 'same-word intonation syllables must be joined');
    });

    test('syllables from different words are separated by a space', () => {
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        assert.ok(
            html.includes('Velé') ||
                html.match(/Vele\s+bí/) ||
                html.includes('Velebí') ||
                html.match(/le\s+bí/) ||
                html.match(/Ve.*le.*bí/),
            'words must be space-separated'
        );
        // More precisely: "Vele" (word 0) space "bí" (word 1)
        assert.ok(html.match(/Vele\s+bí/), 'Vele and bí must be separated by space');
    });

    test('mediant marker present regardless of repeatIntonation', () => {
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        assert.ok(html.includes('verse-mark'), 'mediant marker must still appear');
    });

    test('sylIdx advances correctly so wordMap lookup stays aligned', () => {
        // If sylIdx did NOT advance for intonation tokens, "bí" would receive wordMap[0]=0
        // and be incorrectly joined with "Ve". Verify they are separated.
        const html = generateBreviaryHtml(ast, wordMap, {}, true);
        assert.ok(html.match(/Vele\s+bí/), 'bí must be a separate word from the intonation pair');
    });
});

describe('generateBreviaryHtml: flex phrase with repeatIntonation', () => {
    // Verse with flex: [intonation, flex-acc, flex-ep, flex, tenor, acc, fin]
    const flexAst = [
        { syl: 'a', note: 'f', role: 'intonation' },
        { syl: 'môj', note: 'h', role: 'acc' }, // flex acc (before flex marker)
        { syl: 'duch', note: 'h', role: 'ep' }, // flex ep
        { syl: '', note: '|', role: 'flex' },
        { syl: 'ja', note: 'h', role: 'tenor' },
        { syl: 'sá', note: 'k', role: 'acc' },
        { syl: '', note: '|', role: 'mediant' },
    ];
    const flexWordMap = [0, 1, 2, null, 3, 3, null];

    test('intonation hidden in flex verse by default', () => {
        const html = generateBreviaryHtml(flexAst, flexWordMap);
        assert.ok(!html.includes('>a<') && !html.startsWith('a'), 'intonation must be hidden');
    });

    test('intonation shown in flex verse when repeatIntonation=true', () => {
        const html = generateBreviaryHtml(flexAst, flexWordMap, {}, true);
        assert.ok(html.startsWith('a'), 'intonation "a" must appear first');
    });

    test('flex marker present in both modes', () => {
        const html1 = generateBreviaryHtml(flexAst, flexWordMap);
        const html2 = generateBreviaryHtml(flexAst, flexWordMap, {}, true);
        assert.ok(html1.includes('†'), 'flex marker must appear without repeat');
        assert.ok(html2.includes('†'), 'flex marker must appear with repeat');
    });
});

// ── compileBreviaryHtml ───────────────────────────────────────────────────────

describe('compileBreviaryHtml: repeatIntonation flag threading', () => {
    // Minimal state: 2 stanzas. stanzas[0] is verse 1 (skipped by slice(1)).
    const ast2 = [
        { syl: 'a', note: 'f', role: 'intonation' },
        { syl: 'mój', note: 'h', role: 'tenor' },
        { syl: 'duch', note: 'h', role: 'acc' },
        { syl: '', note: '|', role: 'mediant' },
        { syl: 'ja', note: 'h', role: 'tenor' },
        { syl: 'sá', note: 'k', role: 'acc' },
        { syl: 'vi', note: 'j.', role: 'fin' },
    ];
    const wordMap2 = [0, 1, 2, null, 3, 3, 3];

    const state = {
        stanzas: [
            { ast: [], wordMap: [] }, // verse 1 — always skipped
            { ast: ast2, wordMap: wordMap2 }, // verse 2
        ],
    };

    test('intonation absent in verse 2 HTML by default', () => {
        const html = compileBreviaryHtml(state);
        assert.ok(
            !html.includes('>a<') && !html.match(/verse-text">a/),
            'intonation must not appear'
        );
    });

    test('intonation present in verse 2 HTML when repeatIntonation=true', () => {
        const html = compileBreviaryHtml(state, {}, true);
        assert.ok(html.includes('>a ') || html.match(/verse-text">a\b/), 'intonation must appear');
    });

    test('verse number wrapping is correct', () => {
        const html = compileBreviaryHtml(state, {}, true);
        assert.ok(html.includes('data-verse="2"'), 'verse 2 wrapper present');
        assert.ok(html.includes('<span class="verse-num">2.</span>'), 'verse number label present');
    });

    test('stanza with no ast is skipped', () => {
        const partialState = {
            stanzas: [
                { ast: [], wordMap: [] },
                { ast: null, wordMap: null },
            ],
        };
        const html = compileBreviaryHtml(partialState, {}, true);
        assert.strictEqual(html, '', 'empty output when stanza has no ast');
    });
});
