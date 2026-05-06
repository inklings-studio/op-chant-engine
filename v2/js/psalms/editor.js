import { listLanguages, getLanguage } from '../common/language.js';
import { compileGabc } from '../common/compiler.js';
import { BARLINES, tokenizeMelody } from '../common/melody.js';
import { pointVerse } from './pointer.js';
import {
  tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per,
} from '../tones/dominican.js';

const TONES = { tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per };
const TONE_LABELS = {
  tone1: 'Tone 1', tone2: 'Tone 2', tone3: 'Tone 3',
  tone4: 'Tone 4', tone4alt: 'Tone 4 (alt)', tone5: 'Tone 5',
  tone6: 'Tone 6', tone7: 'Tone 7', tone8: 'Tone 8', per: 'Peregrinus',
};

let _state          = null;
let _onGabcCompiled = null;
let _toneKey        = 'tone8';
let _cadenceKey     = null;
let _isSolemn       = false;

// ─── DOM refs (all static — exist in psalms.html) ────────────────────────────
const _langSel         = () => document.getElementById('editorLang');
const _largeInitChk    = () => document.getElementById('editorLargeInitial');
const _annotationInput = () => document.getElementById('editorAnnotation');
const _rawText         = () => document.getElementById('editorRawText');
const _buildBtn        = () => document.getElementById('editorBuildBtn');
const _rebuildBtn      = () => document.getElementById('editorRebuildBtn');
const _fitTextBtn      = () => document.getElementById('editorFitTextBtn');
const _editToggle      = () => document.getElementById('editorEditToggle');
const _textArea        = () => document.getElementById('editorTextInputArea');
const _stanzasEl       = () => document.getElementById('editorStanzas');
const _toneSelect      = () => document.getElementById('editorTone');
const _termSelect      = () => document.getElementById('editorTerm');
const _solemnChk       = () => document.getElementById('editorSolemn');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the editor: populates controls, wires events.
 * Call once on page load.
 * @param {object} state
 * @param {function(string): void} onGabcCompiled
 */
export function initEditor(state, onGabcCompiled) {
  _state          = state;
  _onGabcCompiled = onGabcCompiled;

  _populateLangSelect(state);
  _populateToneSelect();
  _populateTermSelect();
  _syncControlsToState(state);
  _wireStaticEvents(state);
  _syncBuildButtons(state);

  if (state.stanzas.length > 0) {
    _renderStanzas(state);
    _editToggle().classList.remove('hidden');
    _editToggle().textContent = 'Edit melody';
    // Textarea stays visible by default — do NOT call _showMelody()
  }
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

// ─── Tone helpers ─────────────────────────────────────────────────────────────

function _populateToneSelect() {
  const sel = _toneSelect();
  sel.innerHTML = Object.entries(TONE_LABELS)
    .map(([k, label]) => `<option value="${k}">${label}</option>`)
    .join('');
  sel.value = _toneKey;
}

function _populateTermSelect() {
  const tone = TONES[_toneKey];
  const sel  = _termSelect();
  const keys = tone.terminations ? Object.keys(tone.terminations) : ['—'];
  sel.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
  _cadenceKey = sel.value;
}

// ─── Static control wiring ────────────────────────────────────────────────────

function _populateLangSelect(state) {
  const sel = _langSel();
  sel.innerHTML = '';
  listLanguages().forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.code;
    opt.textContent = p.label;
    opt.selected    = p.code === state.language;
    sel.appendChild(opt);
  });
}

function _syncControlsToState(state) {
  _langSel().value         = state.language;
  _largeInitChk().checked  = state.largeInitial;
  _annotationInput().value = state.annotation ?? '';
  _toneSelect().value      = _toneKey;
  _solemnChk().checked     = _isSolemn;
}

function _wireStaticEvents(state) {
  _langSel().addEventListener('change', () => {
    state.language = _langSel().value;
    if (state.stanzas.length) {
      _repointAll(state);
      _renderStanzas(state);
    }
    triggerCompile(state);
  });

  _largeInitChk().addEventListener('change', () => {
    state.largeInitial = _largeInitChk().checked;
    triggerCompile(state);
  });

  _annotationInput().addEventListener('input', () => {
    state.annotation = _annotationInput().value;
    triggerCompile(state);
  });

  _toneSelect().addEventListener('change', () => {
    _toneKey = _toneSelect().value;
    _populateTermSelect();
    if (state.stanzas.length) {
      _repointAll(state);
      _renderStanzas(state);
    }
    triggerCompile(state);
  });

  _termSelect().addEventListener('change', () => {
    _cadenceKey = _termSelect().value;
    if (state.stanzas.length) {
      _repointAll(state);
      _renderStanzas(state);
    }
    triggerCompile(state);
  });

  _solemnChk().addEventListener('change', () => {
    _isSolemn = _solemnChk().checked;
    if (state.stanzas.length) {
      _repointAll(state);
      _renderStanzas(state);
    }
    triggerCompile(state);
  });

  _buildBtn().addEventListener('click', () => {
    const raw = _rawText().value.trim();
    if (!raw) return;
    _parseAndPoint(raw, state);
    _renderStanzas(state);
    _syncBuildButtons(state);
    _editToggle().classList.remove('hidden');
    _editToggle().textContent = 'Edit melody';
    triggerCompile(state);
  });

  _rebuildBtn().addEventListener('click', () => {
    const raw = _rawText().value.trim();
    if (!raw) return;
    state.stanzas = [];
    _parseAndPoint(raw, state);
    _renderStanzas(state);
    triggerCompile(state);
  });

  _fitTextBtn().addEventListener('click', () => {
    const raw = _rawText().value.trim();
    if (!raw) return;
    _resyllabify(raw, state);
    _renderStanzas(state);
    triggerCompile(state);
  });

  _editToggle().addEventListener('click', () => {
    const textareaHidden = _textArea().classList.toggle('hidden');
    _stanzasEl().classList.toggle('hidden', !textareaHidden);
    _editToggle().textContent = textareaHidden ? 'Edit text' : 'Edit melody';
  });
}

// Swap between Build (empty state) and Re-Point + Fit Text (has content).
function _syncBuildButtons(state) {
  const hasContent = state.stanzas.length > 0;
  _buildBtn().classList.toggle('hidden', hasContent);
  _rebuildBtn().classList.toggle('hidden', !hasContent);
  _fitTextBtn().classList.toggle('hidden', !hasContent);
}

// ─── Verse parsing & pointing ─────────────────────────────────────────────────

/**
 * Groups raw input lines into verse strings.
 * A group closes when the accumulated text contains '*' and the last line ends
 * with terminal punctuation ([.?!]), or when 3 lines have been collected.
 */
function _groupVerses(lines) {
  const verses = [];
  let current = [];

  for (const line of lines) {
    current.push(line);
    const joined = current.join('\n');
    const isComplete = joined.includes('*') && /[.?!]\s*$/.test(line);
    if (isComplete || current.length >= 3) {
      verses.push(joined);
      current = [];
    }
  }

  if (current.length) verses.push(current.join('\n'));
  return verses;
}

/**
 * Reconstruct the verse text from the AST with accent markers (') and section
 * breaks (†, *) re-inserted. Used to update the raw textarea after pointing.
 * Each section is placed on its own line for multi-line display.
 */
function _buildMarkedLine(ast, wordMap) {
  let lines  = [''];
  let sylIdx = 0;
  let prevWordIdx = -1;

  for (const token of ast) {
    if (token.role === 'flex') {
      lines[lines.length - 1] += '†';
      lines.push('');
      prevWordIdx = -1;
      continue;
    }
    if (token.role === 'mediant') {
      lines[lines.length - 1] += '*';
      lines.push('');
      prevWordIdx = -1;
      continue;
    }

    const wIdx = wordMap[sylIdx] ?? sylIdx;
    if (prevWordIdx !== -1 && wIdx !== prevWordIdx) {
      lines[lines.length - 1] += ' ';
    }
    // Strip any leading ' that the syllabifier attached as leadPunct from a
    // previous round-trip (e.g. "'pas" from re-reading "'pastier").
    // We re-derive and prepend our own ' for acc tokens, so the old one must go.
    const syl = token.syl.replace(/^'+/, '');
    // ' placed BEFORE the acc syllable: for first syllables it becomes leadPunct
    // on the next read (stripped, natural stress applies — stable); for non-first
    // syllables it sits between letters and correctly overrides stress.
    if (token.role === 'acc') lines[lines.length - 1] += "'";
    lines[lines.length - 1] += syl;

    prevWordIdx = wIdx;
    sylIdx++;
  }

  return lines.map(l => l.trim()).filter(Boolean).join('\n');
}

/**
 * Parses verse lines from rawText, points each one via the psalm tone,
 * and writes state.stanzas (one stanza per verse, one line per stanza).
 * Preserves manually-edited notes when a verse line is unchanged (rawLine matches).
 */
function _parseAndPoint(rawText, state) {
  const tone    = TONES[_toneKey];
  const plugin  = getLanguage(state.language);
  const verses  = _groupVerses(rawText.split('\n').map(l => l.trim()).filter(Boolean));

  state.stanzas = verses.map((rawLine, vi) => {
    const existing = state.stanzas[vi]?.lines[0];
    // Preserve manually-edited notes if the verse text hasn't changed.
    if (existing?.rawLine === rawLine && existing?.notes) {
      return { lines: [existing] };
    }
    return { lines: [_pointLine(rawLine, tone, plugin, vi === 0)] };
  });

  state.clef = tone.clef;
  state.coda  = null;
  _syncRawTextarea(state);
}

/**
 * Re-points all existing stanza lines with the current tone/cadence/solemn.
 * Called when tone, termination, or solemn changes.
 */
function _repointAll(state) {
  const tone   = TONES[_toneKey];
  const plugin = getLanguage(state.language);

  state.stanzas.forEach((stanza, si) => {
    const line = stanza.lines[0];
    if (!line?.rawLine) return;
    const repointed = _pointLine(line.rawLine, tone, plugin, si === 0);
    line.notes       = repointed.notes;
    line.parsedNotes = repointed.parsedNotes;
    line.syllables   = repointed.syllables;
    line.wordMap     = repointed.wordMap;
    line.rawLine     = repointed.rawLine;
  });

  state.clef = tone.clef;
  _syncRawTextarea(state);
}

/**
 * Re-syllabifies verse lines but keeps existing note strings.
 * Called by Fit Text — useful when verse text changes slightly (typo fix).
 */
function _resyllabify(rawText, state) {
  const plugin = getLanguage(state.language);
  const verses = _groupVerses(rawText.split('\n').map(l => l.trim()).filter(Boolean));

  state.stanzas = verses.map((rawLine, vi) => {
    const existing  = state.stanzas[vi]?.lines[0];
    const cleanLine = rawLine.replace(/[†*']/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens    = plugin.syllabifyPhrase(cleanLine);
    const syllables = tokens.map(t => t.syl);
    const wordMap   = tokens.map(t => t.wordIdx);
    const notes       = existing?.notes       ?? '';
    const parsedNotes = existing?.parsedNotes ?? [];
    return { lines: [{ syllables, wordMap, notes, parsedNotes, rawLine }] };
  });
}

/**
 * Writes the marked verse texts (with ' and †* section markers) back into
 * the raw textarea so the user can see and adjust accent positions.
 */
function _syncRawTextarea(state) {
  _rawText().value = state.stanzas
    .map(s => s.lines[0]?.rawLine ?? '')
    .filter(Boolean)
    .join('\n');
}

/**
 * Points a single verse line; returns the full line state object.
 */
function _pointLine(rawLine, tone, plugin, isFirstVerse = true) {
  try {
    const ast         = pointVerse(rawLine, tone, _cadenceKey, _isSolemn, plugin.syllabifyPhrase, isFirstVerse);
    const notes       = ast.map(t => t.note).join(' ');
    const parsedNotes = tokenizeMelody(notes);
    // Barline sentinels (flex/mediant) have empty syl — exclude from syllables/wordMap arrays
    // so that buildLine's sylIdx stays in sync with the non-barline note tokens.
    const syllables   = ast.filter(t => t.role !== 'flex' && t.role !== 'mediant').map(t => t.syl);
    const cleanLine   = rawLine.replace(/[†*']/g, ' ').replace(/\s+/g, ' ').trim();
    const langTokens  = plugin.syllabifyPhrase(cleanLine);
    const wordMap     = langTokens.map(t => t.wordIdx);
    const markedLine  = _buildMarkedLine(ast, wordMap);
    return { syllables, wordMap, notes, parsedNotes, rawLine: markedLine };
  } catch (_e) {
    // Verse missing * marker or other pointing error — store syllables only.
    const cleanLine = rawLine.replace(/[†*']/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens    = plugin.syllabifyPhrase(cleanLine);
    return {
      syllables:   tokens.map(t => t.syl),
      wordMap:     tokens.map(t => t.wordIdx),
      notes:       '',
      parsedNotes: [],
      rawLine,
    };
  }
}

// ─── Dynamic verse rows ───────────────────────────────────────────────────────

function _renderStanzas(state) {
  const container = _stanzasEl();
  container.innerHTML = '';

  state.stanzas.forEach((stanza, si) => {
    const stanzaEl = document.createElement('div');
    stanzaEl.className = 'mb-4';

    const label = document.createElement('div');
    label.className   = 'text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1';
    label.textContent = `Verse ${si + 1}`;
    stanzaEl.appendChild(label);

    stanza.lines.forEach((line, li) => stanzaEl.appendChild(_buildLineRow(state, si, li, line)));
    container.appendChild(stanzaEl);
  });
}

function _buildLineRow(state, si, li, line) {
  const row = document.createElement('div');
  row.className = 'mb-2';

  const input = document.createElement('input');
  input.type          = 'text';
  input.className     = 'editor-melody-input w-full font-mono text-xs border border-gray-300 rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-blue-400';
  input.dataset.stanza = si;
  input.dataset.line   = li;
  input.value          = line.notes ?? '';
  input.placeholder    = 'Melody notes  e.g.  g g g k j.';

  const track = document.createElement('div');
  track.className      = 'editor-alignment-track';
  track.dataset.stanza = si;
  track.dataset.line   = li;

  _renderTrack(track, line.syllables ?? [], line.parsedNotes ?? [], line.wordMap ?? null);
  _updateInputOverflow(input, line.syllables ?? [], line.parsedNotes ?? []);

  input.addEventListener('input', () => {
    const target = state.stanzas[si]?.lines[li];
    if (!target) return;
    target.notes       = input.value;
    target.parsedNotes = tokenizeMelody(input.value);
    _renderTrack(track, target.syllables, target.parsedNotes, target.wordMap ?? null);
    _updateInputOverflow(input, target.syllables, target.parsedNotes);
    if (document.activeElement === input) _highlightCursorChip(input, track);
    triggerCompile(state);
  });

  // Cursor-position chip highlight
  const _onCursorMove = () => _highlightCursorChip(input, track);
  const _onBlur       = () => _clearCursorHighlight(track);
  input.addEventListener('focus',  _onCursorMove);
  input.addEventListener('click',  _onCursorMove);
  input.addEventListener('keyup',  _onCursorMove);
  input.addEventListener('blur',   _onBlur);

  row.appendChild(input);
  row.appendChild(track);
  return row;
}

// ─── Alignment track ──────────────────────────────────────────────────────────

function _renderTrack(trackEl, syllables, parsedNotes, wordMap) {
  trackEl.innerHTML = '';
  let sylIdx = 0;

  let curWordIdx = null;
  let curGroupEl = null;

  function _flushGroup() {
    if (curGroupEl) { trackEl.appendChild(curGroupEl); curGroupEl = null; curWordIdx = null; }
  }

  function _groupFor(wIdx) {
    if (wIdx !== curWordIdx) {
      _flushGroup();
      curGroupEl = document.createElement('span');
      curGroupEl.className = 'track-word-group';
      curWordIdx = wIdx;
    }
    return curGroupEl;
  }

  for (const token of parsedNotes) {
    if (BARLINES.has(token)) {
      _flushGroup();
      trackEl.appendChild(_chip(token === '::' ? '‖' : '|', 'track-chip track-chip-barline'));
    } else {
      const syl  = syllables[sylIdx];
      const wIdx = wordMap?.[sylIdx] ?? sylIdx;
      sylIdx++;
      const group = _groupFor(wIdx);
      const chip  = syl
        ? _chip(`${syl}(${token})`, 'track-chip track-chip-matched')
        : _chip('—', 'track-chip track-chip-empty');
      chip.dataset.isMatched = syl ? '1' : '0';
      group.appendChild(chip);
    }
  }

  _flushGroup();

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
    chip.classList.toggle('track-chip-cursor',  active);
    chip.classList.toggle('track-chip-matched', !active && chip.dataset.isMatched === '1');
    chip.classList.toggle('track-chip-empty',   !active && chip.dataset.isMatched === '0');
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
