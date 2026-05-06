import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointVerse } from '../../v2/js/psalms/pointer.js';
import { tone8 } from '../../v2/js/tones/dominican.js';
import { syllabifyPhrase } from '../../v2/js/languages/sk/syllabifier.js';

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
  assert.deepEqual(flexTokens.map(t => t.note), ['j', 'j', 'h', 'h.']);
});

// ── Proparoxytone: ep IS used ──────────────────────────────────────────────────

// When the last word is proparoxytone (stress on antepenultimate), ep is used correctly.
// "a nič mi nechýba" termination: ne(★) chý ba
// Term G: [{prep:"i"},{acc:"j"},{ep:"h"},{fin:"g."}]
//   fin: ba
//   ep:  chý — NOT stressed → ep assigned (no skip)
//   acc: ne(★) → acc(j)
//   prep: no tokens left → skipped
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
// Term G: [{prep:"i"},{acc:"j"},{ep:"h"},{fin:"g."}]
//   fin: kám
//   ep:  ča — stressed → skip (acc slot remains)
//   acc: ča(★) → acc(j)
//   prep: mi → prep(i)
test('pointVerse: paroxytone last word — ep skipped, acc on stressed penultimate (čakám)', () => {
  const tokens = pointVerse('* a nič mi čakám', tone8, 'G', false, syllabifyPhrase);
  const acc  = tokens.find(t => t.role === 'acc');
  const ep   = tokens.find(t => t.role === 'ep');
  const fin  = tokens.find(t => t.role === 'fin');
  const prep = tokens.find(t => t.role === 'prep');
  assert.equal(acc?.syl,  'ča',  'acc on "ča" (primary stress of čakám)');
  assert.ok(!ep,                 'ep slot skipped for paroxytone word');
  assert.equal(fin?.syl,  'kám', 'fin on "kám"');
  assert.equal(prep?.syl, 'mi',  'prep on "mi"');
});

// ── Stress override (' character) ─────────────────────────────────────────────

// ' override shifts isStressed to the marked syllable, which changes where acc lands.
// Natural "nechýba": ne(★) chý ba → ep=chý (unstressed, no skip), acc=ne
// Override "ne'chýba": ne chý(★) ba → ep skipped (chý stressed), acc=chý, prep=ne
test("pointVerse: ' override shifts acc within the last word", () => {
  const natural  = pointVerse('* nechýba',  tone8, 'G', false, syllabifyPhrase);
  const override = pointVerse("* ne'chýba", tone8, 'G', false, syllabifyPhrase);

  assert.equal(natural.find(t => t.role === 'acc')?.syl,  'ne',  'natural: acc on "ne"');
  assert.equal(override.find(t => t.role === 'acc')?.syl, 'chý', "override: acc shifts to \"chý\"");
  assert.equal(override.find(t => t.role === 'prep')?.syl, 'ne', "override: ne becomes prep");
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
