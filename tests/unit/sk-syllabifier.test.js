import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllabifyWord, syllabifyPhrase, addException } from '../../v2/js/languages/sk/syllabifier.js';
import { codaPattern } from '../../v2/js/languages/sk/index.js';

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
    { syl: 'Pa', isStressed: true },
    { syl: 'ne', isStressed: false },
    { syl: 'Bo', isStressed: true },
    { syl: 'že', isStressed: false },
  ]);
});

// | in-word split: two chips, same wordIdx → no GABC space between them
test("control char |: dnes|ka produces two chips with the same wordIdx (no GABC space)", () => {
  const tokens = syllabifyPhrase('dnes|ka');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, wordIdx: t.wordIdx })), [
    { syl: 'dnes', wordIdx: 0 },
    { syl: 'ka', wordIdx: 0 },
  ]);
});

test("control char |: Slo|ven|sku produces three chips all with the same wordIdx", () => {
  const tokens = syllabifyPhrase('Slo|ven|sku');
  assert.equal(tokens.length, 3);
  assert.ok(tokens.every(t => t.wordIdx === tokens[0].wordIdx), 'all share wordIdx');
  assert.deepEqual(tokens.map(t => t.syl), ['Slo', 'ven', 'sku']);
});

// | secondary stress: same rule as syllabifyWord — first syl + even indices for words ≥ 4 parts.
// This matters because _buildStanza round-trips through marked rawLines (with | injected),
// so on re-point the PIPE path must produce the same stress pattern as the original algorithm.
test("control char |: 2-part word — only first part is stressed (dnes|ka)", () => {
  const tokens = syllabifyPhrase('dnes|ka');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false]);
});

test("control char |: 3-part word — only first part is stressed (Slo|ven|sku)", () => {
  const tokens = syllabifyPhrase('Slo|ven|sku');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, false]);
});

test("control char |: 5-part word — secondary stress on even indices (spra|vod|li|vé|ho)", () => {
  // Mirrors automatic stress for 'spravodlivého' → [T,F,T,F,T]
  // so that round-tripping through a marked rawLine preserves accent placement.
  const tokens = syllabifyPhrase('spra|vod|li|vé|ho');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, true, false, true]);
});

// _ semantic tie: ALL joined fragments collapse into ONE chip / ONE melody note.
// Surrounding whitespace is consumed, so "a _ po" and "a_po" behave identically.
test("control char _: a_po ties into one chip (one melody note)", () => {
  const tokens = syllabifyPhrase('a_po');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].syl, 'a po');
  assert.equal(tokens[0].wordIdx, 0);
});

test("control char _: 'a _ po' (spaces around _) behaves identically to a_po", () => {
  const tokens = syllabifyPhrase('a _ po');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].syl, 'a po');
});

test("control char _: k_Bohu ties k + Bo + hu into one chip", () => {
  const tokens = syllabifyPhrase('k_Bohu');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].syl, 'k Bo hu');
  assert.equal(tokens[0].wordIdx, 0);
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

// ── UNSTRESSED_MONOSYLLABLES ──────────────────────────────────────────────────

// Conjunctions
test("isStressed: conjunction 'a' is always unstressed", () => {
  assert.equal(syllabifyPhrase('a').at(0).isStressed, false);
});
test("isStressed: conjunction 'i' is always unstressed", () => {
  assert.equal(syllabifyPhrase('i').at(0).isStressed, false);
});
test("isStressed: conjunction 'aj' is always unstressed", () => {
  assert.equal(syllabifyPhrase('aj').at(0).isStressed, false);
});
test("isStressed: conjunction 'že' is always unstressed", () => {
  assert.equal(syllabifyPhrase('že').at(0).isStressed, false);
});

// Short pronouns / auxiliary verbs
test("isStressed: pronoun 'sa' is always unstressed", () => {
  assert.equal(syllabifyPhrase('sa').at(0).isStressed, false);
});
test("isStressed: pronoun/aux 'si' is always unstressed", () => {
  assert.equal(syllabifyPhrase('si').at(0).isStressed, false);
});
test("isStressed: pronoun 'mi' is always unstressed", () => {
  assert.equal(syllabifyPhrase('mi').at(0).isStressed, false);
});
test("isStressed: pronoun 'ti' is always unstressed", () => {
  assert.equal(syllabifyPhrase('ti').at(0).isStressed, false);
});
test("isStressed: pronoun 'ho' is always unstressed", () => {
  assert.equal(syllabifyPhrase('ho').at(0).isStressed, false);
});
test("isStressed: pronoun 'mu' is always unstressed", () => {
  assert.equal(syllabifyPhrase('mu').at(0).isStressed, false);
});
test("isStressed: pronoun 'ju' is always unstressed", () => {
  assert.equal(syllabifyPhrase('ju').at(0).isStressed, false);
});
test("isStressed: pronoun 'ich' is always unstressed", () => {
  assert.equal(syllabifyPhrase('ich').at(0).isStressed, false);
});
test("isStressed: aux 'som' is always unstressed", () => {
  assert.equal(syllabifyPhrase('som').at(0).isStressed, false);
});
test("isStressed: aux 'je' is always unstressed", () => {
  assert.equal(syllabifyPhrase('je').at(0).isStressed, false);
});
test("isStressed: aux 'by' is always unstressed", () => {
  assert.equal(syllabifyPhrase('by').at(0).isStressed, false);
});

// Syllabic prepositions
test("isStressed: preposition 'o' is always unstressed", () => {
  assert.equal(syllabifyPhrase('o').at(0).isStressed, false);
});
test("isStressed: preposition 'u' is always unstressed", () => {
  assert.equal(syllabifyPhrase('u').at(0).isStressed, false);
});
test("isStressed: preposition 'do' is always unstressed", () => {
  assert.equal(syllabifyPhrase('do').at(0).isStressed, false);
});
test("isStressed: preposition 'na' is always unstressed", () => {
  assert.equal(syllabifyPhrase('na').at(0).isStressed, false);
});
test("isStressed: preposition 'za' is always unstressed", () => {
  assert.equal(syllabifyPhrase('za').at(0).isStressed, false);
});
test("isStressed: preposition 'pri' is always unstressed", () => {
  assert.equal(syllabifyPhrase('pri').at(0).isStressed, false);
});
test("isStressed: preposition 'po' is always unstressed", () => {
  assert.equal(syllabifyPhrase('po').at(0).isStressed, false);
});
test("isStressed: preposition 'vo' is always unstressed", () => {
  assert.equal(syllabifyPhrase('vo').at(0).isStressed, false);
});
test("isStressed: preposition 'zo' is always unstressed", () => {
  assert.equal(syllabifyPhrase('zo').at(0).isStressed, false);
});
test("isStressed: preposition 'so' is always unstressed", () => {
  assert.equal(syllabifyPhrase('so').at(0).isStressed, false);
});
test("isStressed: preposition 'ku' is always unstressed", () => {
  assert.equal(syllabifyPhrase('ku').at(0).isStressed, false);
});

// Capitalised forms also match (case-insensitive lookup)
test("isStressed: capitalised 'Na' (sentence-initial preposition) is still unstressed", () => {
  assert.equal(syllabifyPhrase('Na').at(0).isStressed, false);
});
test("isStressed: capitalised 'Je' (sentence-initial aux) is still unstressed", () => {
  assert.equal(syllabifyPhrase('Je').at(0).isStressed, false);
});

// Multi-syllable words starting with these character sequences are NOT affected
test("isStressed: 'naozaj' (starts with 'na') remains stressed on first syllable", () => {
  // naozaj → na-o-zaj (3 syllables); only the monosyllabic standalone 'na' is suppressed
  const tokens = syllabifyPhrase('naozaj');
  assert.equal(tokens[0].isStressed, true, 'first syllable of polysyllabic word is still stressed');
});

// Unstressed function word in context: does not disrupt adjacent word stress
test("isStressed: 'kráľ a Boh' — a is unstressed, kráľ and Boh remain stressed", () => {
  const tokens = syllabifyPhrase('kráľ a Boh');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, isStressed: t.isStressed })), [
    { syl: 'kráľ', isStressed: true  },
    { syl: 'a',    isStressed: false },
    { syl: 'Boh',  isStressed: true  },
  ]);
});
