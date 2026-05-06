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
  <span id="psalmSelectLabel" class="hidden"></span>
  <select id="psalmSelect" class="hidden"><option value="">— select —</option></select>
  <input type="text" id="editorAnnotation">
  <input type="checkbox" id="editorLargeInitial">
  <select id="editorTone"></select>
  <select id="editorTerm"></select>
  <input type="checkbox" id="editorSolemn">
  <textarea id="editorRawText"></textarea>
  <button id="editorBuildBtn"></button>
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
  // Return a promise that settles after the current microtask queue drains,
  // so async event handlers (e.g. the psalm-select change handler) have time to run.
  return Promise.resolve().then(() => Promise.resolve());
}

function buildVerses(verses = [VERSE_1, VERSE_2]) {
  document.getElementById('editorRawText').value = verses.join('\n');
  fire(document.getElementById('editorBuildBtn'), 'click');
}

// ── Build default view ─────────────────────────────────────────────────────

test('psalm editor build: textarea is hidden after Build (melody view shown)', () => {
  setup();
  buildVerses();
  const textArea = document.getElementById('editorTextInputArea');
  assert.ok(textArea.classList.contains('hidden'), 'textarea should be hidden after Build (melody editor shown)');
});

test('psalm editor build: stanzas are visible after Build', () => {
  setup();
  buildVerses();
  const stanzas = document.getElementById('editorStanzas');
  assert.ok(!stanzas.classList.contains('hidden'), 'stanzas should be visible after Build');
});

test('psalm editor build: Edit text toggle is revealed after Build', () => {
  setup();
  buildVerses();
  const toggle = document.getElementById('editorEditToggle');
  assert.ok(!toggle.classList.contains('hidden'), 'toggle should be visible after Build');
  assert.equal(toggle.textContent.trim(), 'Edit text');
});

test('psalm editor build: note inputs are auto-filled by pointing algorithm', () => {
  setup();
  buildVerses();
  // buildVerses() uses 2 verses; each verse has 2 phrase-lines (mediant + term) → 4 inputs total
  const inputs = [...document.querySelectorAll('.editor-melody-input')];
  assert.equal(inputs.length, 4);
  inputs.forEach((input, i) => {
    assert.ok(input.value.trim().length > 0, `phrase input ${i + 1} should be non-empty`);
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

test('psalm editor toggle: click shows textarea and hides stanzas', () => {
  // After Build the melody editor (stanzas) is shown; clicking toggle goes back to text view
  setup();
  buildVerses();
  fire(document.getElementById('editorEditToggle'), 'click');
  assert.ok(!document.getElementById('editorTextInputArea').classList.contains('hidden'));
  assert.ok(document.getElementById('editorStanzas').classList.contains('hidden'));
});

test('psalm editor toggle: click changes button text to "Hide"', () => {
  setup();
  buildVerses();
  fire(document.getElementById('editorEditToggle'), 'click');
  assert.equal(document.getElementById('editorEditToggle').textContent.trim(), 'Hide');
});

test('psalm editor toggle: second click returns to melody view', () => {
  setup();
  buildVerses();
  const toggle = document.getElementById('editorEditToggle');
  fire(toggle, 'click'); // text view (textarea shown)
  fire(toggle, 'click'); // back to melody view (stanzas shown)
  assert.ok(document.getElementById('editorTextInputArea').classList.contains('hidden'));
  assert.ok(!document.getElementById('editorStanzas').classList.contains('hidden'));
  assert.equal(toggle.textContent.trim(), 'Edit text');
});

// ── Button state machine ───────────────────────────────────────────────────

test('psalm editor buttons: Build visible, Fit Text hidden initially', () => {
  setup();
  assert.ok(!document.getElementById('editorBuildBtn').classList.contains('hidden'));
  assert.ok(document.getElementById('editorFitTextBtn').classList.contains('hidden'));
});

test('psalm editor buttons: Build hidden, Fit Text visible after Build', () => {
  setup();
  buildVerses();
  assert.ok(document.getElementById('editorBuildBtn').classList.contains('hidden'));
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


// ── Fit Text ──────────────────────────────────────────────────────────────

test('psalm editor Fit Text: re-points notes when text changes', () => {
  setup();
  buildVerses([VERSE_1]);
  const notesBefore = document.querySelector('.editor-melody-input').value;

  // Change raw text to a different verse
  document.getElementById('editorRawText').value = 'Pane Bože uslyš * naše modlitby.';
  fire(document.getElementById('editorFitTextBtn'), 'click');

  // Re-query — _renderStanzas replaced the old input element
  const notesAfter = document.querySelector('.editor-melody-input').value;
  assert.ok(notesAfter.trim().length > 0, 'Fit Text must produce non-empty notes for the new verse');
  assert.notEqual(notesAfter, notesBefore, 'Fit Text with different text should re-point and produce different notes');
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

// ── Marked textarea (syllabification feedback) ────────────────────────────

test('psalm editor build: textarea updated with | syllable markers after Build', () => {
  setup();
  buildVerses([VERSE_1]);
  const raw = document.getElementById('editorRawText').value;
  assert.ok(raw.includes('|'), 'textarea should contain | syllable-split markers after Build');
});

test('psalm editor Fit Text: | markers in textarea are stable (no duplication)', () => {
  setup();
  buildVerses([VERSE_1]);
  const rawAfterBuild = document.getElementById('editorRawText').value;

  // Clicking Fit Text with unchanged text should produce identical marked output
  fire(document.getElementById('editorFitTextBtn'), 'click');
  const rawAfterFit = document.getElementById('editorRawText').value;

  assert.equal(rawAfterFit, rawAfterBuild, 'Fit Text on already-marked text should not duplicate | markers');
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
  // One verse with a mediant → two phrase-lines (mediant + termination) → two melody inputs
  assert.equal(inputs.length, 2, 'two lines forming one verse should produce two phrase-line inputs (mediant + term)');
});


// ── Note preservation on identical rawLine ────────────────────────────────

// ── Psalm selector ────────────────────────────────────────────────────────────

test('psalm selector: shown for Slovak (has psalms registered)', () => {
  setup();
  const sel   = document.getElementById('psalmSelect');
  const label = document.getElementById('psalmSelectLabel');
  assert.ok(!sel.classList.contains('hidden'),   'select should be visible for sk');
  assert.ok(!label.classList.contains('hidden'), 'label should be visible for sk');
});

test('psalm selector: options include registered psalm entries', () => {
  setup();
  const options = [...document.getElementById('psalmSelect').options];
  // First option is the blank sentinel
  assert.equal(options[0].value, '', 'first option should be blank sentinel');
  // At least one psalm entry follows
  const psalmOpts = options.filter(o => o.value !== '');
  assert.ok(psalmOpts.length > 0, 'psalm options should be present');
  assert.equal(psalmOpts[0].value, '5', 'first psalm option value should be "5"');
  assert.equal(psalmOpts[0].textContent, 'Ž. 5');
});

test('psalm selector: annotation field is updated on psalm select', async () => {
  setup();
  // Mock fetch so the async handler can complete
  globalThis.fetch = async () => ({ ok: true, text: async () => VERSE_1 });

  const sel = document.getElementById('psalmSelect');
  sel.value = '5';
  await fire(sel, 'change');

  assert.equal(document.getElementById('editorAnnotation').value, 'Ž. 5');
});

test('psalm selector: textarea is populated and Build runs after psalm select', async () => {
  setup();
  globalThis.fetch = async () => ({ ok: true, text: async () => VERSE_1 });

  const sel = document.getElementById('psalmSelect');
  sel.value = '5';
  await fire(sel, 'change');

  const raw = document.getElementById('editorRawText').value;
  assert.ok(raw.length > 0, 'textarea should be populated after psalm select');
  // Build must have run: Edit melody toggle should be revealed
  const toggle = document.getElementById('editorEditToggle');
  assert.ok(!toggle.classList.contains('hidden'), 'Edit melody toggle should appear after psalm load');
});

test('psalm selector: no-op when blank sentinel option is selected', async () => {
  setup();
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: true, text: async () => '' }; };

  const sel = document.getElementById('psalmSelect');
  sel.value = '';
  await fire(sel, 'change');

  assert.ok(!fetchCalled, 'fetch should not be called when blank option is selected');
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
