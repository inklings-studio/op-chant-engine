import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGabc } from '../../v2/js/transcriber/common/gabc-parser.js';
import { compileGabc } from '../../v2/js/transcriber/common/compiler.js';

test('parseGabc: clef extracted', () => {
  const result = parseGabc('initial-style: 0;\n%%\n(c4) Kris(f)te(g) (::)');
  assert.equal(result.clef, 'c4');
});

test('parseGabc: syllable–note pairs parsed', () => {
  const result = parseGabc('initial-style: 0;\n%%\n(c4) Kris(f) te(g) (::)');
  const line = result.stanzas[0].lines[0];
  assert.deepEqual(line.syllables, ['Kris', 'te']);
  assert.ok(line.notes.includes('f'));
  assert.ok(line.notes.includes('g'));
});

test('parseGabc: barlines preserved as note tokens', () => {
  const result = parseGabc('%%\nKris(f) (,) te(g) (::)');
  const line = result.stanzas[0].lines[0];
  const commaIdx = line.parsedNotes.indexOf(',');
  assert.ok(commaIdx > 0, 'comma barline present');
  assert.equal(line.parsedNotes[commaIdx - 1], 'f');
  assert.equal(line.parsedNotes[commaIdx + 1], 'g');
});

test('parseGabc: stanza boundary on (::)', () => {
  const gabc = 'initial-style: 0;\n%%\n(c4) Kris(f) (::)\nPane(g) (::)';
  const result = parseGabc(gabc);
  assert.equal(result.stanzas.length, 2);
});

test('parseGabc: round-trip compile → parse preserves syllables and notes', () => {
  const state = {
    clef: 'c4',
    largeInitial: false,
    stanzaNumbers: false,
    annotation: '',
    coda: null,
    stanzas: [{
      lines: [{
        syllables: ['Kris', 'te'],
        wordMap: [0, 0],
        parsedNotes: ['f', 'g'],
      }],
    }],
  };
  const gabc = compileGabc(state);
  const parsed = parseGabc(gabc);
  assert.deepEqual(parsed.stanzas[0].lines[0].syllables, ['Kris', 'te']);
  assert.ok(parsed.stanzas[0].lines[0].parsedNotes.includes('f'));
  assert.ok(parsed.stanzas[0].lines[0].parsedNotes.includes('g'));
  assert.equal(parsed.clef, 'c4');
});

test('parseGabc: adjacent syllables reconstructed as same word', () => {
  // "Kris(f)te(g)" — no space between tokens → same word
  const result = parseGabc('%%\n(c4) Kris(f)te(g) (::)');
  const line = result.stanzas[0].lines[0];
  assert.equal(line.wordMap[0], line.wordMap[1], 'adjacent syllables share a word index');
});

test('parseGabc: space-separated syllables reconstructed as different words', () => {
  // "Rex(f) Pa(g)ne(h)" — Rex is word 0, Pa+ne is word 1
  const result = parseGabc('%%\n(c4) Rex(f) Pa(g)ne(h) (::)');
  const line = result.stanzas[0].lines[0];
  assert.notEqual(line.wordMap[0], line.wordMap[1], 'Rex is a different word from Pa');
  assert.equal(line.wordMap[1], line.wordMap[2], 'Pa and ne share a word index');
});

test('parseGabc: round-trip preserves word grouping so compile re-joins same-word syllables', () => {
  // Build a state with two syllables in the same word: wordMap [0, 0]
  // Compile → parse → compile again. The second compile should still join them.
  const state = {
    clef: 'c4',
    largeInitial: false,
    stanzaNumbers: false,
    annotation: '',
    coda: null,
    stanzas: [{
      lines: [{
        syllables: ['Kris', 'te'],
        wordMap: [0, 0],
        parsedNotes: ['f', 'g'],
      }],
    }],
  };
  const gabc1  = compileGabc(state);
  const parsed = parseGabc(gabc1);

  // Rebuild state from parsed data (simulates the dirty-flag sync path)
  const state2 = {
    clef: parsed.clef,
    largeInitial: false,
    stanzaNumbers: false,
    annotation: '',
    coda: null,
    stanzas: parsed.stanzas,
  };
  const gabc2 = compileGabc(state2);

  // Same-word syllables must still be joined without a space
  assert.ok(gabc2.includes('Kris(f)te(g)'), `expected joined syllables in: ${gabc2}`);
});
