import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllabifyWord, syllabifyPhrase, addException } from '../../v2/js/transcriber/languages/sk/syllabifier.js';
import { codaPattern } from '../../v2/js/transcriber/languages/sk/index.js';

test('syllabifyWord: Kriste', () => assert.deepEqual(syllabifyWord('Kriste'), ['Kris', 'te']));
test('syllabifyWord: sláva', () => assert.deepEqual(syllabifyWord('sláva'), ['slá', 'va']));
test('syllabifyWord: vŕba', () => assert.deepEqual(syllabifyWord('vŕba'), ['vŕ', 'ba']));
test('syllabifyWord: chvála', () => assert.deepEqual(syllabifyWord('chvála'), ['chvá', 'la']));
test('syllabifyWord: Pane', () => assert.deepEqual(syllabifyWord('Pane'), ['Pa', 'ne']));
test('syllabifyWord: Bože', () => assert.deepEqual(syllabifyWord('Bože'), ['Bo', 'že']));
test('syllabifyWord: svätý', () => assert.deepEqual(syllabifyWord('svätý'), ['svä', 'tý']));

test('syllabifyWord: tebou (ou diphthong)', () => assert.deepEqual(syllabifyWord('tebou'), ['te', 'bou']));
test('syllabifyWord: miesto (ie diphthong)', () => assert.deepEqual(syllabifyWord('miesto'), ['mies', 'to']));
test('syllabifyWord: dieťa (ie diphthong)', () => assert.deepEqual(syllabifyWord('dieťa'), ['die', 'ťa']));
test('syllabifyWord: viac (ia diphthong, single syllable)', () => assert.deepEqual(syllabifyWord('viac'), ['viac']));
test('syllabifyWord: bielych (ie diphthong)', () => assert.deepEqual(syllabifyWord('bielych'), ['bie', 'lych']));

test('syllabifyWord: vlk (syllabic l)', () => assert.deepEqual(syllabifyWord('vlk'), ['vlk']));
test('syllabifyWord: krk (syllabic r)', () => assert.deepEqual(syllabifyWord('krk'), ['krk']));
test('syllabifyWord: prst (syllabic r)', () => assert.deepEqual(syllabifyWord('prst'), ['prst']));

function syls(phrase) {
  return syllabifyPhrase(phrase).map(t => t.syl);
}

test('syllabifyPhrase: s tebou', () => assert.deepEqual(syls('s tebou'), ['s te', 'bou']));
test('syllabifyPhrase: v sláve', () => assert.deepEqual(syls('v sláve'), ['v slá', 've']));
test('syllabifyPhrase: k Bohu', () => assert.deepEqual(syls('k Bohu'), ['k Bo', 'hu']));
test('syllabifyPhrase: z neba', () => assert.deepEqual(syls('z neba'), ['z ne', 'ba']));
test('syllabifyPhrase: o tebe (vowel word, stands alone)', () => assert.deepEqual(syls('o tebe'), ['o', 'te', 'be']));

test('syllabifyWord: machať (ch digraph fixed)', () => assert.deepEqual(syllabifyWord('machať'), ['ma', 'chať']));
test('syllabifyWord: medza (dz digraph fixed)', () => assert.deepEqual(syllabifyWord('medza'), ['me', 'dza']));
test('syllabifyWord: ucho (ch digraph between vowels)', () => assert.deepEqual(syllabifyWord('ucho'), ['u', 'cho']));
test('syllabifyWord: stĺpy', () => assert.deepEqual(syllabifyWord('stĺpy'), ['stĺ', 'py']));
test('syllabifyWord: štvrť', () => assert.deepEqual(syllabifyWord('štvrť'), ['štvrť']));
test('syllabifyWord: piatok', () => assert.deepEqual(syllabifyWord('piatok'), ['pia', 'tok']));
test('syllabifyWord: sestra (str cluster fixed)', () => assert.deepEqual(syllabifyWord('sestra'), ['ses', 'tra']));
test('syllabifyWord: demokracia', () => assert.deepEqual(syllabifyWord('demokracia'), ['de', 'mok', 'ra', 'cia']));
test('syllabifyWord: vypracovať', () => assert.deepEqual(syllabifyWord('vypracovať'), ['vyp', 'ra', 'co', 'vať']));
test('syllabifyWord: rozum', () => assert.deepEqual(syllabifyWord('rozum'), ['ro', 'zum']));
test('syllabifyWord: mestský (4-consonant cluster fixed)', () => assert.deepEqual(syllabifyWord('mestský'), ['mes', 'tský']));
test('syllabifyWord: zmŕtvychvstanie (ch digraph + cluster fixed)', () => assert.deepEqual(syllabifyWord('zmŕtvychvstanie'), ['zmŕt', 'vych', 'vsta', 'nie']));
test('syllabifyWord: najneobhospodarovávateľnejšieho', () => assert.deepEqual(syllabifyWord('najneobhospodarovávateľnejšieho'), ['naj', 'ne', 'ob', 'hos', 'po', 'da', 'ro', 'vá', 'va', 'teľ', 'nej', 'šie', 'ho']));

test('addException: overrides algorithm, case-insensitive lookup', () => {
  addException('rozum', ['roz', 'um']);
  assert.deepEqual(syllabifyWord('rozum'), ['roz', 'um']);
  assert.deepEqual(syllabifyWord('Rozum'), ['roz', 'um']);
});

test('codaPattern: Amen', () => assert.equal(codaPattern.test('Amen'), true));
test('codaPattern: amen', () => assert.equal(codaPattern.test('amen'), true));
test('codaPattern: AMEN', () => assert.equal(codaPattern.test('AMEN'), true));
test('codaPattern: Alleluia', () => assert.equal(codaPattern.test('Alleluia'), false));
test('codaPattern: amen. (pattern accepts trailing punctuation directly)', () => {
  assert.equal(codaPattern.test('amen.'), true);
  assert.equal(codaPattern.test('amen,'), true);
});

// isStressed — default (first syllable of each word)
test("isStressed: default first-syllable stress (Pane)", () => {
  const tokens = syllabifyPhrase('Pane');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false]);
});

test("isStressed: default across two words (Pane Bože)", () => {
  const tokens = syllabifyPhrase('Pane Bože');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, isStressed: t.isStressed })), [
    { syl: 'Pa',  isStressed: true  },
    { syl: 'ne',  isStressed: false },
    { syl: 'Bo',  isStressed: true  },
    { syl: 'že',  isStressed: false },
  ]);
});

// isStressed — ' override shifts stress to marked syllable
test("isStressed: ' override shifts stress to second syllable (Bo'že)", () => {
  const tokens = syllabifyPhrase("Bo'že");
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, isStressed: t.isStressed })), [
    { syl: 'Bo', isStressed: false },
    { syl: 'že', isStressed: true  },
  ]);
});

test("isStressed: ' stripped from syl output (Bo'že)", () => {
  const tokens = syllabifyPhrase("Bo'že");
  assert.deepEqual(tokens.map(t => t.syl), ['Bo', 'že']);
});

// | explicit break splits one raw token into two wordIdx values
test("control char |: dnes|ka produces two tokens with separate wordIdx", () => {
  const tokens = syllabifyPhrase('dnes|ka');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, wordIdx: t.wordIdx })), [
    { syl: 'dnes', wordIdx: 0 },
    { syl: 'ka',   wordIdx: 1 },
  ]);
});

// _ tie joins two raw tokens into one word (shared wordIdx, no space in syl)
test("control char _: k_Bohu joins into one word (syllables kBo, hu)", () => {
  const tokens = syllabifyPhrase('k_Bohu');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, wordIdx: t.wordIdx })), [
    { syl: 'kBo', wordIdx: 0 },
    { syl: 'hu',  wordIdx: 0 },
  ]);
});

// Secondary stress — words ≥ 4 syllables get stress on even-indexed syllables (0, 2, 4…)
test("isStressed: 4-syllable word stressed on syllables 0 and 2 (demokracia)", () => {
  // de-mok-ra-cia (4 syllables)
  const tokens = syllabifyPhrase('demokracia');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, true, false]);
});

test("isStressed: 3-syllable word only stressed on syllable 0 (Hospodin)", () => {
  // Hos-po-din (3 syllables) — secondary stress does NOT apply below 4 syllables
  const tokens = syllabifyPhrase('Hospodin');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, false]);
});

test("isStressed: 5-syllable word stressed on syllables 0, 2, 4 (demokraticky)", () => {
  // de-mok-ra-tic-ky (5 syllables)
  const tokens = syllabifyPhrase('demokraticky');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, true, false, true]);
});

test("isStressed: ' override suppresses secondary stress in the same word", () => {
  // Without override: "demokracia" → [T,F,T,F]
  // With "de'mokracia": apostrophe at pos 2, lands in syllable 1 ("mok") → only syl 1 stressed
  const tokens = syllabifyPhrase("de'mokracia");
  assert.deepEqual(tokens.map(t => t.isStressed), [false, true, false, false]);
});

test("isStressed: ' override on one word does not suppress secondary stress of adjacent words", () => {
  // First word overridden → only marked syl stressed; second word gets automatic secondary
  const tokens = syllabifyPhrase("de'mokracia demokracia");
  const firstWord  = tokens.filter(t => t.wordIdx === 0).map(t => t.isStressed);
  const secondWord = tokens.filter(t => t.wordIdx === 1).map(t => t.isStressed);
  assert.deepEqual(firstWord,  [false, true, false, false]);
  assert.deepEqual(secondWord, [true, false, true, false]);
});
