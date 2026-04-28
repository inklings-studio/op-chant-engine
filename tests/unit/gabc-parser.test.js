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
