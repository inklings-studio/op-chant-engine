import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initEditor } from '../../../v2/js/transcriber/editor.js';
import '../../../v2/js/languages/sk/index.js'; // registers SK plugin

const SCAFFOLD = `<!DOCTYPE html><html><body>
  <select id="editorLang"></select>
  <select id="editorClef"><option value="c4">c4</option><option value="c3">c3</option></select>
  <input type="checkbox" id="editorStrophic">
  <input type="checkbox" id="editorLargeInitial">
  <input type="checkbox" id="editorStanzaNumbers">
  <input type="text" id="editorAnnotation">
  <select id="editorFont"><option value=""></option><option value="Crimson">Crimson</option></select>
  <input type="number" id="editorFontSize">
  <input type="number" id="editorPageWidth">
  <input type="number" id="editorPageHeight">
  <textarea id="editorRawText"></textarea>
  <button id="editorBuildBtn"></button>
  <button id="editorRebuildBtn"></button>
  <button id="editorFitTextBtn"></button>
  <button id="editorEditToggle">Edit text</button>
  <div id="editorTextInputArea"></div>
  <div id="editorStanzas"></div>
</body></html>`;

function setup(stateOverrides = {}) {
  const dom = new JSDOM(SCAFFOLD);
  global.document = dom.window.document;
  const state = {
    language: 'sk',
    clef: 'c4',
    largeInitial: false,
    strophicInheritance: false,
    stanzaNumbers: false,
    annotation: '',
    coda: null,
    stanzas: [],
    ...stateOverrides,
  };
  initEditor(state, () => { });
  return { state };
}

function mkLine(syllables, parsedNotes) {
  return { syllables, wordMap: syllables.map((_, i) => i), notes: parsedNotes.join(' '), parsedNotes };
}

function mkStanza(...lines) {
  return { lines: lines.map(([syls, notes]) => mkLine(syls, notes)) };
}

function fire(el, type) {
  el.dispatchEvent(new document.defaultView[type === 'keyup' ? 'KeyboardEvent' : type === 'blur' ? 'FocusEvent' : 'Event'](type, { bubbles: true }));
}

// ── Editor alignment track ─────────────────────────────────────────────────

test('editor track: 2 matched + 1 overflow when notes < syllables', () => {
  setup({ stanzas: [mkStanza([['Kris', 'te', 'Rex'], ['f', 'g']])] });
  assert.equal(document.querySelectorAll('.track-chip-matched').length, 2);
  assert.equal(document.querySelectorAll('.track-chip-overflow').length, 1);
  assert.equal(document.querySelectorAll('.track-chip-empty').length, 0);
});

test('editor track: barline chip rendered for comma token', () => {
  setup({ stanzas: [mkStanza([['Kris', 'te'], ['f', ',', 'g']])] });
  assert.equal(document.querySelectorAll('.track-chip-barline').length, 1);
});

test('editor track: 1 matched + 1 empty when notes > syllables', () => {
  setup({ stanzas: [mkStanza([['Kris'], ['f', 'g']])] });
  assert.equal(document.querySelectorAll('.track-chip-matched').length, 1);
  assert.equal(document.querySelectorAll('.track-chip-empty').length, 1);
});

test('editor track: melody input gets overflow class when notes > syllables', () => {
  setup({ stanzas: [mkStanza([['Kris'], ['f', 'g']])] });
  const input = document.querySelector('.editor-melody-input');
  assert.ok(input.classList.contains('editor-melody-input-overflow'));
});

test('editor track: exactly one chip highlighted at cursor position', () => {
  setup({ stanzas: [mkStanza([['Kris', 'te', 'Rex'], ['f', 'g', 'h']])] });
  const input = document.querySelector('.editor-melody-input');
  // selectionStart=2 lands on 'g' in 'f g h' → note index 1
  input.selectionStart = 2;
  input.selectionEnd = 2;
  fire(input, 'keyup');
  const cursors = document.querySelectorAll('.track-chip-cursor');
  assert.equal(cursors.length, 1);
  cursors.forEach(c => assert.ok(!c.classList.contains('track-chip-matched')));
});

test('editor track: cursor highlight cleared on blur', () => {
  setup({ stanzas: [mkStanza([['Kris', 'te', 'Rex'], ['f', 'g', 'h']])] });
  const input = document.querySelector('.editor-melody-input');
  input.selectionStart = 2;
  input.selectionEnd = 2;
  fire(input, 'keyup');
  assert.equal(document.querySelectorAll('.track-chip-cursor').length, 1);
  fire(input, 'blur');
  assert.equal(document.querySelectorAll('.track-chip-cursor').length, 0);
});

// ── Strophic copy ──────────────────────────────────────────────────────────

test('editor strophic: stanza 0 edit propagates to stanza 1+ when strophic ON', () => {
  setup({
    strophicInheritance: true,
    stanzas: [mkStanza([['Kris', 'te'], ['f', 'g']]), mkStanza([['Pa', 'ne'], ['f', 'g']])],
  });
  const inputs = [...document.querySelectorAll('.editor-melody-input[data-stanza]')];
  const s0 = inputs.find(i => i.dataset.stanza === '0' && i.dataset.line === '0');
  const s1 = inputs.find(i => i.dataset.stanza === '1' && i.dataset.line === '0');
  s0.value = 'c d e';
  fire(s0, 'input');
  assert.equal(s1.value, 'c d e');
});

test('editor strophic: stanza 1+ inputs have strophic class when strophic ON', () => {
  setup({
    strophicInheritance: true,
    stanzas: [mkStanza([['Kris', 'te'], ['f', 'g']]), mkStanza([['Pa', 'ne'], ['f', 'g']])],
  });
  const s1inputs = [...document.querySelectorAll('.editor-melody-input[data-stanza="1"]')];
  assert.ok(s1inputs.length > 0);
  s1inputs.forEach(i => assert.ok(i.classList.contains('editor-melody-input-strophic')));
});

test('editor strophic: toggle ON propagates stanza 0 notes to stanza 1+', () => {
  setup({
    strophicInheritance: false,
    stanzas: [mkStanza([['Kris', 'te'], ['c', 'd']]), mkStanza([['Pa', 'ne'], ['f', 'g']])],
  });
  const chk = document.getElementById('editorStrophic');
  chk.checked = true;
  fire(chk, 'change');
  const s1 = document.querySelector('.editor-melody-input[data-stanza="1"][data-line="0"]');
  assert.equal(s1.value, 'c d');
});

test('editor strophic: stanza 1+ remain editable and un-grayed when strophic OFF', () => {
  setup({
    strophicInheritance: false,
    stanzas: [mkStanza([['Kris', 'te'], ['f', 'g']]), mkStanza([['Pa', 'ne'], ['f', 'g']])],
  });
  const s1inputs = [...document.querySelectorAll('.editor-melody-input[data-stanza="1"]')];
  s1inputs.forEach(i => assert.ok(!i.classList.contains('editor-melody-input-strophic')));

  const s0 = document.querySelector('.editor-melody-input[data-stanza="0"][data-line="0"]');
  const s1 = document.querySelector('.editor-melody-input[data-stanza="1"][data-line="0"]');
  s1.value = 'x y z';
  fire(s1, 'input');
  assert.notEqual(s0.value, 'x y z');
});

// ── Build / Re-Build / Fit Text button state machine ───────────────────────

test('editor buttons: Build visible, Re-Build and Fit Text hidden on empty state', () => {
  setup();
  assert.ok(!document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(document.getElementById('editorRebuildBtn').classList.contains('hidden'));
  assert.ok(document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

test('editor buttons: Build hidden, Re-Build and Fit Text visible when stanzas present', () => {
  setup({ stanzas: [mkStanza([['Kris', 'te'], ['f', 'g']])] });
  assert.ok(document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorRebuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

test('editor buttons: Build click transitions to Re-Build + Fit Text mode', () => {
  setup();
  document.getElementById('editorRawText').value = 'Kriste Rex\nsláva Bohu';
  fire(document.getElementById('editorBuildBtn'), 'click');
  assert.ok(document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorRebuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

// ── Re-Build ───────────────────────────────────────────────────────────────

test('editor Re-Build: resets melody to rectotone defaults', () => {
  const { state } = setup({
    stanzas: [mkStanza([['Kris', 'te', 'Rex'], ['c', 'd', 'e', ',']])],
  });
  document.getElementById('editorRawText').value = 'Kriste Rex\nsláva Bohu';
  fire(document.getElementById('editorRebuildBtn'), 'click');
  assert.ok(state.stanzas[0].lines[0].notes.startsWith('f f f'),
    'melody reset to rectotone f notes');
});

test('editor Re-Build: stays in Re-Build + Fit Text mode after reset', () => {
  setup({ stanzas: [mkStanza([['Kris', 'te'], ['f', 'g']])] });
  document.getElementById('editorRawText').value = 'Pane Bože\nchvála tebe';
  fire(document.getElementById('editorRebuildBtn'), 'click');
  assert.ok(document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorRebuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

// ── Fit Text ───────────────────────────────────────────────────────────────

test('editor Fit Text: preserves existing melody when text changes', () => {
  const customNotes = 'c d e ;';
  const { state } = setup({
    stanzas: [mkStanza([['Kris', 'te', 'Rex'], ['c', 'd', 'e', ';']])],
  });
  document.getElementById('editorRawText').value = 'Pane Bože Kriste\nuslyš naše volanie';
  fire(document.getElementById('editorFitTextBtn'), 'click');
  assert.equal(state.stanzas[0].lines[0].notes, customNotes);
});

test('editor Fit Text: new syllable count reflected in track chips', () => {
  // Single-line stanza with 2 notes. Fit Text with a single line of 5 syllables.
  // Only line 0 chips should exist, so totals are unambiguous.
  setup({ stanzas: [mkStanza([['Kris', 'te'], ['f', 'g']])] });
  document.getElementById('editorRawText').value = 'Pane Bože Rex';
  fire(document.getElementById('editorFitTextBtn'), 'click');
  // 'Pane Bože Rex' → ['Pa','ne','Bo','že','Rex'] = 5 syllables, 2 notes → 2 matched + 3 overflow
  assert.equal(document.querySelectorAll('.track-chip-matched').length, 2);
  assert.equal(document.querySelectorAll('.track-chip-overflow').length, 3);
});
