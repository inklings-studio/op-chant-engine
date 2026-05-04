import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointVerse } from '../../v2/js/psalms/pointer.js';
import { tone8 } from '../../v2/js/tones/dominican.js';
import { syllabifyPhrase } from '../../v2/js/transcriber/languages/sk/syllabifier.js';

// Test 1 — Standard Tone 8 mediant (no flex)
// "Hospodin je môj pastier * a nič mi nechýba"
// Tone 8, cadenceKey:"G", isSolemn:false
// Mediant cadence: [{acc:"k"},{ep:"j"},{fin:"j."}]
// Slovak stress: every word stressed on first syllable.
// Syllabification of "Hospodin je môj pastier":
//   Hos-po-din je môj pas-tier  → 7 tokens
//   Right-to-left: tier=fin(j.), pas=ep(j), môj★=acc(k), din→tenor, po→tenor, Hos→tenor... je→intonation(h)
// Expected last 3 mediant tokens: môj:acc:k, pas:ep:j, tier:fin:j.
test('pointVerse: tone8 mediant – last 3 tokens are acc/ep/fin', () => {
  const tokens = pointVerse(
    'Hospodin je môj pastier * a nič mi nechýba',
    tone8, 'G', false, syllabifyPhrase
  );

  // Find the mediant chunk boundary: tokens before the * split.
  // "Hospodin je môj pastier" syllabifies to: Hos po din je môj pas tier (7 tokens)
  const mediantTokens = tokens.slice(0, 7);
  const last3 = mediantTokens.slice(-3);

  assert.deepEqual(last3, [
    { syl: 'môj',  note: 'k',  role: 'acc' },
    { syl: 'pas',  note: 'j',  role: 'ep'  },
    { syl: 'tier', note: 'j.', role: 'fin' },
  ]);
});

// Test 2 — Flex chunk roles
// "Chváľte Pána † lebo je dobrý * aleluja"
// Tone 8, cadenceKey:"G", isSolemn:false
// Flex cadence: [{acc:"h"},{ep:"h"},{fin:"h."}]
// "Chváľte Pána" → Chváľ-te Pa-ná (4 tokens)
// Right-to-left: ná=fin, Pa=ep... wait, Pa is stressed (first syl) but ep is not acc.
// Actually: ep/fin are assigned strictly right-to-left regardless of stress.
// ná=fin(h.), Pa=ep(h), te=acc-scan: te not stressed? "Chváľte"→Chváľ(stressed)+te(unstressed) → te=tenor, then Chváľ★=acc(h)
// So: Chváľ:acc:h, te:tenor:j, Pa:ep:h, ná:fin:h.
test('pointVerse: tone8 flex – last 3 tokens are acc/ep/fin on correct notes', () => {
  const tokens = pointVerse(
    'Chváľte Pána † lebo je dobrý * aleluja',
    tone8, 'G', false, syllabifyPhrase
  );

  // "Chváľte Pána" → 4 flex tokens
  const flexTokens = tokens.slice(0, 4);
  assert.deepEqual(flexTokens.map(t => t.role), ['acc', 'tenor', 'ep', 'fin']);
  assert.deepEqual(flexTokens.map(t => t.note), ['h', 'j', 'h', 'h.']);
});

// Test 3 — Stress override shifts acc
// "Pane Bo'že * lebo je dobrý"
// Without override: "Bože" → Bo★ že → rightmost stressed before * = Bo → acc on "Bo"
// With override '  on že: "Bože" → Bo že★ → rightmost stressed = že → acc on "že"
test("pointVerse: ' stress override shifts acc to overridden syllable", () => {
  const withoutOverride = pointVerse(
    'Pane Bože * lebo je dobrý',
    tone8, 'G', false, syllabifyPhrase
  );
  const withOverride = pointVerse(
    "Pane Bo'že * lebo je dobrý",
    tone8, 'G', false, syllabifyPhrase
  );

  // Mediant chunk: "Pane Bože" → Pa-ne Bo-že (4 tokens)
  // Cadence: [{acc:"k"},{ep:"j"},{fin:"j."}] — one acc slot scans rightward for stressed.
  // Without override: Bo is stressed → acc on "Bo", ne→tenor... wait no, right-to-left:
  //   že=fin(j.), Bo=ep(j), then acc scan: ne not stressed→tenor, Pa★ stressed→acc(k)
  // Hmm wait — ep is assigned BEFORE acc scanning. Let me re-think...
  // Cadence right-to-left: ci=2 fin: že=fin; ci=1 ep: Bo=ep; ci=0 acc: scan left: ne not stressed→tenor, Pa★→acc
  // So: Pa:acc:k, ne:tenor:j, Bo:ep:j, že:fin:j.

  // With override on že: že is stressed, Bo is not.
  // Cadence right-to-left: ci=2 fin: že=fin; ci=1 ep: Bo=ep; ci=0 acc: ne not stressed→tenor, Pa★→acc
  // Same result! The override only changes isStressed on the syllables; fin/ep are assigned first.

  // So the meaningful test is a verse where the acc slot falls directly on the overridden syllable.
  // Use a shorter mediant: "Bo'že *" → just 2 tokens: Bo že★
  // Cadence: fin=že, then acc scan: že already consumed, no tokens left for acc → acc dropped? No:
  //   Right-to-left: ci=2 fin: że=fin(ti=0), ti=-1 → stop. Then ci=1 ep skipped (ti<0), ci=0 acc skipped.
  // That's too short. Let's use "Bože Pane *" (4 tokens without override):
  //   Bože→Bo★,že; Pane→Pa★,ne → tokens: Bo★,že,Pa★,ne
  //   Right-to-left: fin: ne; ep: Pa; acc scan: že not stressed→tenor, Bo★→acc
  //   Result: Bo:acc, že:tenor, Pa:ep, ne:fin
  // With "Bože Pa'ne *" (override: ne★):
  //   tokens: Bo★,že,Pa,ne★
  //   Right-to-left: fin: ne★; ep: Pa; acc scan: že not stressed→tenor, Bo★→acc
  //   Result: same positional roles but ne★ was used as fin (fixed slot, not acc-driven)
  // The stress override only matters for acc slots, not fin/ep. Need acc to land on the override.

  // Best minimal case: single stressed word with 2 syllables, only acc in cadence.
  // Use termination c which is [{acc:"k"},{ep:"j"},{fin:"j."}] same as mediant but no intonation.
  // Use verse "* Bo'že" (empty mediant, term only):
  const baseCase = pointVerse("* Bože",  tone8, 'G', false, syllabifyPhrase);
  const overCase = pointVerse("* Bo'že", tone8, 'G', false, syllabifyPhrase);

  // "Bože" → Bo★ že (base) vs Bo že★ (override)
  // Termination G: [{prep:"i"},{acc:"j"},{ep:"h"},{fin:"g."}] — only 2 tokens, cadence has 4 slots.
  // Right-to-left: fin: že; ep: Bo; prep: no token; acc: no token → both exhausted early.
  // Let's use termination c: [{acc:"k"},{ep:"j"},{fin:"j."}]
  const baseC = pointVerse("* Bože",  tone8, 'c', false, syllabifyPhrase);
  const overC = pointVerse("* Bo'že", tone8, 'c', false, syllabifyPhrase);

  // Cadence c right-to-left: fin: že; ep: Bo; acc: no tokens → acc dropped.
  // Same result regardless of stress... ep/fin are fixed.

  // The acc slot only matters when there are MORE tokens than fin+ep+prep.
  // "Pane Bože *" with termination c (3 tokens: Pa★,ne,Bo★,že — 4 tokens):
  //   fin: že; ep: Bo★; acc scan: ne not stressed→tenor, Pa★→acc. Result: Pa:acc, ne:tenor, Bo:ep, že:fin.
  // "Pane Bo'že *" with termination c:
  //   tokens: Pa★,ne,Bo,že★; fin: že★; ep: Bo; acc scan: ne not stressed→tenor, Pa★→acc.
  //   Result: Pa:acc, ne:tenor, Bo:ep, že:fin. Same! Because ep takes Bo before acc gets to scan.

  // The key insight: acc only wins over ep/fin by being scanned BEFORE them in cadence order.
  // Cadence c: [{acc:"k"},{ep:"j"},{fin:"j."}] — ci goes 2,1,0 (right-to-left).
  // ci=2 → fin; ci=1 → ep; ci=0 → acc. So fin and ep are consumed BEFORE acc.
  // For acc to see the override, we need a cadence where acc comes LAST (rightmost) in the array.
  // No standard tone has acc as the rightmost... they all have fin rightmost.

  // Realistic test: show that without override the FIRST stressed syl gets acc (default),
  // and with override the SECOND stressed syl gets acc instead.
  // Use longer phrase so both syllables survive the fin/ep consumption:
  // "Pane Kriste Bože * ..." — mediant with 6 tokens: Pa★,ne,Kris★,te,Bo★,že
  // Mediant cadence: [{acc:"k"},{ep:"j"},{fin:"j."}]
  // Right-to-left: fin: že; ep: Bo★; acc scan: te not stressed→tenor, Kris★→acc.
  // Remaining: Pa★=intonation(g), ne=intonation(h) [tone8 intonation is ["g","h"]]
  // So acc lands on Kris.
  // With "Pane Kris'te Bože *": tokens: Pa★,ne,Kris,te★,Bo★,že
  //   fin: že; ep: Bo★; acc scan: te★ IS stressed → acc(k) on te★.
  //   Result: acc on "te" instead of "Kris".

  const accOnKris = pointVerse('Pane Kriste Bože * a', tone8, 'G', false, syllabifyPhrase);
  const accOnTe   = pointVerse("Pane Kris'te Bože * a", tone8, 'G', false, syllabifyPhrase);

  // Mediant chunk is 6 tokens (Pa ne Kris te Bo že)
  const medKris = accOnKris.slice(0, 6);
  const medTe   = accOnTe.slice(0, 6);

  assert.equal(medKris.find(t => t.role === 'acc')?.syl, 'Kris',
    'without override: acc falls on "Kris" (first stressed syl found right-to-left)');
  assert.equal(medTe.find(t => t.role === 'acc')?.syl, 'te',
    "with ' override on te: acc falls on \"te\"");
});

// Test 4 — Secondary stress: acc falls on nearest (rightmost) stressed syllable
// "demokraticky * lebo", tone8/G, normal
// "demokraticky" → de(0,★) mok(1) ra(2,★) tic(3) ky(4,★)  — 5 syllables with secondary
// Mediant cadence [{acc:"k"},{ep:"j"},{fin:"j."}]:
//   fin: ky; ep: tic; acc scan: ra★ (secondary) → acc on "ra"
//   Remaining: de, mok → intonation g, h
// Without secondary stress acc would fall all the way back to "de" (primary only).
test('pointVerse: secondary stress — acc falls on "ra" (secondary) not "de" (primary)', () => {
  const tokens = pointVerse('demokraticky * lebo', tone8, 'G', false, syllabifyPhrase);
  const mediant = tokens.slice(0, 5);
  assert.equal(mediant.find(t => t.role === 'acc')?.syl, 'ra',
    'secondary stress at syl 2 is rightmost stressed; acc should land there, not on syl 0');
});
