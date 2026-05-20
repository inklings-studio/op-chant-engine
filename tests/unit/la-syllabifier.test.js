import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LatinSyllabifier } from '../../js/languages/la/syllabifier.js';
import { codaPattern } from '../../js/languages/la/index.js';

const la = new LatinSyllabifier();

function split(word) {
    return la.syllabifyWord(word).syllables.map((s) => s.syl);
}

// ── Basic single-consonant splitting (V-CV) ──────────────────────────────────

test('syllabifyWord: amen', () => assert.deepEqual(split('amen'), ['a', 'men']));
test('syllabifyWord: Domine', () => assert.deepEqual(split('Domine'), ['Do', 'mi', 'ne']));
test('syllabifyWord: lumen', () => assert.deepEqual(split('lumen'), ['lu', 'men']));
test('syllabifyWord: pater', () => assert.deepEqual(split('pater'), ['pa', 'ter']));
test('syllabifyWord: gloria', () => assert.deepEqual(split('gloria'), ['glo', 'ri', 'a']));

// ── Double consonants — first to coda, second to onset ────────────────────────

test('syllabifyWord: omnis (mn split)', () => assert.deepEqual(split('omnis'), ['om', 'nis']));
test('syllabifyWord: ecce (cc split)', () => assert.deepEqual(split('ecce'), ['ec', 'ce']));
test('syllabifyWord: sanctus (nc+t → san+ctus)', () =>
    assert.deepEqual(split('sanctus'), ['san', 'ctus']));

// ── Muta cum liquida: stop+liquid stays with next onset ───────────────────────

test('syllabifyWord: patrem (tr = MCL, no coda before tr)', () =>
    assert.deepEqual(split('patrem'), ['pa', 'trem']));
test('syllabifyWord: Christus (st splits; chri is onset)', () =>
    assert.deepEqual(split('Christus'), ['Chri', 'stus']));
test('syllabifyWord: stabilis (bl = MCL)', () =>
    assert.deepEqual(split('stabilis'), ['sta', 'bi', 'lis']));

// ── Diphthongs ae / oe / au ──────────────────────────────────────────────────

test('syllabifyWord: caelum (ae diphthong)', () =>
    assert.deepEqual(split('caelum'), ['cae', 'lum']));
test('syllabifyWord: poenam (oe diphthong)', () =>
    assert.deepEqual(split('poenam'), ['poe', 'nam']));
test('syllabifyWord: gaudium (au diphthong)', () =>
    assert.deepEqual(split('gaudium'), ['gau', 'di', 'um']));
test('syllabifyWord: caelorum (ae diphthong)', () =>
    assert.deepEqual(split('caelorum'), ['cae', 'lo', 'rum']));

// ── Precomposed ligatures æ / œ ───────────────────────────────────────────────

test('syllabifyWord: cælum (æ ligature = ae)', () =>
    assert.deepEqual(split('cælum'), ['cæ', 'lum']));
test('syllabifyWord: pestiléntiæ (æ at end)', () =>
    assert.deepEqual(split('pestiléntiæ'), ['pe', 'sti', 'lén', 'ti', 'æ']));

// ── qu before vowel: u is not a separate nucleus ─────────────────────────────

test('syllabifyWord: qui (monosyllable)', () => assert.deepEqual(split('qui'), ['qui']));
test('syllabifyWord: quod (monosyllable)', () => assert.deepEqual(split('quod'), ['quod']));
test('syllabifyWord: aqua (a-qua)', () => assert.deepEqual(split('aqua'), ['a', 'qua']));
test('syllabifyWord: iniqui (i-ni-qui)', () =>
    assert.deepEqual(split('iniqui'), ['i', 'ni', 'qui']));

// ── ngu before vowel: u is not a separate nucleus ────────────────────────────

test('syllabifyWord: sanguis (san-guis, ngu forms onset)', () =>
    assert.deepEqual(split('sanguis'), ['san', 'guis']));

// ── hasNucleus ────────────────────────────────────────────────────────────────

test('syllabifyWord: hasNucleus true for "et"', () =>
    assert.equal(la.syllabifyWord('et').hasNucleus, true));
test('syllabifyWord: hasNucleus true for "amen"', () =>
    assert.equal(la.syllabifyWord('amen').hasNucleus, true));
test('syllabifyWord: hasNucleus true for "qui"', () =>
    assert.equal(la.syllabifyWord('qui').hasNucleus, true));

// ── Stress: precomposed accent marks the stressed syllable ───────────────────

test('isStressed: Dóminus — accent on first syllable Dó', () => {
    const tokens = la.syllabify('Dóminus');
    assert.deepEqual(
        tokens.map((t) => ({ syl: t.syl, isStressed: t.isStressed })),
        [
            { syl: 'Dó', isStressed: true },
            { syl: 'mi', isStressed: false },
            { syl: 'nus', isStressed: false },
        ]
    );
});

test('isStressed: beátus — accent on second syllable á', () => {
    const tokens = la.syllabify('beátus');
    assert.deepEqual(
        tokens.map((t) => ({ syl: t.syl, isStressed: t.isStressed })),
        [
            { syl: 'be', isStressed: false },
            { syl: 'á', isStressed: true },
            { syl: 'tus', isStressed: false },
        ]
    );
});

test('isStressed: pestiléntiæ — accent on lén', () => {
    const tokens = la.syllabify('pestiléntiæ');
    const stressed = tokens.filter((t) => t.isStressed).map((t) => t.syl);
    assert.deepEqual(stressed, ['lén']);
});

test('isStressed: Dómini — accent on first syllable', () => {
    const tokens = la.syllabify('Dómini');
    assert.deepEqual(
        tokens.map((t) => t.isStressed),
        [true, false, false]
    );
});

// ── Stress: combining accent U+0301 ──────────────────────────────────────────

test('isStressed: combining accent marks the syllable as stressed', () => {
    // ámen = 'a' + combining accent + 'men'
    const tokens = la.syllabify('ámen');
    assert.equal(tokens[0].isStressed, true, 'first syllable (á) must be stressed');
    assert.equal(tokens[1].isStressed, false);
});

// ── Stress default (no accent mark): penultimate ─────────────────────────────

test('isStressed: amen (no accent) — penultimate = first syllable', () => {
    const tokens = la.syllabify('amen');
    assert.deepEqual(
        tokens.map((t) => t.isStressed),
        [true, false]
    );
});

test('isStressed: caelum (no accent) — penultimate = first syllable', () => {
    const tokens = la.syllabify('caelum');
    assert.deepEqual(
        tokens.map((t) => t.isStressed),
        [true, false]
    );
});

// ── Monosyllable always stressed ─────────────────────────────────────────────

test('isStressed: et (monosyllable) always stressed', () => {
    assert.equal(la.syllabify('et')[0].isStressed, true);
});

test('isStressed: in (monosyllable) always stressed', () => {
    assert.equal(la.syllabify('in')[0].isStressed, true);
});

// ── Phrase-level: mediant marker * survives syllabification ──────────────────
// (No direct syllabifyWord test; the pointer strips * before calling syllabify)

// ── codaPattern ──────────────────────────────────────────────────────────────

test('codaPattern: Amen', () => assert.equal(codaPattern.test('Amen'), true));
test('codaPattern: amen', () => assert.equal(codaPattern.test('amen'), true));
test('codaPattern: AMEN', () => assert.equal(codaPattern.test('AMEN'), true));
test('codaPattern: amen. (trailing punctuation)', () =>
    assert.equal(codaPattern.test('amen.'), true));
test('codaPattern: Alleluia (not a coda)', () => assert.equal(codaPattern.test('Alleluia'), false));
test('codaPattern: Dominus (not a coda)', () => assert.equal(codaPattern.test('Dominus'), false));
