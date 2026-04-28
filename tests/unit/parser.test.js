import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseText } from '../../v2/js/transcriber/common/parser.js';
import { syllabifyWord, syllabifyPhrase } from '../../v2/js/transcriber/languages/sk/syllabifier.js';
import { codaPattern } from '../../v2/js/transcriber/languages/sk/index.js';

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
