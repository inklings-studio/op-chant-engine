import { listLanguages, getLanguage } from './language.js';
import { parseText } from './parser.js';
import { compileGabc, tokenizeMelody } from './compiler.js';

const BARLINES = new Set([',', ';', ':', '::']);

let _state          = null;
let _onGabcCompiled = null;

// ─── DOM refs (all static — exist in transcriber.html) ───────────────────────
const _langSel      = () => document.getElementById('editorLang');
const _clefSel      = () => document.getElementById('editorClef');
const _strophicChk  = () => document.getElementById('editorStrophic');
const _largeInitChk = () => document.getElementById('editorLargeInitial');
const _rawText      = () => document.getElementById('editorRawText');
const _buildBtn     = () => document.getElementById('editorBuildBtn');
const _editToggle   = () => document.getElementById('editorEditToggle');
const _textArea     = () => document.getElementById('editorTextInputArea');
const _stanzasEl    = () => document.getElementById('editorStanzas');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the editor: populates static controls from state, wires events.
 * Call once on page load. Renders stanzas if state already has content.
 * @param {object} state
 * @param {function(string): void} onGabcCompiled
 */
export function initEditor(state, onGabcCompiled) {
  _state          = state;
  _onGabcCompiled = onGabcCompiled;

  _populateLangSelect(state);
  _syncControlsToState(state);
  _wireStaticEvents(state);

  if (state.stanzas.length > 0 || state.coda) {
    if (state.rawText) _rawText().value = state.rawText;
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
}

/**
 * Recompiles and fires onGabcCompiled.
 * @param {object} [state]
 * @param {function(string): void} [onGabcCompiled]
 */
export function triggerCompile(state, onGabcCompiled) {
  const s  = state          ?? _state;
  const cb = onGabcCompiled ?? _onGabcCompiled;
  cb?.(compileGabc(s));
}

// ─── Static control wiring ────────────────────────────────────────────────────

function _populateLangSelect(state) {
  const sel = _langSel();
  sel.innerHTML = '';
  listLanguages().forEach(p => {
    const opt = document.createElement('option');
    opt.value    = p.code;
    opt.textContent = p.label;
    opt.selected = p.code === state.language;
    sel.appendChild(opt);
  });
}

function _syncControlsToState(state) {
  _langSel().value          = state.language;
  _clefSel().value          = state.clef;
  _strophicChk().checked    = state.strophicInheritance;
  _largeInitChk().checked   = state.largeInitial;
}

function _wireStaticEvents(state) {
  _langSel().addEventListener('change', () => {
    state.language = _langSel().value;
    const raw = _rawText().value.trim();
    if (raw) {
      state.rawText = raw;
      parseText(raw, state, getLanguage(state.language));
      _renderStanzas(state);
    }
    triggerCompile(state);
  });

  _clefSel().addEventListener('change', () => {
    state.clef = _clefSel().value;
    triggerCompile(state);
  });

  _strophicChk().addEventListener('change', () => {
    state.strophicInheritance = _strophicChk().checked;
    _applyStrophicPlaceholders(state);
    triggerCompile(state);
  });

  _largeInitChk().addEventListener('change', () => {
    state.largeInitial = _largeInitChk().checked;
    triggerCompile(state);
  });

  _buildBtn().addEventListener('click', () => {
    const raw = _rawText().value.trim();
    if (!raw) return;
    state.rawText = raw;
    parseText(raw, state, getLanguage(state.language));
    _renderStanzas(state);
    _showStanzas();
    triggerCompile(state);
  });

  _editToggle().addEventListener('click', () => {
    const hidden = _textArea().classList.toggle('hidden');
    _editToggle().textContent = hidden ? 'Edit text' : 'Hide';
  });
}

function _showStanzas() {
  _textArea().classList.add('hidden');
  _editToggle().classList.remove('hidden');
}

// ─── Dynamic stanza rows ──────────────────────────────────────────────────────

function _renderStanzas(state) {
  const container = _stanzasEl();
  container.innerHTML = '';

  state.stanzas.forEach((stanza, si) => {
    const stanzaEl = document.createElement('div');
    stanzaEl.className = 'mb-4';

    const label = document.createElement('div');
    label.className = 'text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1';
    label.textContent = `Stanza ${si + 1}`;
    stanzaEl.appendChild(label);

    stanza.lines.forEach((line, li) => stanzaEl.appendChild(_buildLineRow(state, si, li, line)));
    container.appendChild(stanzaEl);
  });

  if (state.coda) {
    const codaEl = document.createElement('div');
    codaEl.className = 'mb-4';
    const label = document.createElement('div');
    label.className = 'text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1';
    label.textContent = 'Coda';
    codaEl.appendChild(label);
    codaEl.appendChild(_buildLineRow(state, 'coda', 0, state.coda));
    container.appendChild(codaEl);
  }

  _applyStrophicPlaceholders(state);
}

function _buildLineRow(state, si, li, line) {
  const row = document.createElement('div');
  row.className = 'mb-2';

  const input = document.createElement('input');
  input.type        = 'text';
  input.className   = 'editor-melody-input w-full font-mono text-xs border border-gray-300 rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-blue-400';
  input.dataset.stanza = si;
  input.dataset.line   = li;
  input.value          = line.notes ?? '';
  input.placeholder    = 'Melody notes  e.g.  e f g ; h';

  const track = document.createElement('div');
  track.className      = 'editor-alignment-track';
  track.dataset.stanza = si;
  track.dataset.line   = li;

  _renderTrack(track, line.syllables ?? [], line.parsedNotes ?? []);
  _updateInputOverflow(input, line.syllables ?? [], line.parsedNotes ?? []);

  input.addEventListener('input', () => {
    const target = si === 'coda' ? state.coda : state.stanzas[si]?.lines[li];
    if (!target) return;
    target.notes       = input.value;
    target.parsedNotes = tokenizeMelody(input.value);
    _renderTrack(track, target.syllables, target.parsedNotes);
    _updateInputOverflow(input, target.syllables, target.parsedNotes);
    if (document.activeElement === input) _highlightCursorChip(input, track);
    if (si === 0) _applyStrophicPlaceholders(state);
    triggerCompile(state);
  });

  // Cursor-position chip highlight
  const _onCursorMove = () => _highlightCursorChip(input, track);
  const _onBlur       = () => _clearCursorHighlight(track);
  input.addEventListener('focus',     _onCursorMove);
  input.addEventListener('click',     _onCursorMove);
  input.addEventListener('keyup',     _onCursorMove);
  input.addEventListener('blur',      _onBlur);

  row.appendChild(input);
  row.appendChild(track);
  return row;
}

// ─── Alignment track ──────────────────────────────────────────────────────────

function _renderTrack(trackEl, syllables, parsedNotes) {
  trackEl.innerHTML = '';
  let sylIdx = 0;

  for (const token of parsedNotes) {
    if (BARLINES.has(token)) {
      trackEl.appendChild(_chip(token === '::' ? '‖' : '|', 'track-chip track-chip-barline'));
    } else {
      const syl = syllables[sylIdx++];
      const chip = syl
        ? _chip(`${syl}(${token})`, 'track-chip track-chip-matched')
        : _chip('—', 'track-chip track-chip-empty');
      chip.dataset.isMatched = syl ? '1' : '0';
      trackEl.appendChild(chip);
    }
  }

  while (sylIdx < syllables.length) {
    trackEl.appendChild(_chip(syllables[sylIdx++], 'track-chip track-chip-overflow'));
  }

  if (!parsedNotes.length && !syllables.length) {
    const hint = document.createElement('span');
    hint.className   = 'text-xs italic track-chip track-chip-empty';
    hint.textContent = 'enter notes above';
    trackEl.appendChild(hint);
  }
}

function _chip(text, cls) {
  const span = document.createElement('span');
  span.className   = cls;
  span.textContent = text;
  return span;
}

// ─── Cursor-position chip highlight ──────────────────────────────────────────

function _cursorNoteIndex(notes, cursorPos) {
  // Returns the 0-based index among note-chips (non-barlines) at the cursor position.
  // Returns -1 if the cursor is over a barline token or past all tokens.
  const tokenRe = /\S+/g;
  let noteIdx = -1;
  let match;
  while ((match = tokenRe.exec(notes)) !== null) {
    const isNote = !BARLINES.has(match[0]);
    if (isNote) noteIdx++;
    if (cursorPos >= match.index && cursorPos <= match.index + match[0].length) {
      return isNote ? noteIdx : -1;
    }
  }
  return -1;
}

function _highlightCursorChip(input, track) {
  const idx = _cursorNoteIndex(input.value, input.selectionStart);
  track.querySelectorAll('.track-chip-matched, .track-chip-empty, .track-chip-cursor').forEach((chip, i) => {
    const active = i === idx;
    chip.classList.toggle('track-chip-cursor',   active);
    chip.classList.toggle('track-chip-matched',  !active && chip.dataset.isMatched === '1');
    chip.classList.toggle('track-chip-empty',    !active && chip.dataset.isMatched === '0');
  });
}

function _clearCursorHighlight(track) {
  track.querySelectorAll('.track-chip-cursor').forEach(chip => {
    chip.classList.remove('track-chip-cursor');
    chip.classList.add(chip.dataset.isMatched === '1' ? 'track-chip-matched' : 'track-chip-empty');
  });
}

// ─── Overflow detection ───────────────────────────────────────────────────────

function _updateInputOverflow(input, syllables, parsedNotes) {
  const noteCount = parsedNotes.filter(t => !BARLINES.has(t)).length;
  input.classList.toggle('editor-melody-input-overflow', noteCount > syllables.length);
}

// ─── Strophic inheritance ─────────────────────────────────────────────────────

function _applyStrophicPlaceholders(state) {
  const inputs = document.querySelectorAll('.editor-melody-input[data-stanza]');
  inputs.forEach(input => {
    const si = input.dataset.stanza;
    if (si === 'coda' || Number(si) === 0) return;
    const li = Number(input.dataset.line);
    input.placeholder = state.strophicInheritance
      ? (state.stanzas[0]?.lines[li]?.notes || 'Melody notes  e.g.  e f g ; h')
      : 'Melody notes  e.g.  e f g ; h';
  });
}
