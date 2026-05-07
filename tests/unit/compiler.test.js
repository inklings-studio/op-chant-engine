import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileGabc } from '../../js/common/compiler.js';

function makeState(overrides = {}) {
  return {
    clef: 'c4',
    largeInitial: false,
    stanzaNumbers: false,
    annotation: '',
    coda: null,
    stanzas: [],
    ...overrides,
  };
}

function line(syllables, parsedNotes, wordMap) {
  return { syllables, parsedNotes, wordMap: wordMap ?? syllables.map((_, i) => i) };
}

// Strip header (everything up to and including %%) for body-only assertions.
function body(gabc) { return gabc.split('%%\n')[1] ?? gabc; }

test('compileGabc: clef prefix on first note token', () => {
  const state = makeState({
    clef: 'c4',
    stanzas: [{ lines: [line(['Kris', 'te'], ['f', 'g'])] }],
  });
  assert.ok(body(compileGabc(state)).startsWith('(c4)'));
});

test('compileGabc: basic syllable–note pairing', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Kris', 'te'], ['f', 'g'])] }],
  });
  assert.ok(body(compileGabc(state)).includes('Kris(f) te(g)'));
});

test('compileGabc: same-word syllables joined without space', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Kris', 'te'], ['f', 'g'], [0, 0])] }],
  });
  assert.ok(body(compileGabc(state)).includes('Kris(f)te(g)'));
});

test('compileGabc: different-word syllables separated by space', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Rex', 'slá', 'va'], ['f', 'g', 'h'], [0, 1, 1])] }],
  });
  assert.ok(body(compileGabc(state)).includes('Rex(f) slá(g)va(h)'));
});

test('compileGabc: barline tokens emitted standalone', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['a', 'b'], ['f', ',', 'g'])] }],
  });
  assert.ok(body(compileGabc(state)).includes('a(f) (,) b(g)'));
});

test('compileGabc: more notes than syllables → melisma dashes', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Rex'], ['f', 'g', 'h'])] }],
  });
  assert.ok(body(compileGabc(state)).includes('Rex(f) -(g) -(h)'));
});

test('compileGabc: more syllables than notes → overflow not emitted', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Kris', 'te', 'Rex'], ['f', 'g'])] }],
  });
  const out = body(compileGabc(state));
  assert.ok(out.includes('Kris(f) te(g)'));
  assert.ok(!out.includes('Rex'));
});

test('compileGabc: double barline appended to last line of stanza', () => {
  const state = makeState({
    stanzas: [{
      lines: [
        line(['Kris', 'te'], ['f', 'g']),
        line(['Rex'], ['h']),
      ],
    }],
  });
  const out = body(compileGabc(state));
  assert.ok(out.includes('Rex(h) (::)'));
});

test('compileGabc: largeInitial true → initial-style: 1', () => {
  const state = makeState({
    largeInitial: true,
    stanzas: [{ lines: [line(['Kris'], ['f'])] }],
  });
  assert.ok(compileGabc(state).includes('initial-style: 1;'));
});

test('compileGabc: largeInitial false → initial-style: 0', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Kris'], ['f'])] }],
  });
  assert.ok(compileGabc(state).includes('initial-style: 0;'));
});

test('compileGabc: stanza numbers use plain N.() without carets', () => {
  const state = makeState({
    stanzaNumbers: true,
    largeInitial: false,
    stanzas: [
      { lines: [line(['Kris', 'te'], ['f', 'g'])] },
      { lines: [line(['Pa', 'ne'], ['f', 'g'])] },
    ],
  });
  const out = body(compileGabc(state));
  assert.ok(out.includes('2.()'), 'stanza 2 gets plain number prefix');
  assert.ok(!out.includes('^'), 'no caret characters in output');
});

test('compileGabc: coda appended after stanzas', () => {
  const state = makeState({
    stanzas: [{ lines: [line(['Kris'], ['f'])] }],
    coda: { syllables: ['A', 'men'], parsedNotes: ['c', 'd'], wordMap: [0, 0] },
  });
  const out = body(compileGabc(state));
  assert.ok(out.includes('A(c)men(d) (::)'));
});
