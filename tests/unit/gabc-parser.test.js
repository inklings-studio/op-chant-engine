import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGabc, reconstructText } from '../../js/common/gabc-parser.js';
import { compileGabc } from '../../js/common/compiler.js';

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

test('parseGabc: full gregoriobase header stripped, clef and body parsed', () => {
  const gabc = [
    'name: Kyrie eleison;',
    'gabc-copyright: CC0;',
    'score-copyright: CC0;',
    'mode: 1;',
    '%%',
    '(c4) Ký(fg)ri(g)e(h) e(g)lé(f)i(e)son.(d) (::)',
  ].join('\n');
  const result = parseGabc(gabc);
  assert.equal(result.clef, 'c4');
  assert.deepEqual(result.stanzas[0].lines[0].syllables, ['Ký', 'ri', 'e', 'e', 'lé', 'i', 'son.']);
  assert.deepEqual(result.stanzas[0].lines[0].parsedNotes, ['fg', 'g', 'h', 'g', 'f', 'e', 'd', '::']);
});

test('parseGabc: two-line single-stanza antiphon yields one stanza with two lines', () => {
  // All syllables must have note parens directly adjacent — bare text is ignored by the parser.
  const gabc = [
    '%%',
    '(c4) Sal(fg)ve(e) Re(f)gi(g)na,(h) (,)',
    'Ma(h)ter(g) mi(f)se(e)ri(d)cor(e)di(f)ae.(g) (::)',
  ].join('\n');
  const result = parseGabc(gabc);
  assert.equal(result.stanzas.length, 1);
  assert.equal(result.stanzas[0].lines.length, 2);
  assert.deepEqual(result.stanzas[0].lines[0].syllables, ['Sal', 've', 'Re', 'gi', 'na,']);
  assert.ok(result.stanzas[0].lines[0].parsedNotes.includes(','), 'comma barline in line 0');
  assert.deepEqual(result.stanzas[0].lines[1].syllables, ['Ma', 'ter', 'mi', 'se', 'ri', 'cor', 'di', 'ae.']);
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

// ── reconstructText ────────────────────────────────────────────────────────

test('reconstructText: same-word syllables joined without separator', () => {
  // wordMap [0,0,0] → all three syllables form one word
  const stanzas = [{ lines: [{ syllables: ['Ký', 'ri', 'e'], wordMap: [0, 0, 0] }] }];
  assert.equal(reconstructText(stanzas), 'Kýrie');
});

test('reconstructText: different-word syllables separated by space', () => {
  // wordMap [0,0,0,1,1,1,1] → "Kýrie eléison."
  const stanzas = [{ lines: [{
    syllables: ['Ký', 'ri', 'e', 'e', 'lé', 'i', 'son.'],
    wordMap:   [0,    0,   0,   1,   1,   1,   1],
  }] }];
  assert.equal(reconstructText(stanzas), 'Kýrie eléison.');
});

test('reconstructText: multi-line stanza joined with \\n', () => {
  const stanzas = [{ lines: [
    { syllables: ['Sal', 've'],       wordMap: [0, 1] },
    { syllables: ['Ma', 'ter'],       wordMap: [0, 0] },
  ] }];
  assert.equal(reconstructText(stanzas), 'Sal ve\nMater');
});

test('reconstructText: multi-stanza joined with \\n\\n', () => {
  const stanzas = [
    { lines: [{ syllables: ['Rex'],  wordMap: [0] }] },
    { lines: [{ syllables: ['Pa', 'ne'], wordMap: [0, 0] }] },
  ];
  assert.equal(reconstructText(stanzas), 'Rex\n\nPane');
});

test('reconstructText: coda appended to last stanza', () => {
  const stanzas = [{ lines: [{ syllables: ['Rex'], wordMap: [0] }] }];
  const coda = { syllables: ['A', 'men'], wordMap: [0, 0] };
  assert.equal(reconstructText(stanzas, coda), 'Rex\nAmen');
});

test('reconstructText: empty stanzas return empty string', () => {
  assert.equal(reconstructText([]), '');
  assert.equal(reconstructText([], null), '');
});

test('reconstructText: round-trip parseGabc → reconstructText produces readable text', () => {
  const gabc = 'name: Kyrie;\n%%\n(c4) Ký(fg)ri(g)e(h) e(g)lé(f)i(e)son.(d) (::)';
  const { stanzas, coda } = parseGabc(gabc);
  assert.equal(reconstructText(stanzas, coda), 'Kýrie eléison.');
});

test('reconstructText: two-line GABC produces \\n-separated lines', () => {
  const gabc = '%%\n(c4) Sal(fg)ve(e) Re(f)gi(g)na,(h) (,)\nMa(h)ter(g) mi(f)se(e)ri(d)cor(e)di(f)ae.(g) (::)';
  const { stanzas, coda } = parseGabc(gabc);
  assert.equal(reconstructText(stanzas, coda), 'Salve Regina,\nMater misericordiae.');
});

test('reconstructText: only updates when different (idempotent on same input)', () => {
  // Simulates the guard in switchToTab: reconstruct twice from the same stanzas,
  // result must be identical so the textarea is not unnecessarily overwritten.
  const gabc = '%%\n(c4) Rex(f) pa(g)ter(h) (::)';
  const { stanzas, coda } = parseGabc(gabc);
  const first  = reconstructText(stanzas, coda);
  const second = reconstructText(stanzas, coda);
  assert.equal(first, second);
});

// ── PDF header fields ──────────────────────────────────────────────────────────

test('parseGabc: %fontsize, %width, %height extracted from header', () => {
  const gabc = [
    'name: Test;',
    '%fontsize: 12;',
    '%width: 10;',
    '%height: 15;',
    '%%',
    '(c4) Kris(f)te(g) (::)',
  ].join('\n');
  const result = parseGabc(gabc);
  assert.equal(result.fontSizePt,   12);
  assert.equal(result.pageWidthIn,  10);
  assert.equal(result.pageHeightIn, 15);
  assert.equal(result.clef, 'c4');
});

test('parseGabc: missing %fontsize/%width/%height returns null', () => {
  const result = parseGabc('%%\n(c4) Kris(f)te(g) (::)');
  assert.equal(result.fontSizePt,   null);
  assert.equal(result.pageWidthIn,  null);
  assert.equal(result.pageHeightIn, null);
});

test('compileGabc: %fontsize, %width, %height emitted when set', () => {
  const state = {
    clef: 'c4', largeInitial: false, stanzaNumbers: false, annotation: '',
    coda: null,
    fontSizePt: 12, pageWidthIn: 10, pageHeightIn: 15,
    stanzas: [{ lines: [{ syllables: ['Rex'], wordMap: [0], parsedNotes: ['f'] }] }],
  };
  const gabc = compileGabc(state);
  assert.ok(gabc.includes('%fontsize: 12;'), `expected %fontsize in: ${gabc}`);
  assert.ok(gabc.includes('%width: 10;'),    `expected %width in: ${gabc}`);
  assert.ok(gabc.includes('%height: 15;'),   `expected %height in: ${gabc}`);
});

test('compileGabc: %fontsize/%width/%height omitted when null', () => {
  const state = {
    clef: 'c4', largeInitial: false, stanzaNumbers: false, annotation: '',
    coda: null, fontSizePt: null, pageWidthIn: null, pageHeightIn: null,
    stanzas: [{ lines: [{ syllables: ['Rex'], wordMap: [0], parsedNotes: ['f'] }] }],
  };
  const gabc = compileGabc(state);
  assert.ok(!gabc.includes('%fontsize'), 'no %fontsize when null');
  assert.ok(!gabc.includes('%width'),    'no %width when null');
  assert.ok(!gabc.includes('%height'),   'no %height when null');
});

test('parseGabc/compileGabc: PDF header round-trip', () => {
  const state = {
    clef: 'c4', largeInitial: false, stanzaNumbers: false, annotation: '',
    coda: null, fontSizePt: 14, pageWidthIn: 8.5, pageHeightIn: 11,
    stanzas: [{ lines: [{ syllables: ['Rex'], wordMap: [0], parsedNotes: ['f'] }] }],
  };
  const gabc   = compileGabc(state);
  const parsed = parseGabc(gabc);
  assert.equal(parsed.fontSizePt,   14);
  assert.equal(parsed.pageWidthIn,  8.5);
  assert.equal(parsed.pageHeightIn, 11);
});
