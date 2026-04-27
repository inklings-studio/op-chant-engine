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
  track.className      = 'flex flex-wrap gap-1 min-h-5 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5';
  track.dataset.stanza = si;
  track.dataset.line   = li;

  _renderTrack(track, line.syllables ?? [], line.parsedNotes ?? []);

  input.addEventListener('input', () => {
    const target = si === 'coda' ? state.coda : state.stanzas[si]?.lines[li];
    if (!target) return;
    target.notes       = input.value;
    target.parsedNotes = tokenizeMelody(input.value);
    _renderTrack(track, target.syllables, target.parsedNotes);
    if (si === 0) _applyStrophicPlaceholders(state);
    triggerCompile(state);
  });

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
      trackEl.appendChild(_chip(token === '::' ? '‖' : '|', 'text-gray-400 px-1'));
    } else {
      const syl = syllables[sylIdx++];
      trackEl.appendChild(syl
        ? _chip(syl, 'bg-blue-100 text-blue-800 px-1.5 rounded')
        : _chip('—', 'text-gray-300 px-1'));
    }
  }

  while (sylIdx < syllables.length) {
    trackEl.appendChild(_chip(syllables[sylIdx++], 'bg-red-100 text-red-700 px-1.5 rounded'));
  }

  if (!parsedNotes.length && !syllables.length) {
    const hint = document.createElement('span');
    hint.className   = 'text-gray-300 text-xs italic';
    hint.textContent = 'enter notes above';
    trackEl.appendChild(hint);
  }
}

function _chip(text, cls) {
  const span = document.createElement('span');
  span.className   = 'text-xs ' + cls;
  span.textContent = text;
  return span;
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
