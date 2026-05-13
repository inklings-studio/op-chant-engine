import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlovakSyllabifier } from '../../js/languages/sk/syllabifier.js';
import { codaPattern } from '../../js/languages/sk/index.js';

const sk = new SlovakSyllabifier();

// Helper: extract just the syllable strings from syllabifyWord
function split(word) {
  return sk.syllabifyWord(word).syllables.map(s => s.syl);
}

test('syllabifyWord: Kriste', () => assert.deepEqual(split('Kriste'), ['Kris', 'te']));
test('syllabifyWord: sláva', () => assert.deepEqual(split('sláva'), ['slá', 'va']));
test('syllabifyWord: vŕba', () => assert.deepEqual(split('vŕba'), ['vŕ', 'ba']));
test('syllabifyWord: chvála', () => assert.deepEqual(split('chvála'), ['chvá', 'la']));
test('syllabifyWord: Pane', () => assert.deepEqual(split('Pane'), ['Pa', 'ne']));
test('syllabifyWord: Bože', () => assert.deepEqual(split('Bože'), ['Bo', 'že']));
test('syllabifyWord: svätý', () => assert.deepEqual(split('svätý'), ['svä', 'tý']));

test('syllabifyWord: tebou (ou diphthong)', () => assert.deepEqual(split('tebou'), ['te', 'bou']));
test('syllabifyWord: miesto (ie diphthong)', () => assert.deepEqual(split('miesto'), ['mies', 'to']));
test('syllabifyWord: dieťa (ie diphthong)', () => assert.deepEqual(split('dieťa'), ['die', 'ťa']));
test('syllabifyWord: viac (ia diphthong, single syllable)', () => assert.deepEqual(split('viac'), ['viac']));
test('syllabifyWord: bielych (ie diphthong)', () => assert.deepEqual(split('bielych'), ['bie', 'lych']));

test('syllabifyWord: vlk (syllabic l)', () => assert.deepEqual(split('vlk'), ['vlk']));
test('syllabifyWord: krk (syllabic r)', () => assert.deepEqual(split('krk'), ['krk']));
test('syllabifyWord: prst (syllabic r)', () => assert.deepEqual(split('prst'), ['prst']));

test('syllabifyWord: hasNucleus true for vowel word', () => assert.equal(sk.syllabifyWord('tebou').hasNucleus, true));
test('syllabifyWord: hasNucleus true for syllabic consonant (vlk)', () => assert.equal(sk.syllabifyWord('vlk').hasNucleus, true));
test('syllabifyWord: hasNucleus false for consonant-only preposition (v)', () => assert.equal(sk.syllabifyWord('v').hasNucleus, false));
test('syllabifyWord: hasNucleus false for consonant-only preposition (s)', () => assert.equal(sk.syllabifyWord('s').hasNucleus, false));

function syls(phrase) {
  return sk.syllabify(phrase).map(t => t.syl);
}

test('syllabify: s tebou', () => assert.deepEqual(syls('s tebou'), ['s te', 'bou']));
test('syllabify: v sláve', () => assert.deepEqual(syls('v sláve'), ['v slá', 've']));
test('syllabify: k Bohu', () => assert.deepEqual(syls('k Bohu'), ['k Bo', 'hu']));
test('syllabify: z neba', () => assert.deepEqual(syls('z neba'), ['z ne', 'ba']));
test('syllabify: o tebe (vowel word, stands alone)', () => assert.deepEqual(syls('o tebe'), ['o', 'te', 'be']));

test('syllabifyWord: machať (ch digraph fixed)', () => assert.deepEqual(split('machať'), ['ma', 'chať']));
test('syllabifyWord: medza (dz digraph fixed)', () => assert.deepEqual(split('medza'), ['me', 'dza']));
test('syllabifyWord: ucho (ch digraph between vowels)', () => assert.deepEqual(split('ucho'), ['u', 'cho']));
test('syllabifyWord: stĺpy', () => assert.deepEqual(split('stĺpy'), ['stĺ', 'py']));
test('syllabifyWord: štvrť', () => assert.deepEqual(split('štvrť'), ['štvrť']));
test('syllabifyWord: piatok', () => assert.deepEqual(split('piatok'), ['pia', 'tok']));
test('syllabifyWord: sestra (str cluster fixed)', () => assert.deepEqual(split('sestra'), ['ses', 'tra']));
test('syllabifyWord: demokracia', () => assert.deepEqual(split('demokracia'), ['de', 'mok', 'ra', 'cia']));
test('syllabifyWord: vypracovať', () => assert.deepEqual(split('vypracovať'), ['vyp', 'ra', 'co', 'vať']));
test('syllabifyWord: rozum', () => assert.deepEqual(split('rozum'), ['ro', 'zum']));
test('syllabifyWord: mestský (4-consonant cluster fixed)', () => assert.deepEqual(split('mestský'), ['mes', 'tský']));
test('syllabifyWord: zmŕtvychvstanie (ch digraph + cluster fixed)', () => assert.deepEqual(split('zmŕtvychvstanie'), ['zmŕt', 'vych', 'vsta', 'nie']));
test('syllabifyWord: najneobhospodarovávateľnejšieho', () => assert.deepEqual(split('najneobhospodarovávateľnejšieho'), ['naj', 'ne', 'ob', 'hos', 'po', 'da', 'ro', 'vá', 'va', 'teľ', 'nej', 'šie', 'ho']));

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
  const tokens = sk.syllabify('Pane');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false]);
});

test("isStressed: default across two words (Pane Bože)", () => {
  const tokens = sk.syllabify('Pane Bože');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, isStressed: t.isStressed })), [
    { syl: 'Pa', isStressed: true },
    { syl: 'ne', isStressed: false },
    { syl: 'Bo', isStressed: true },
    { syl: 'že', isStressed: false },
  ]);
});

// | in-word split: two chips, same wordIdx → no GABC space between them
test("control char |: dnes|ka produces two chips with the same wordIdx (no GABC space)", () => {
  const tokens = sk.syllabify('dnes|ka');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, wordIdx: t.wordIdx })), [
    { syl: 'dnes', wordIdx: 0 },
    { syl: 'ka', wordIdx: 0 },
  ]);
});

test("control char |: Slo|ven|sku produces three chips all with the same wordIdx", () => {
  const tokens = sk.syllabify('Slo|ven|sku');
  assert.equal(tokens.length, 3);
  assert.ok(tokens.every(t => t.wordIdx === tokens[0].wordIdx), 'all share wordIdx');
  assert.deepEqual(tokens.map(t => t.syl), ['Slo', 'ven', 'sku']);
});

// | secondary stress: same rule as syllabifyWord — first syl + even indices for words ≥ 4 parts.
test("control char |: 2-part word — only first part is stressed (dnes|ka)", () => {
  const tokens = sk.syllabify('dnes|ka');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false]);
});

test("control char |: 3-part word — only first part is stressed (Slo|ven|sku)", () => {
  const tokens = sk.syllabify('Slo|ven|sku');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, false]);
});

test("control char |: 5-part word — secondary stress on even indices (spra|vod|li|vé|ho)", () => {
  const tokens = sk.syllabify('spra|vod|li|vé|ho');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, true, false, true]);
});

// _ semantic tie: ALL joined fragments collapse into ONE chip / ONE melody note.
test("control char _: a_po ties into one chip (one melody note)", () => {
  const tokens = sk.syllabify('a_po');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].syl, 'a po');
  assert.equal(tokens[0].wordIdx, 0);
});

test("control char _: 'a _ po' (spaces around _) behaves identically to a_po", () => {
  const tokens = sk.syllabify('a _ po');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].syl, 'a po');
});

test("control char _: k_Bohu ties k + Bo + hu into one chip", () => {
  const tokens = sk.syllabify('k_Bohu');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].syl, 'k Bo hu');
  assert.equal(tokens[0].wordIdx, 0);
});

// Secondary stress — words ≥ 4 syllables get stress on even-indexed syllables (0, 2, 4…)
test("isStressed: 4-syllable word stressed on syllables 0 and 2 (demokracia)", () => {
  const tokens = sk.syllabify('demokracia');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, true, false]);
});

test("isStressed: 3-syllable word only stressed on syllable 0 (Hospodin)", () => {
  const tokens = sk.syllabify('Hospodin');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, false]);
});

test("isStressed: 5-syllable word stressed on syllables 0, 2, 4 (demokraticky)", () => {
  const tokens = sk.syllabify('demokraticky');
  assert.deepEqual(tokens.map(t => t.isStressed), [true, false, true, false, true]);
});

// ── UNSTRESSED_MONOSYLLABLES ──────────────────────────────────────────────────

// Conjunctions
test("isStressed: conjunction 'a' is always unstressed", () => {
  assert.equal(sk.syllabify('a').at(0).isStressed, false);
});
test("isStressed: conjunction 'i' is always unstressed", () => {
  assert.equal(sk.syllabify('i').at(0).isStressed, false);
});
test("isStressed: conjunction 'aj' is always unstressed", () => {
  assert.equal(sk.syllabify('aj').at(0).isStressed, false);
});
test("isStressed: conjunction 'že' is always unstressed", () => {
  assert.equal(sk.syllabify('že').at(0).isStressed, false);
});

// Short pronouns / auxiliary verbs
test("isStressed: pronoun 'sa' is always unstressed", () => {
  assert.equal(sk.syllabify('sa').at(0).isStressed, false);
});
test("isStressed: pronoun/aux 'si' is always unstressed", () => {
  assert.equal(sk.syllabify('si').at(0).isStressed, false);
});
test("isStressed: pronoun 'mi' is always unstressed", () => {
  assert.equal(sk.syllabify('mi').at(0).isStressed, false);
});
test("isStressed: pronoun 'ti' is always unstressed", () => {
  assert.equal(sk.syllabify('ti').at(0).isStressed, false);
});
test("isStressed: pronoun 'ho' is always unstressed", () => {
  assert.equal(sk.syllabify('ho').at(0).isStressed, false);
});
test("isStressed: pronoun 'mu' is always unstressed", () => {
  assert.equal(sk.syllabify('mu').at(0).isStressed, false);
});
test("isStressed: pronoun 'ju' is always unstressed", () => {
  assert.equal(sk.syllabify('ju').at(0).isStressed, false);
});
test("isStressed: pronoun 'ich' is always unstressed", () => {
  assert.equal(sk.syllabify('ich').at(0).isStressed, false);
});
test("isStressed: aux 'som' is always unstressed", () => {
  assert.equal(sk.syllabify('som').at(0).isStressed, false);
});
test("isStressed: aux 'je' is always unstressed", () => {
  assert.equal(sk.syllabify('je').at(0).isStressed, false);
});
test("isStressed: aux 'by' is always unstressed", () => {
  assert.equal(sk.syllabify('by').at(0).isStressed, false);
});

// Syllabic prepositions
test("isStressed: preposition 'o' is always unstressed", () => {
  assert.equal(sk.syllabify('o').at(0).isStressed, false);
});
test("isStressed: preposition 'u' is always unstressed", () => {
  assert.equal(sk.syllabify('u').at(0).isStressed, false);
});
test("isStressed: preposition 'do' is always unstressed", () => {
  assert.equal(sk.syllabify('do').at(0).isStressed, false);
});
test("isStressed: preposition 'na' is always unstressed", () => {
  assert.equal(sk.syllabify('na').at(0).isStressed, false);
});
test("isStressed: preposition 'za' is always unstressed", () => {
  assert.equal(sk.syllabify('za').at(0).isStressed, false);
});
test("isStressed: preposition 'pri' is always unstressed", () => {
  assert.equal(sk.syllabify('pri').at(0).isStressed, false);
});
test("isStressed: preposition 'po' is always unstressed", () => {
  assert.equal(sk.syllabify('po').at(0).isStressed, false);
});
test("isStressed: preposition 'vo' is always unstressed", () => {
  assert.equal(sk.syllabify('vo').at(0).isStressed, false);
});
test("isStressed: preposition 'zo' is always unstressed", () => {
  assert.equal(sk.syllabify('zo').at(0).isStressed, false);
});
test("isStressed: preposition 'so' is always unstressed", () => {
  assert.equal(sk.syllabify('so').at(0).isStressed, false);
});
test("isStressed: preposition 'ku' is always unstressed", () => {
  assert.equal(sk.syllabify('ku').at(0).isStressed, false);
});

// Capitalised forms also match (case-insensitive lookup)
test("isStressed: capitalised 'Na' (sentence-initial preposition) is still unstressed", () => {
  assert.equal(sk.syllabify('Na').at(0).isStressed, false);
});
test("isStressed: capitalised 'Je' (sentence-initial aux) is still unstressed", () => {
  assert.equal(sk.syllabify('Je').at(0).isStressed, false);
});

// Multi-syllable words starting with these character sequences are NOT affected
test("isStressed: 'naozaj' (starts with 'na') remains stressed on first syllable", () => {
  const tokens = sk.syllabify('naozaj');
  assert.equal(tokens[0].isStressed, true, 'first syllable of polysyllabic word is still stressed');
});

// Unstressed function word in context: does not disrupt adjacent word stress
test("isStressed: 'kráľ a Boh' — a is unstressed, kráľ and Boh remain stressed", () => {
  const tokens = sk.syllabify('kráľ a Boh');
  assert.deepEqual(tokens.map(t => ({ syl: t.syl, isStressed: t.isStressed })), [
    { syl: 'kráľ', isStressed: true  },
    { syl: 'a',    isStressed: false },
    { syl: 'Boh',  isStressed: true  },
  ]);
});
