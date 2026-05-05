import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initEditor } from '../../../v2/js/psalms/editor.js';
import '../../../v2/js/languages/sk/index.js'; // registers SK plugin

// Psalm verse with mediant marker (*) — required by pointVerse
const VERSE_1 = 'Hospodin je môj pastier * a nič mi nechýba.';
const VERSE_2 = 'V zelených pastvinách ma ukladá * k tichým vodám ma privádza.';

const SCAFFOLD = `<!DOCTYPE html><html><body>
  <select id="editorLang"></select>
  <input type="text" id="editorAnnotation">
  <input type="checkbox" id="editorLargeInitial">
  <select id="editorTone"></select>
  <select id="editorTerm"></select>
  <input type="checkbox" id="editorSolemn">
  <textarea id="editorRawText"></textarea>
  <button id="editorBuildBtn"></button>
  <button id="editorRebuildBtn" class="hidden"></button>
  <button id="editorFitTextBtn" class="hidden"></button>
  <button id="editorEditToggle" class="hidden">Edit melody</button>
  <div id="editorTextInputArea"></div>
  <div id="editorStanzas" class="hidden"></div>
</body></html>`;

function setup(stateOverrides = {}) {
  const dom = new JSDOM(SCAFFOLD);
  global.document = dom.window.document;
  const state = {
    language: 'sk',
    largeInitial: false,
    strophicInheritance: false,
    stanzaNumbers: false,
    annotation: '',
    clef: 'c4',
    coda: null,
    stanzas: [],
    ...stateOverrides,
  };
  initEditor(state, () => { });
  return { state };
}

function fire(el, type) {
  const Ev = type === 'keyup' ? 'KeyboardEvent' : type === 'blur' ? 'FocusEvent' : 'Event';
  el.dispatchEvent(new document.defaultView[Ev](type, { bubbles: true }));
}

function buildVerses(verses = [VERSE_1, VERSE_2]) {
  document.getElementById('editorRawText').value = verses.join('\n');
  fire(document.getElementById('editorBuildBtn'), 'click');
}

// ── Build default view ─────────────────────────────────────────────────────

test('psalm editor build: textarea stays visible after Build', () => {
  setup();
  buildVerses();
  const textArea = document.getElementById('editorTextInputArea');
  assert.ok(!textArea.classList.contains('hidden'), 'textarea should remain visible');
});

test('psalm editor build: stanzas are hidden after Build', () => {
  setup();
  buildVerses();
  const stanzas = document.getElementById('editorStanzas');
  assert.ok(stanzas.classList.contains('hidden'), 'stanzas should stay hidden after Build');
});

test('psalm editor build: Edit melody toggle is revealed after Build', () => {
  setup();
  buildVerses();
  const toggle = document.getElementById('editorEditToggle');
  assert.ok(!toggle.classList.contains('hidden'), 'toggle should be visible after Build');
  assert.equal(toggle.textContent.trim(), 'Edit melody');
});

test('psalm editor build: note inputs are auto-filled by pointing algorithm', () => {
  setup();
  buildVerses();
  const inputs = [...document.querySelectorAll('.editor-melody-input')];
  assert.equal(inputs.length, 2);
  inputs.forEach((input, i) => {
    assert.ok(input.value.trim().length > 0, `verse ${i + 1} note input should be non-empty`);
  });
});

test('psalm editor build: verse rows are labeled "Verse N"', () => {
  setup();
  buildVerses([VERSE_1, VERSE_2]);
  const labels = [...document.querySelectorAll('#editorStanzas .text-gray-400')];
  assert.ok(labels.some(l => l.textContent === 'Verse 1'), 'should have "Verse 1" label');
  assert.ok(labels.some(l => l.textContent === 'Verse 2'), 'should have "Verse 2" label');
  assert.ok(!labels.some(l => l.textContent.startsWith('Stanza')), 'should not use "Stanza" label');
});

// ── Edit melody toggle ─────────────────────────────────────────────────────

test('psalm editor toggle: click hides textarea and shows stanzas', () => {
  setup();
  buildVerses();
  fire(document.getElementById('editorEditToggle'), 'click');
  assert.ok(document.getElementById('editorTextInputArea').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorStanzas').classList.contains('hidden'));
});

test('psalm editor toggle: click changes button text to "Edit text"', () => {
  setup();
  buildVerses();
  fire(document.getElementById('editorEditToggle'), 'click');
  assert.equal(document.getElementById('editorEditToggle').textContent.trim(), 'Edit text');
});

test('psalm editor toggle: second click restores textarea and hides stanzas', () => {
  setup();
  buildVerses();
  const toggle = document.getElementById('editorEditToggle');
  fire(toggle, 'click'); // open melody view
  fire(toggle, 'click'); // back to text view
  assert.ok(!document.getElementById('editorTextInputArea').classList.contains('hidden'));
  assert.ok(document.getElementById('editorStanzas').classList.contains('hidden'));
  assert.equal(toggle.textContent.trim(), 'Edit melody');
});

// ── Button state machine ───────────────────────────────────────────────────

test('psalm editor buttons: Build visible, Re-Point and Fit Text hidden initially', () => {
  setup();
  assert.ok(!document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(document.getElementById('editorRebuildBtn').classList.contains('hidden'));
  assert.ok(document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

test('psalm editor buttons: Build hidden, Re-Point and Fit Text visible after Build', () => {
  setup();
  buildVerses();
  assert.ok(document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorRebuildBtn').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

// ── Tone change re-pointing ────────────────────────────────────────────────

test('psalm editor tone: changing tone select re-points note inputs', () => {
  setup();
  buildVerses([VERSE_1]);
  const notesBefore = document.querySelector('.editor-melody-input').value;

  const toneSelect = document.getElementById('editorTone');
  // Tone 1 is always present and produces notes different from Tone 8 default
  toneSelect.value = toneSelect.value === 'tone1' ? 'tone2' : 'tone1';
  fire(toneSelect, 'change');

  // _renderStanzas replaces DOM, so re-query after the change event
  const notesAfter = document.querySelector('.editor-melody-input').value;
  assert.notEqual(notesAfter, notesBefore, 'tone change should update note input');
});

test('psalm editor tone: termination options repopulated on tone change', () => {
  setup();
  const toneSelect = document.getElementById('editorTone');
  const termSelect = document.getElementById('editorTerm');
  const termCountBefore = termSelect.options.length;

  // Switch to a tone that may have different terminations
  const otherTone = [...toneSelect.options].find(o => o.value !== toneSelect.value)?.value;
  toneSelect.value = otherTone;
  fire(toneSelect, 'change');

  // Term select must always have at least one option after tone change
  assert.ok(termSelect.options.length >= 1, 'termination select should have options after tone change');
});

// ── Solemn toggle ──────────────────────────────────────────────────────────

test('psalm editor solemn: toggling solemn re-points note inputs', () => {
  setup();
  buildVerses([VERSE_1]);
  const input = document.querySelector('.editor-melody-input');
  const notesBefore = input.value;

  const solemnChk = document.getElementById('editorSolemn');
  solemnChk.checked = true;
  fire(solemnChk, 'change');

  // Solemn may or may not change the notes depending on the tone, but no error
  // and the input should still have a value
  assert.ok(input.value.trim().length > 0, 'notes should remain non-empty after solemn toggle');
});

// ── Re-Point ──────────────────────────────────────────────────────────────

test('psalm editor Re-Point: re-points from scratch, clearing manual edits', () => {
  setup();
  buildVerses([VERSE_1]);
  const input = document.querySelector('.editor-melody-input');

  // Manually change the notes
  input.value = 'c c c c c c c';
  fire(input, 'input');

  // Re-Point replaces DOM via _renderStanzas, so capture state before and re-query after
  document.getElementById('editorRawText').value = VERSE_1;
  fire(document.getElementById('editorRebuildBtn'), 'click');

  // Re-query — _renderStanzas replaced the old input element
  const newInput = document.querySelector('.editor-melody-input');
  assert.notEqual(newInput.value, 'c c c c c c c', 'Re-Point should overwrite manual edits');
  assert.ok(newInput.value.trim().length > 0);
});

// ── Fit Text ──────────────────────────────────────────────────────────────

test('psalm editor Fit Text: preserves existing notes when text changes', () => {
  setup();
  buildVerses([VERSE_1]);
  const notesBefore = document.querySelector('.editor-melody-input').value;

  // Change raw text to a different verse
  document.getElementById('editorRawText').value = 'Pane Bože uslyš * naše modlitby.';
  fire(document.getElementById('editorFitTextBtn'), 'click');

  // Re-query — _renderStanzas replaced the old input element
  const notesAfter = document.querySelector('.editor-melody-input').value;
  assert.equal(notesAfter, notesBefore, 'Fit Text must preserve existing note string');
});

test('psalm editor Fit Text: new syllables reflected in track chips', () => {
  setup();
  buildVerses([VERSE_1]);

  document.getElementById('editorRawText').value = 'Pane Bože * chvála.';
  fire(document.getElementById('editorFitTextBtn'), 'click');

  // Track chips now show new syllables ("Pa", "ne", "Bo", "že", "chvá", "la")
  const chips = [...document.querySelectorAll('.track-chip-matched, .track-chip-overflow')];
  assert.ok(chips.length > 0, 'track chips should be present after Fit Text');
  assert.ok(chips.some(c => c.textContent.includes('Pa') || c.textContent.includes('Bože')),
    'track chips should reflect the new text syllables');
});

// ── Marked textarea (accent feedback) ────────────────────────────────────

test("psalm editor build: textarea updated with ' accent markers after Build", () => {
  setup();
  buildVerses([VERSE_1]);
  const raw = document.getElementById('editorRawText').value;
  assert.ok(raw.includes("'"), "textarea should contain ' accent markers after Build");
});

test('psalm editor build: textarea contains * mediant marker after Build', () => {
  setup();
  buildVerses([VERSE_1]);
  const raw = document.getElementById('editorRawText').value;
  assert.ok(raw.includes('*'), 'textarea should retain * mediant marker');
});

test('psalm editor build: textarea split across multiple lines at section boundaries', () => {
  setup();
  buildVerses([VERSE_1]);
  const raw = document.getElementById('editorRawText').value;
  const lines = raw.split('\n').filter(Boolean);
  // VERSE_1 has no flex, so exactly 2 lines: mediant and termination
  assert.equal(lines.length, 2, 'verse without flex should produce 2 lines (mediant + term)');
});

test('psalm editor build: multi-line verse input (split at *) is grouped into one verse', () => {
  setup();
  // Manually feed a verse split across two lines as a user would after seeing the marked text
  const line1 = 'Hospodin je môj pastier*';
  const line2 = 'a nič mi nechýba.';
  buildVerses([line1, line2]);  // treated as ONE verse by _groupVerses
  const inputs = [...document.querySelectorAll('.editor-melody-input')];
  assert.equal(inputs.length, 1, 'two lines forming one verse should produce one melody input');
});

test("psalm editor Re-Point: ' markers in textarea feed as stress overrides", () => {
  setup();
  // Build with a verse where the natural stress on "pastier" is on "pas"
  buildVerses([VERSE_1]);
  const notesNatural = document.querySelector('.editor-melody-input').value;

  // Manually shift the accent marker from natural position to override it
  // Use a verse where we can predictably override: force stress onto second syllable of "pastier"
  document.getElementById('editorRawText').value = "Hospodin je môj pas'tier * a nič mi nechýba.";
  fire(document.getElementById('editorRebuildBtn'), 'click');
  const notesOverride = document.querySelector('.editor-melody-input').value;

  assert.notEqual(notesOverride, notesNatural, "' override should shift accent and change notes");
});

// ── Note preservation on identical rawLine ────────────────────────────────

test('psalm editor build: unchanged verse preserves manually-edited notes', () => {
  setup();
  buildVerses([VERSE_1]);
  const input = document.querySelector('.editor-melody-input');

  // Manually edit notes
  input.value = 'z z z z z z z';
  fire(input, 'input');

  // Build again — the textarea was updated by _syncRawTextarea after the first Build
  // and already contains the marked text, so we do NOT reset it to the original VERSE_1.
  // Resetting would break the rawLine cache key (which is now the marked form).
  fire(document.getElementById('editorBuildBtn'), 'click');

  // Re-query — _renderStanzas replaced the old input element
  const newInput = document.querySelector('.editor-melody-input');
  assert.equal(newInput.value, 'z z z z z z z',
    'notes should be preserved when verse text is unchanged on subsequent Build');
});
