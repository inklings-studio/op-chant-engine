import { listLanguages, getLanguage } from '../common/language.js';
import { parseText } from '../common/parser.js';
import { compileGabc } from '../common/compiler.js';
import { tokenizeMelody } from '../common/melody.js';
import { createMelodyInputRow, renderTrack, updateInputOverflow } from '../common/editor.js';

let _state = null;
let _onGabcCompiled = null;

// ─── DOM refs (initialised in initEditor to allow Node.js test imports) ───────
let _langSel, _clefSel, _strophicChk, _largeInitChk, _stanzaNumChk,
  _annotationInput, _rawText, _buildBtn, _rebuildBtn, _fitTextBtn,
  _editToggle, _fontSel, _fontSizeInput, _pageWidthInput, _pageHeightInput,
  _textArea, _stanzasEl;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the editor: populates static controls from state, wires events.
 * Call once on page load. Renders stanzas if state already has content.
 * @param {object} state
 * @param {function(string): void} onGabcCompiled
 */
export function initEditor(state, onGabcCompiled) {
  _langSel = document.getElementById('editorLang');
  _clefSel = document.getElementById('editorClef');
  _strophicChk = document.getElementById('editorStrophic');
  _largeInitChk = document.getElementById('editorLargeInitial');
  _stanzaNumChk = document.getElementById('editorStanzaNumbers');
  _annotationInput = document.getElementById('editorAnnotation');
  _rawText = document.getElementById('editorRawText');
  _buildBtn = document.getElementById('editorBuildBtn');
  _rebuildBtn = document.getElementById('editorRebuildBtn');
  _fitTextBtn = document.getElementById('editorFitTextBtn');
  _editToggle = document.getElementById('editorEditToggle');
  _fontSel = document.getElementById('editorFont');
  _fontSizeInput = document.getElementById('editorFontSize');
  _pageWidthInput = document.getElementById('editorPageWidth');
  _pageHeightInput = document.getElementById('editorPageHeight');
  _textArea = document.getElementById('editorTextInputArea');
  _stanzasEl = document.getElementById('editorStanzas');

  _state = state;
  _onGabcCompiled = onGabcCompiled;

  _populateLangSelect(state);
  _syncControlsToState(state);
  _wireStaticEvents(state);

  _syncBuildButtons(state);

  if (state.stanzas.length > 0 || state.coda) {
    _renderStanzas(state);
    _showStanzas();
  }
}

/**
 * Rebuilds only the stanza rows (call after dirty-flag sync rewrites state).
 * @param {object} state
 */
export function rebuildStanzas(state) {
  _state = state;
  _syncControlsToState(state);
  _renderStanzas(state);
  _showStanzas();
  _syncBuildButtons(state);
  _syncRawTextarea(state);
}

/**
 * Recompiles and fires onGabcCompiled.
 * @param {object} [state]
 * @param {function(string): void} [onGabcCompiled]
 */
export function triggerCompile(state, onGabcCompiled) {
  const s = state ?? _state;
  const cb = onGabcCompiled ?? _onGabcCompiled;
  cb?.(compileGabc(s));
}

// ─── Raw textarea sync ────────────────────────────────────────────────────────

function _syllabifiedLine(line) {
  const { syllables, wordMap } = line;
  if (!syllables?.length) return '';
  let text = '';
  let prev = -1;
  syllables.forEach((syl, i) => {
    const wIdx = wordMap?.[i] ?? i;
    if (prev !== -1) text += wIdx === prev ? '|' : ' ';
    text += syl;
    prev = wIdx;
  });
  return text;
}

function _syncRawTextarea(state) {
  const parts = state.stanzas.map(stanza =>
    stanza.lines.map(line => _syllabifiedLine(line)).filter(Boolean).join('\n')
  );
  if (state.coda) {
    const codaText = _syllabifiedLine(state.coda);
    if (parts.length > 0) parts[parts.length - 1] += '\n' + codaText;
    else parts.push(codaText);
  }
  _rawText.value = parts.join('\n\n');
}

// ─── Static control wiring ────────────────────────────────────────────────────

function _populateLangSelect(state) {
  const sel = _langSel;
  sel.innerHTML = '';
  listLanguages().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.code;
    opt.textContent = p.label;
    opt.selected = p.code === state.language;
    sel.appendChild(opt);
  });
}

function _syncControlsToState(state) {
  _langSel.value = state.language;
  _clefSel.value = state.clef;
  _strophicChk.checked = state.strophicInheritance;
  _largeInitChk.checked = state.largeInitial;
  _stanzaNumChk.checked = state.stanzaNumbers;
  _annotationInput.value = state.annotation ?? '';
  _fontSel.value = state.font ?? '';
  _fontSizeInput.value = state.fontSizePt ?? '';
  _pageWidthInput.value = state.pageWidthIn ?? '';
  _pageHeightInput.value = state.pageHeightIn ?? '';
}

function _wireStaticEvents(state) {
  _langSel.addEventListener('change', () => {
    state.language = _langSel.value;
    const raw = _rawText.value.trim();
    if (raw) {
      parseText(raw, state, getLanguage(state.language));
      _syncRawTextarea(state);
      _renderStanzas(state);
    }
    triggerCompile(state);
  });

  _clefSel.addEventListener('change', () => {
    state.clef = _clefSel.value;
    triggerCompile(state);
  });

  _strophicChk.addEventListener('change', () => {
    state.strophicInheritance = _strophicChk.checked;
    if (state.strophicInheritance) {
      state.stanzas[0]?.lines.forEach((_, li) => _propagateStrophicLine(state, li));
    }
    _applyStrophicStyling(state);
    triggerCompile(state);
  });

  _largeInitChk.addEventListener('change', () => {
    state.largeInitial = _largeInitChk.checked;
    triggerCompile(state);
  });

  _stanzaNumChk.addEventListener('change', () => {
    state.stanzaNumbers = _stanzaNumChk.checked;
    triggerCompile(state);
  });

  _annotationInput.addEventListener('input', () => {
    state.annotation = _annotationInput.value;
    triggerCompile(state);
  });

  _buildBtn.addEventListener('click', () => {
    const raw = _rawText.value.trim();
    if (!raw) return;
    parseText(raw, state, getLanguage(state.language));
    _syncRawTextarea(state);
    _renderStanzas(state);
    _showStanzas();
    _syncBuildButtons(state);
    triggerCompile(state);
  });

  _rebuildBtn.addEventListener('click', () => {
    const raw = _rawText.value.trim();
    if (!raw) return;
    state.stanzas = [];
    state.coda = null;
    parseText(raw, state, getLanguage(state.language));
    _syncRawTextarea(state);
    _renderStanzas(state);
    _showStanzas();
    triggerCompile(state);
  });

  _fitTextBtn.addEventListener('click', () => {
    const raw = _rawText.value.trim();
    if (!raw) return;
    parseText(raw, state, getLanguage(state.language));
    // Textarea not overwritten — user's | edits are preserved.
    _renderStanzas(state);
    _showStanzas();
    triggerCompile(state);
  });

  _editToggle.addEventListener('click', () => {
    const hidden = _textArea.classList.toggle('hidden');
    _editToggle.textContent = hidden ? 'Edit text' : 'Hide';
    // Hide stanza container while textarea is visible so it gets full flex-1 height.
    _stanzasEl.classList.toggle('hidden', !hidden);
  });

  // Return focus to page after any select/checkbox change so Space key works for playback
  document.querySelectorAll('#editorTab select, #editorTab input[type=checkbox]').forEach(el => {
    el.addEventListener('change', () => el.blur());
  });

  _fontSel.addEventListener('change', () => {
    state.font = _fontSel.value || null;
    triggerCompile(state);
  });

  const _parsePosNum = (el) => { const v = parseFloat(el.value); return (v > 0) ? v : null; };

  _fontSizeInput.addEventListener('input', () => {
    state.fontSizePt = _parsePosNum(_fontSizeInput);
    triggerCompile(state);
  });

  _pageWidthInput.addEventListener('input', () => {
    state.pageWidthIn = _parsePosNum(_pageWidthInput);
    triggerCompile(state);
  });

  _pageHeightInput.addEventListener('input', () => {
    state.pageHeightIn = _parsePosNum(_pageHeightInput);
    triggerCompile(state);
  });
}

function _showStanzas() {
  _textArea.classList.add('hidden');
  _stanzasEl.classList.remove('hidden');
  _editToggle.classList.remove('hidden');
  _editToggle.textContent = 'Edit text';
}

// Swap between Build (empty state) and Re-Build + Fit Text (has content).
function _syncBuildButtons(state) {
  const hasContent = state.stanzas.length > 0 || !!state.coda;
  _buildBtn.classList.toggle('hidden', hasContent);
  _rebuildBtn.classList.toggle('hidden', !hasContent);
  _fitTextBtn.classList.toggle('hidden', !hasContent);
}

// ─── Dynamic stanza rows ──────────────────────────────────────────────────────

function _handleLineUpdate({ si, li, notes, parsedNotes }) {
  const target = si === 'coda' ? _state.coda : _state.stanzas[si]?.lines[li];
  if (!target) return null;

  target.notes = notes;
  target.parsedNotes = parsedNotes;

  if (si === 0 && _state.strophicInheritance) {
    _propagateStrophicLine(_state, li);
  }

  triggerCompile(_state);
  return target;
}

function _renderStanzas(state) {
  const container = _stanzasEl;
  container.innerHTML = '';

  state.stanzas.forEach((stanza, si) => {
    const stanzaEl = document.createElement('div');
    stanzaEl.className = 'mb-4';

    const label = document.createElement('div');
    label.className = 'text-xs font-semibold uppercase tracking-wide text-op-ink-faint mb-1';
    label.textContent = `Stanza ${si + 1}`;
    stanzaEl.appendChild(label);

    stanza.lines.forEach((line, li) => {
      const row = createMelodyInputRow(line, si, li, { onUpdate: _handleLineUpdate });
      stanzaEl.appendChild(row);
    });
    container.appendChild(stanzaEl);
  });

  if (state.coda) {
    const codaEl = document.createElement('div');
    codaEl.className = 'mb-4';
    const label = document.createElement('div');
    label.className = 'text-xs font-semibold uppercase tracking-wide text-op-ink-faint mb-1';
    label.textContent = 'Coda';
    codaEl.appendChild(label);
    const row = createMelodyInputRow(state.coda, 'coda', 0, { onUpdate: _handleLineUpdate });
    codaEl.appendChild(row);
    container.appendChild(codaEl);
  }

  _applyStrophicStyling(state);
}

// ─── Strophic helpers ─────────────────────────────────────────────────────────

function _applyStrophicStyling(state) {
  document.querySelectorAll('.editor-melody-input[data-stanza]').forEach(input => {
    const si = input.dataset.stanza;
    if (si === 'coda' || Number(si) === 0) return;
    input.classList.toggle('editor-melody-input-strophic', state.strophicInheritance);
  });
}

function _propagateStrophicLine(state, li) {
  const src = state.stanzas[0]?.lines[li];
  if (!src) return;
  document.querySelectorAll(`.editor-melody-input[data-line="${li}"]`).forEach(input => {
    const si = Number(input.dataset.stanza);
    if (isNaN(si) || si === 0) return;
    const target = state.stanzas[si]?.lines[li];
    if (!target) return;
    target.notes = src.notes;
    target.parsedNotes = src.parsedNotes;
    input.value = src.notes;
    const track = input.nextElementSibling;
    if (track) {
      renderTrack(track, target.syllables, target.parsedNotes, target.wordMap ?? null);
      updateInputOverflow(input, target.syllables, target.parsedNotes);
    }
  });
}