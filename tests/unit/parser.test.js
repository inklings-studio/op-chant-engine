import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseText } from '../../js/common/parser.js';
import { parseGabc, reconstructText } from '../../js/common/gabc-parser.js';
import { syllabifyWord, syllabifyPhrase } from '../../js/languages/sk/syllabifier.js';
import { codaPattern } from '../../js/languages/sk/index.js';

const skPlugin = { codaPattern, syllabifyWord, syllabifyPhrase };

function freshState(overrides = {}) {
  return { stanzas: [], coda: null, strophicInheritance: false, ...overrides };
}

test('parseText: single stanza structure', () => {
  const state = freshState();
  parseText('Kriste Rex\nsláva Bohu', state, skPlugin);
  assert.equal(state.stanzas.length, 1);
  assert.equal(state.stanzas[0].lines.length, 2);
  assert.deepEqual(state.stanzas[0].lines[0].syllables, ['Kris', 'te', 'Rex']);
  assert.deepEqual(state.stanzas[0].lines[1].syllables, ['slá', 'va', 'Bo', 'hu']);
  assert.equal(state.coda, null);
});

test('parseText: two stanzas', () => {
  const state = freshState();
  parseText('Kriste Rex\nsláva Bohu\n\nPane Bože\nchvála tebe', state, skPlugin);
  assert.equal(state.stanzas.length, 2);
  assert.equal(state.stanzas[0].lines.length, 2);
  assert.equal(state.stanzas[1].lines.length, 2);
});

test('parseText: coda extracted from last word', () => {
  const state = freshState();
  parseText('Kriste Rex\nsláva Bohu Amen', state, skPlugin);
  const lastLineSyls = state.stanzas[0].lines[1].syllables;
  assert.ok(!lastLineSyls.includes('A') && !lastLineSyls.includes('men'),
    'coda syllables must not appear in stanza lines');
  assert.deepEqual(state.coda.syllables, ['A', 'men']);
});

test('parseText: default notes for new lines', () => {
  const state = freshState();
  parseText('Kriste Rex\nsláva Bohu', state, skPlugin);
  const line0 = state.stanzas[0].lines[0];
  const line1 = state.stanzas[0].lines[1];
  assert.ok(line0.notes.endsWith(','), 'non-last line ends with comma barline');
  assert.ok(line1.notes.endsWith('::'), 'last line ends with double barline');
  assert.ok(line0.notes.startsWith('f f f'), 'notes default to f per syllable');
});

test('parseText: existing notes preserved on rebuild', () => {
  const state = freshState();
  parseText('Kriste Rex\nsláva Bohu', state, skPlugin);
  state.stanzas[0].lines[0].notes = 'c d e ;';
  parseText('Kriste Rex\nsláva Bohu', state, skPlugin);
  assert.equal(state.stanzas[0].lines[0].notes, 'c d e ;');
});

test('parseText: strophic inheritance copies stanza 0 notes to stanza 1+', () => {
  const state = freshState({ strophicInheritance: true });
  parseText('Kriste Rex\nsláva Bohu\n\nPane Bože\nchvála tebe', state, skPlugin);
  assert.equal(state.stanzas[1].lines[0].notes, state.stanzas[0].lines[0].notes);
  assert.equal(state.stanzas[1].lines[1].notes, state.stanzas[0].lines[1].notes);
});

// ── Fit Text (GABC import workflow) ───────────────────────────────────────

function gabcState(gabcStr) {
  const parsed = parseGabc(gabcStr);
  return { clef: parsed.clef, stanzas: parsed.stanzas, coda: null, strophicInheritance: false };
}

test('Fit Text: single-line GABC melody preserved when Slovak text is substituted', () => {
  // Simulates the full gregoriobase import → Fit Text workflow.
  const state = gabcState(
    'name: Kyrie;\n%%\n(c4) Ký(fg)ri(g)e(h) e(g)lé(f)i(e)son.(d) (::)',
  );
  const importedNotes = state.stanzas[0].lines[0].notes;
  assert.ok(importedNotes.length > 0, 'GABC parse produced notes');

  parseText('Pane Bože milosrdný\nuslyš naše volanie', state, skPlugin);

  assert.equal(state.stanzas[0].lines[0].notes, importedNotes,
    'imported melody preserved after Fit Text');
});

test('Fit Text: multi-line GABC melody mapped per line index', () => {
  const state = gabcState(
    '%%\n(c4) Ký(f)ri(g)e(h) (,)\ne(g)lé(f)son.(d) (::)',
  );
  const notesLine0 = state.stanzas[0].lines[0].notes;
  const notesLine1 = state.stanzas[0].lines[1].notes;

  parseText('Pane Bože\nmilosrdný Pán', state, skPlugin);

  assert.equal(state.stanzas[0].lines[0].notes, notesLine0, 'line 0 melody preserved');
  assert.equal(state.stanzas[0].lines[1].notes, notesLine1, 'line 1 melody preserved');
});

test('Fit Text: extra lines in new text beyond imported line count get rectotone defaults', () => {
  // GABC has 1 line; Slovak text has 2 lines — extra line gets default notes.
  const state = gabcState('%%\n(c4) Ký(f)ri(g)e(h) (::)');
  parseText('Pane Bože\nmilosrdný tebe', state, skPlugin);
  const extra = state.stanzas[0].lines[1];
  assert.ok(extra.notes.startsWith('f'), 'extra line defaults to rectotone');
});

test('Fit Text: reconstructText output is parseable by parseText (Re-Build scenario)', () => {
  // Simulates the full textarea sync: parseGabc → reconstructText → editorRawText.
  // When the user clicks Re-Build, parseText runs on the reconstructed Latin text with
  // the Slovak syllabifier. Syllable counts may differ (Latin vs Slovak rules) — that is
  // expected and is why the user adjusts notes afterwards. We just verify no crash and
  // that stanzas are produced.
  const gabc = '%%\n(c4) Ký(fg)ri(g)e(h) e(g)lé(f)i(e)son.(d) (::)';
  const parsed = parseGabc(gabc);
  const reconstructed = reconstructText(parsed.stanzas, parsed.coda);
  assert.equal(reconstructed, 'Kýrie eléison.', 'reconstructed text is readable');

  const state = { clef: parsed.clef, stanzas: [], coda: null, strophicInheritance: false };
  parseText(reconstructed, state, skPlugin);
  assert.ok(state.stanzas.length > 0, 'parseText produces stanzas from reconstructed text');
  assert.ok(state.stanzas[0].lines[0].syllables.length > 0, 'syllables produced');
});

test('Fit Text: single-stanza GABC into multi-stanza text — only stanza 0 preserves melody', () => {
  const state = gabcState('%%\n(c4) Ký(fg)ri(g)e(h) (::)');
  const importedNotes = state.stanzas[0].lines[0].notes;

  parseText('Pane Bože\n\nKriste Rex', state, skPlugin);

  assert.equal(state.stanzas[0].lines[0].notes, importedNotes,
    'stanza 0 melody preserved');
  assert.ok(state.stanzas[1].lines[0].notes.startsWith('f'),
    'stanza 1 gets rectotone default');
});
