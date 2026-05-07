import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointVerse, alignChunk } from '../../js/psalms/pointer.js';
import { tone8 } from '../../js/tones/dominican.js';
import { syllabifyPhrase } from '../../js/languages/sk/syllabifier.js';

// ── Mediant accent placement ───────────────────────────────────────────────────

// "Hospodin je môj pastier * a nič mi nechýba"
// Mediant: "Hospodin je môj pastier" → Hos po din je môj pas tier (7 tokens)
// Tone 8 mediant cadence: [{acc:"k"},{ep:"j"},{fin:"j."}], intonation: ["g","h"]
//
// Right-to-left with ep-skip rule:
//   fin: tier
//   ep:  pas — stressed → skip (acc slot remains)
//   acc: pas(★) → acc(k)
//   remaining: Hos=intonation(g), po=intonation(h), din je môj = tenor
//
// Correct: accent lands on "pas" (primary stress of "pastier"), not on "môj".
test('pointVerse: tone8 mediant – acc lands on primary stress of last word (pastier)', () => {
  const tokens = pointVerse(
    'Hospodin je môj pastier * a nič mi nechýba',
    tone8, 'G', false, syllabifyPhrase
  );

  const mediantTokens = tokens.slice(0, 7);
  const last3 = mediantTokens.slice(-3);

  assert.deepEqual(last3, [
    { syl: 'môj',  note: 'j',  role: 'tenor' },
    { syl: 'pas',  note: 'k',  role: 'acc'   },
    { syl: 'tier', note: 'j.', role: 'fin'   },
  ]);
});

// ── Flex chunk roles ───────────────────────────────────────────────────────────

// "Chváľte Pána † lebo je dobrý * aleluja"
// Flex: "Chváľte Pána" → Chváľ(★) te Pa(★) ná (4 tokens)
// Flex cadence: [{acc:"h"},{ep:"h"},{fin:"h."}]
//
// Right-to-left with ep-skip rule:
//   fin: ná
//   ep:  Pa — stressed → skip (acc slot remains)
//   acc: Pa(★) → acc(h)
//   remaining: Chváľ te → tenor
//
// Correct: accent lands on "Pa" (primary stress of "Pána").
test('pointVerse: tone8 flex – acc lands on primary stress of last flex word (Pána)', () => {
  const tokens = pointVerse(
    'Chváľte Pána † lebo je dobrý * aleluja',
    tone8, 'G', false, syllabifyPhrase
  );

  const flexTokens = tokens.slice(0, 4);
  assert.deepEqual(flexTokens.map(t => t.role), ['tenor', 'tenor', 'acc', 'fin']);
  assert.deepEqual(flexTokens.map(t => t.note), ['j', 'j', 'j', 'h.']);
});

// ── Proparoxytone: ep IS used ──────────────────────────────────────────────────

// When the last word is proparoxytone (stress on antepenultimate), ep is used correctly.
// "a nič mi nechýba" termination: ne(★) chý ba
// Term G: [{prep:"i"},{prep:"j"},{acc:"h"},{ep:"g"},{fin:"g."}]
//   fin: ba
//   ep:  chý — NOT stressed → ep assigned (no skip)
//   acc: ne(★) → acc(h)
//   prep(j): mi (unstressed) → prep; prep(i): nič → prep
test('pointVerse: proparoxytone last word — ep correctly used (nechýba)', () => {
  const tokens = pointVerse('* a nič mi nechýba', tone8, 'G', false, syllabifyPhrase);
  const acc = tokens.find(t => t.role === 'acc');
  const ep  = tokens.find(t => t.role === 'ep');
  const fin = tokens.find(t => t.role === 'fin');
  assert.equal(acc?.syl, 'ne',  'acc on "ne" (primary stress of nechýba)');
  assert.equal(ep?.syl,  'chý', 'ep on "chý" (unstressed middle syllable)');
  assert.equal(fin?.syl, 'ba',  'fin on "ba"');
});

// ── Paroxytone: ep skipped, acc takes penultimate ──────────────────────────────

// When the last word is paroxytone (stress on penultimate), ep is skipped.
// "a nič mi čakám" termination: ča(★) kám
// Term G: [{prep:"i"},{prep:"j"},{acc:"h"},{ep:"g"},{fin:"g."}]
//   fin: kám
//   ep:  ča — stressed → skip (acc slot remains)
//   acc: ča(★) → acc(h)
//   prep(j): mi (unstressed) → prep
//   prep(i): nič (stressed, no acc left) → prep
test('pointVerse: paroxytone last word — ep skipped, acc on stressed penultimate (čakám)', () => {
  const tokens = pointVerse('* a nič mi čakám', tone8, 'G', false, syllabifyPhrase);
  const acc  = tokens.find(t => t.role === 'acc');
  const ep   = tokens.find(t => t.role === 'ep');
  const fin  = tokens.find(t => t.role === 'fin');
  const prep = tokens.find(t => t.role === 'prep');
  assert.equal(acc?.syl,  'ča',  'acc on "ča" (primary stress of čakám)');
  assert.ok(!ep,                 'ep slot skipped for paroxytone word');
  assert.equal(fin?.syl,  'kám', 'fin on "kám"');
  assert.equal(prep?.syl, 'nič', 'first prep on "nič"');
});

// ── Secondary stress ───────────────────────────────────────────────────────────

// "demokraticky *" mediant: de(★) mok ra(★) tic ky(★) — 5 syllables with secondary stress
// Mediant cadence: [{acc:"k"},{ep:"j"},{fin:"j."}]
//   fin: ky(★) ← unconditional
//   ep:  tic — not stressed → assigned (no skip)
//   acc: ra(★) (secondary) → acc(k)
//   de mok → intonation g, h
test('pointVerse: secondary stress — acc falls on "ra" (secondary), not "de" (primary)', () => {
  const tokens = pointVerse('demokraticky * lebo', tone8, 'G', false, syllabifyPhrase);
  const mediant = tokens.slice(0, 5);
  assert.equal(mediant.find(t => t.role === 'acc')?.syl, 'ra',
    'secondary stress at syl 2 is rightmost stressed; acc should land there, not on syl 0');
});

// ── isFirstVerse: intonation suppressed on subsequent verses ─────────────────

// isFirstVerse=true (default): leftover syllables get intonation notes for the first N.
// isFirstVerse=false: all leftover syllables become tenor.
test('pointVerse: isFirstVerse=false — intonation syllables become tenor', () => {
  const verse = 'Hospodin je môj pastier * a nič mi nechýba';
  const first  = pointVerse(verse, tone8, 'G', false, syllabifyPhrase, true);
  const later  = pointVerse(verse, tone8, 'G', false, syllabifyPhrase, false);

  // Mediant "Hospodin je môj pastier" → Hos po din je môj pas tier
  // First two tokens (Hos, po) get intonation on verse 1; tenor on verse 2+
  assert.equal(first[0].role,  'intonation', 'first verse: Hos is intonation');
  assert.equal(first[0].note,  'g',          'first verse: Hos note is g');
  assert.equal(first[1].role,  'intonation', 'first verse: po is intonation');
  assert.equal(first[1].note,  'h',          'first verse: po note is h');

  assert.equal(later[0].role, 'tenor', 'later verse: Hos is tenor');
  assert.equal(later[0].note, 'j',     'later verse: Hos note is tenor j');
  assert.equal(later[1].role, 'tenor', 'later verse: po is tenor');
});

// ── Barline sentinels ─────────────────────────────────────────────────────────

// Verse with flex and mediant: both barline sentinels must appear in output.
// The flex sentinel (role:'flex', note:',') must immediately follow flex tokens.
// The mediant sentinel (role:'mediant', note:';') must immediately follow mediant tokens.
test('pointVerse: barline sentinels emitted after flex and mediant sections', () => {
  const tokens = pointVerse(
    'Chváľte Pána † lebo je dobrý * aleluja',
    tone8, 'G', false, syllabifyPhrase
  );

  const flexBarlineIdx  = tokens.findIndex(t => t.role === 'flex');
  const mediantBarlineIdx = tokens.findIndex(t => t.role === 'mediant');

  assert.ok(flexBarlineIdx > 0,  'flex barline sentinel must follow flex tokens');
  assert.ok(mediantBarlineIdx > flexBarlineIdx, 'mediant barline sentinel must follow flex barline');
  assert.equal(tokens[flexBarlineIdx].note,   ',', 'flex barline note is comma (small pause)');
  assert.equal(tokens[flexBarlineIdx].syl,    '',  'flex barline syl is empty');
  assert.equal(tokens[mediantBarlineIdx].note, ':', 'mediant barline note is colon (medium pause)');
  assert.equal(tokens[mediantBarlineIdx].syl,  '',  'mediant barline syl is empty');
});

// ── Unstressed monosyllables: conjunction 'a' does not steal acc ──────────────

// "kráľ a Boh" termination G: kráľ(★) a(✗) Boh(★)
// Term G: [{prep:"i"},{acc:"j"},{ep:"h"},{fin:"g."}]
//
// Before fix: 'a' was stressed → ep saw stress and skipped → acc landed on 'a' (WRONG)
// After fix:  'a' is unstressed → ep claims 'a' → acc scans left and lands on 'kráľ' (CORRECT)
//
// Right-to-left:
//   fin:  Boh
//   ep:   a (unstressed → ep takes it, no skip)
//   acc:  kráľ (stressed → anchor)
//   prep: no tokens left → dropped
test('pointVerse: tone8 termG – unstressed "a" does not steal acc; acc lands on kráľ', () => {
  const tokens = pointVerse('* kráľ a Boh', tone8, 'G', false, syllabifyPhrase);
  assert.equal(tokens.find(t => t.role === 'acc')?.syl,  'kráľ', 'acc on "kráľ"');
  assert.equal(tokens.find(t => t.role === 'ep')?.syl,   'a',    'ep on "a" (unstressed bridge)');
  assert.equal(tokens.find(t => t.role === 'fin')?.syl,  'Boh',  'fin on "Boh"');
});

// Pipe-split round-trip: after _buildStanza injects | markers, re-pointing must produce
// the same acc placement as the original point.  Secondary stress must fire in the PIPE path.
//
// 'spra|vod|li|vé|ho,' — 5 parts → stress [T,F,T,F,T]; li is stressed.
// Term G: [{prep:"i"},{acc:"j"},{ep:"h"},{fin:"g."}]
//   fin:  ho,
//   ep:   vé (unstressed → no skip)
//   acc:  li  (stressed — secondary stress applied)  ← was landing on spra before fix
test('pointVerse: tone8 termG – pipe-split 5-syllable word places acc on secondary stress (li), not first syllable (spra)', () => {
  const tokens = pointVerse('* spra|vod|li|vé|ho,', tone8, 'G', false, syllabifyPhrase);
  assert.equal(tokens.find(t => t.role === 'acc')?.syl,  'li',   'acc on "li" (secondary stress at pi=2)');
  assert.equal(tokens.find(t => t.role === 'ep')?.syl,   'vé',   'ep on "vé"');
  assert.equal(tokens.find(t => t.role === 'fin')?.syl,  'ho,',  'fin on "ho,"');
});

// "mi nechýba" — 'mi' is unstressed; acc still lands on 'ne' (primary stress of nechýba)
// Term G: [{prep:"i"},{acc:"j"},{ep:"h"},{fin:"g."}]
//   fin:  ba
//   ep:   chý (unstressed → no skip)
//   acc:  ne (stressed)
//   prep: mi (unstressed function word)
test('pointVerse: tone8 termG – unstressed "mi" fills prep slot; acc on "ne" (nechýba)', () => {
  const tokens = pointVerse('* mi nechýba', tone8, 'G', false, syllabifyPhrase);
  assert.equal(tokens.find(t => t.role === 'acc')?.syl,  'ne',  'acc on "ne"');
  assert.equal(tokens.find(t => t.role === 'ep')?.syl,   'chý', 'ep on "chý"');
  assert.equal(tokens.find(t => t.role === 'fin')?.syl,  'ba',  'fin on "ba"');
  assert.equal(tokens.find(t => t.role === 'prep')?.syl, 'mi',  'prep on "mi"');
});

// Verse with no flex: only mediant barline appears.
test('pointVerse: mediant-only verse emits only mediant barline sentinel', () => {
  const tokens = pointVerse(
    'Hospodin je môj pastier * a nič mi nechýba',
    tone8, 'G', false, syllabifyPhrase
  );

  const flexCount    = tokens.filter(t => t.role === 'flex').length;
  const mediantCount = tokens.filter(t => t.role === 'mediant').length;

  assert.equal(flexCount,    0, 'no flex barline for a verse without †');
  assert.equal(mediantCount, 1, 'exactly one mediant barline sentinel');
});

// ── Intonation guard: requires leftover > intonation.length ──────────────────
//
// The guard prevents intonation from swallowing all remaining positions when
// there is no tenor note left after intonation would be placed.
// Rule: apply intonation only when (leftover positions) > intonation.length.

// cadence = [{acc:'k'},{fin:'j.'}], 4 tokens → fin=D, acc=C★ → 2 leftover (A, B)
// intonation = ['x','y'] (2 notes) → 2 > 2 is FALSE → no intonation; all tenor.
test('alignChunk: 2-note intonation with exactly 2 leftover positions → all tenor (guard prevents intonation)', () => {
  const tokens = [
    { syl: 'A', isStressed: true  },
    { syl: 'B', isStressed: false },
    { syl: 'C', isStressed: true  },
    { syl: 'D', isStressed: false },
  ];
  const result = alignChunk(tokens, [{ acc: 'k' }, { fin: 'j.' }], 'g', ['x', 'y']);

  assert.equal(result[0].role, 'tenor',    'A: 1st leftover must be tenor when guard blocks intonation');
  assert.equal(result[0].note, 'g',        'A note must be tenor note');
  assert.equal(result[1].role, 'tenor',    'B: 2nd leftover must be tenor (not intonation[1])');
  assert.equal(result[2].role, 'acc',      'C: accent slot filled correctly');
  assert.equal(result[3].role, 'fin',      'D: fin slot filled correctly');
  assert.ok(!result.some(t => t.role === 'intonation'), 'no intonation tokens should appear');
});

// cadence = [{acc:'k'},{fin:'j.'}], 5 tokens → fin=E, acc=D★ → 3 leftover (A, B, C)
// intonation = ['x','y'] (2 notes) → 3 > 2 is TRUE → intonation applied; C becomes the lone tenor.
test('alignChunk: 2-note intonation with exactly 3 leftover positions → intonation applied, 1 tenor survives', () => {
  const tokens = [
    { syl: 'A', isStressed: true  },
    { syl: 'B', isStressed: false },
    { syl: 'C', isStressed: false },
    { syl: 'D', isStressed: true  },
    { syl: 'E', isStressed: false },
  ];
  const result = alignChunk(tokens, [{ acc: 'k' }, { fin: 'j.' }], 'g', ['x', 'y']);

  assert.equal(result[0].role, 'intonation', 'A: 1st leftover gets intonation[0]');
  assert.equal(result[0].note, 'x',          'A note must be intonation[0]');
  assert.equal(result[1].role, 'intonation', 'B: 2nd leftover gets intonation[1]');
  assert.equal(result[1].note, 'y',          'B note must be intonation[1]');
  assert.equal(result[2].role, 'tenor',      'C: surviving tenor after intonation');
  assert.equal(result[3].role, 'acc',        'D: accent slot');
  assert.equal(result[4].role, 'fin',        'E: fin slot');
});

// Integration: short verse mediant (2 leftover) with isFirstVerse=true (repeat-intonation path).
// "lebo dobrý Pán *": mediant → le★ bo dob★ rý Pán★ = 5 syllables
//   fin: Pán(4), ep: rý(3) unstressed→ep, acc: dob★(2), leftover: le(0) bo(1) = 2 positions
//   guard: 2 > 2 = false → all tenor even though isFirstVerse=true passes intonation array.
test('pointVerse: short mediant with isFirstVerse=true → guard prevents intonation (all tenor)', () => {
  const verse = 'lebo dobrý Pán * a nič mi nechýba';
  const tokens = pointVerse(verse, tone8, 'G', false, syllabifyPhrase, true);
  const mediantEnd = tokens.findIndex(t => t.role === 'mediant');
  const mediantPhrase = tokens.slice(0, mediantEnd);

  assert.ok(!mediantPhrase.some(t => t.role === 'intonation'),
    'no intonation tokens: 2 leftover is not enough for 2-note intonation to fire');
  assert.ok(mediantPhrase.every(t => t.role === 'tenor' || t.role === 'acc' || t.role === 'ep' || t.role === 'fin'),
    'all mediant tokens should be tenor/acc/ep/fin');
});

// Integration: long verse mediant (5 leftover) with isFirstVerse=true (repeat-intonation path).
// "Hospodin je môj pastier *" → 7 syllables, 5 leftover → 5 > 2 → intonation fires.
// The first two tokens of the mediant get the tone8 intonation notes ("g", "h").
test('pointVerse: long mediant with isFirstVerse=true → intonation applied on first 2 syllables', () => {
  const verse = 'Hospodin je môj pastier * a nič mi nechýba';
  const tokens = pointVerse(verse, tone8, 'G', false, syllabifyPhrase, true);

  assert.equal(tokens[0].role, 'intonation', '1st syllable: intonation role');
  assert.equal(tokens[0].note, 'g',          '1st syllable: tone8 intonation note g');
  assert.equal(tokens[1].role, 'intonation', '2nd syllable: intonation role');
  assert.equal(tokens[1].note, 'h',          '2nd syllable: tone8 intonation note h');
  assert.equal(tokens[2].role, 'tenor',      '3rd syllable: tenor (survives after 2-note intonation)');
});
