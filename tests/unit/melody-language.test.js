import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARLINES, tokenizeMelody } from '../../js/common/melody.js';
import { Syllabifier, registerLanguage, getLanguage, listLanguages } from '../../js/common/language.js';

class PassthroughSyllabifier extends Syllabifier {
  syllabifyWord(w) {
    return { hasNucleus: true, syllables: [{ syl: w, isStressed: true }] };
  }
}

// ─── tokenizeMelody ───────────────────────────────────────────────────────────

test('tokenizeMelody: basic note tokens', () => {
  assert.deepEqual(tokenizeMelody('f g h'), ['f', 'g', 'h']);
});

test('tokenizeMelody: empty string returns empty array', () => {
  assert.deepEqual(tokenizeMelody(''), []);
});

test('tokenizeMelody: whitespace-only returns empty array', () => {
  assert.deepEqual(tokenizeMelody('   '), []);
});

test('tokenizeMelody: barline tokens preserved', () => {
  assert.deepEqual(tokenizeMelody('f , g : h ::'), ['f', ',', 'g', ':', 'h', '::']);
});

test('tokenizeMelody: leading/trailing whitespace trimmed', () => {
  assert.deepEqual(tokenizeMelody('  f g  '), ['f', 'g']);
});

test('tokenizeMelody: extra internal whitespace collapsed', () => {
  assert.deepEqual(tokenizeMelody('f   g'), ['f', 'g']);
});

test('tokenizeMelody: single token', () => {
  assert.deepEqual(tokenizeMelody('fgf'), ['fgf']);
});

// ─── BARLINES set ─────────────────────────────────────────────────────────────

test('BARLINES: contains expected barline tokens', () => {
  assert.ok(BARLINES.has(','));
  assert.ok(BARLINES.has(';'));
  assert.ok(BARLINES.has(':'));
  assert.ok(BARLINES.has('::'));
});

test('BARLINES: does not contain note tokens', () => {
  assert.ok(!BARLINES.has('f'));
  assert.ok(!BARLINES.has('g'));
  assert.ok(!BARLINES.has('fgf'));
});

// ─── language registry ────────────────────────────────────────────────────────

test('language: register and get', () => {
  const plugin = { code: 'xx', label: 'Test Language', syllabifier: new PassthroughSyllabifier() };
  registerLanguage(plugin);
  assert.strictEqual(getLanguage('xx'), plugin);
});

test('language: getLanguage returns undefined for unknown code', () => {
  assert.strictEqual(getLanguage('zz'), undefined);
});

test('language: listLanguages returns sorted array by label', () => {
  registerLanguage({ code: 'bb', label: 'Zeta', syllabifier: new PassthroughSyllabifier() });
  registerLanguage({ code: 'aa', label: 'Alpha', syllabifier: new PassthroughSyllabifier() });
  const list = listLanguages();
  const labels = list.map(p => p.label);
  const sorted = [...labels].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(labels, sorted);
});

test('language: listLanguages includes registered plugin', () => {
  const plugin = { code: 'yy', label: 'Yolo', syllabifier: new PassthroughSyllabifier() };
  registerLanguage(plugin);
  assert.ok(listLanguages().some(p => p.code === 'yy'));
});
