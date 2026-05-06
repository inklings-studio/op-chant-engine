import { listLanguages, getLanguage } from '../common/language.js';
import { compileGabc, compileGabc1 } from '../common/compiler.js';
import { BARLINES, tokenizeMelody } from '../common/melody.js';
import { pointVerse } from './pointer.js';
import { loadPsalm } from './loader.js';
import { compileBreviaryHtml } from './formatter.js';
import {
  tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per,
} from '../tones/dominican.js';

const TONES = { tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per };
const TONE_LABELS = {
  tone1: 'Tone 1', tone2: 'Tone 2', tone3: 'Tone 3',
  tone4: 'Tone 4', tone4alt: 'Tone 4 (alt)', tone5: 'Tone 5',
  tone6: 'Tone 6', tone7: 'Tone 7', tone8: 'Tone 8', per: 'Peregrinus',
};

let _state = null;
let _onGabcCompiled = null;
let _onStatus = null;
let _toneKey = 'tone8';
let _cadenceKey = null;
let _isSolemn = false;
let _outputMode = 'gabc';

// ─── DOM refs (all static — exist in psalms.html) ────────────────────────────
const _langSel        = () => document.getElementById('editorLang');
const _psalmSel       = () => document.getElementById('psalmSelect');
const _psalmLabel     = () => document.getElementById('psalmSelectLabel');
const _largeInitChk   = () => document.getElementById('editorLargeInitial');
const _annotationInput= () => document.getElementById('editorAnnotation');
const _rawText        = () => document.getElementById('editorRawText');
const _buildBtn       = () => document.getElementById('editorBuildBtn');
const _rebuildBtn     = () => document.getElementById('editorRebuildBtn');
const _editToggle     = () => document.getElementById('editorEditToggle');
const _textArea       = () => document.getElementById('editorTextInputArea');
const _stanzasEl      = () => document.getElementById('editorStanzas');
const _toneSelect     = () => document.getElementById('editorTone');
const _termSelect     = () => document.getElementById('editorTerm');
const _solemnChk      = () => document.getElementById('editorSolemn');
const _gabcOptions    = () => document.getElementById('editorGabcOptions');
const _htmlLeft       = () => document.getElementById('editorHtmlLeft');
const _htmlRight      = () => document.getElementById('editorHtmlRight');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the editor: populates controls, wires events.
 * Call once on page load.
 * @param {object} state
 * @param {function(object): void} onGabcCompiled
 * @param {{ onStatus?: function(string, string=): void }} [options]
 */
export function initEditor(state, onGabcCompiled, options = {}) {
  _state = state;
  _onGabcCompiled = onGabcCompiled;
  _onStatus = options.onStatus ?? null;

  _populateLangSelect(state);
  _populatePsalmSelect(getLanguage(state.language));
  _populateToneSelect();
  _populateTermSelect();
  _syncControlsToState(state);
  _wireStaticEvents(state);
  _syncBuildButtons(state);

  if (state.stanzas.length > 0) {
    _renderStanzas(state);
    _showStanzas();
  }
}

/**
 * Recompiles and fires onGabcCompiled with a structured result object.
 * GABC mode:  { mode:'gabc', gabcFull }
 * HTML mode:  { mode:'html', gabcFull, gabc1, versesHtml }
 * @param {object} [state]
 * @param {function(object): void} [onGabcCompiled]
 */
export function triggerCompile(state, onGabcCompiled) {
  const s = state ?? _state;
  const cb = onGabcCompiled ?? _onGabcCompiled;
  cb?.(_buildResult(s));
}

function _buildResult(state) {
  const gabcFull = compileGabc(state);
  if (_outputMode !== 'html') return { mode: 'gabc', gabcFull };
  const gabc1 = compileGabc1(state);
  const wrappers = _getWrappers();
  const versesHtml = compileBreviaryHtml(state, wrappers);
  return { mode: 'html', gabcFull, gabc1, versesHtml };
}

function _getWrappers() {
  return {
    prepBegin:    document.getElementById('editorPrepBegin')?.value    ?? '<i>',
    prepEnd:      document.getElementById('editorPrepEnd')?.value      ?? '</i>',
    accBegin:     document.getElementById('editorAccBegin')?.value     ?? '<b>',
    accEnd:       document.getElementById('editorAccEnd')?.value       ?? '</b>',
    flexAccBegin: document.getElementById('editorFlexAccBegin')?.value ?? '',
    flexAccEnd:   document.getElementById('editorFlexAccEnd')?.value   ?? '',
    flexBegin:    document.getElementById('editorFlexBegin')?.value    ?? '<i>',
    flexEnd:      document.getElementById('editorFlexEnd')?.value      ?? '</i>',
  };
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
  const sel = _termSelect();
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
    opt.value = p.code;
    opt.textContent = p.label;
    opt.selected = p.code === state.language;
    sel.appendChild(opt);
  });
}

function _populatePsalmSelect(lang) {
  const hasPsalms = Array.isArray(lang?.psalms) && lang.psalms.length > 0;
  _psalmLabel().classList.toggle('hidden', !hasPsalms);
  _psalmSel().classList.toggle('hidden', !hasPsalms);
  if (!hasPsalms) return;

  const sel = _psalmSel();
  sel.innerHTML = '<option value="">— select —</option>';
  lang.psalms.forEach(p => {
    const opt = document.createElement('option');
    opt.value = String(p.num);
    opt.textContent = p.label;
    sel.appendChild(opt);
  });
}

function _syncControlsToState(state) {
  _langSel().value            = state.language;
  _largeInitChk().checked     = state.largeInitial;
  _annotationInput().value    = state.annotation ?? '';
  _toneSelect().value         = _toneKey;
  _solemnChk().checked        = _isSolemn;
}

function _wireStaticEvents(state) {
  _langSel().addEventListener('change', () => {
    state.language = _langSel().value;
    _populatePsalmSelect(getLanguage(state.language));
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
    _doBuild(raw, state);
  });

  _psalmSel().addEventListener('change', async () => {
    const val = _psalmSel().value;
    if (!val) return;
    const lang = getLanguage(state.language);
    const entry = lang?.psalms?.find(p => String(p.num) === val);
    if (!entry) return;

    _annotationInput().value = entry.label;
    state.annotation = entry.label;

    _onStatus?.('Loading psalm…');
    try {
      const text = await loadPsalm(state.language, entry.num);
      _rawText().value = text;
      _doBuild(text, state);
      _onStatus?.('');
    } catch (err) {
      _onStatus?.('Failed to load psalm: ' + err.message, 'error');
    }
  });

  _rebuildBtn().addEventListener('click', () => {
    const raw = _rawText().value.trim();
    if (!raw) return;
    _parseAndPoint(raw, state);
    _renderStanzas(state);
    triggerCompile(state);
  });

  document.getElementById('editorOutputMode')?.addEventListener('change', e => {
    _outputMode = e.target.value;
    const isHtml = _outputMode === 'html';
    _gabcOptions().style.display  = isHtml ? 'none'  : 'grid';
    _htmlLeft().style.display     = isHtml ? 'grid'  : 'none';
    _htmlRight().style.display    = isHtml ? 'grid'  : 'none';
    // Large Initial: always on in HTML mode (drop cap on verse 1), user-controlled in GABC
    state.largeInitial = isHtml ? true : _largeInitChk().checked;
    triggerCompile(state);
  });

  ['editorPrepBegin', 'editorPrepEnd', 'editorAccBegin', 'editorAccEnd',
   'editorFlexAccBegin', 'editorFlexAccEnd', 'editorFlexBegin', 'editorFlexEnd'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => triggerCompile(state));
  });

  _editToggle().addEventListener('click', () => {
    const hidden = _textArea().classList.toggle('hidden');
    _editToggle().textContent = hidden ? 'Edit text' : 'Hide';
    _stanzasEl().classList.toggle('hidden', !hidden);
    if (!hidden) _syncRawTextarea(state);
  });
}

function _showStanzas() {
  _textArea().classList.add('hidden');
  _stanzasEl().classList.remove('hidden');
  _editToggle().classList.remove('hidden');
  _editToggle().textContent = 'Edit text';
}

// Swap between Build (empty state) and Re-Build (has content).
function _syncBuildButtons(state) {
  const hasContent = state.stanzas.length > 0;
  _buildBtn().classList.toggle('hidden', hasContent);
  _rebuildBtn().classList.toggle('hidden', !hasContent);
}

// ─── Build helper ─────────────────────────────────────────────────────────────

function _doBuild(rawText, state) {
  _parseAndPoint(rawText, state);
  _renderStanzas(state);
  _showStanzas();
  _syncBuildButtons(state);
  triggerCompile(state);
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
 * Reconstruct the verse text from the AST with | injected between syllables
 * of the same word, and section breaks (†, *) on separate lines.
 */
function _buildMarkedLine(ast, wordMap) {
  let lines = [''];
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
    if (prevWordIdx !== -1) {
      lines[lines.length - 1] += wIdx === prevWordIdx ? '|' : ' ';
    }
    lines[lines.length - 1] += token.syl;

    prevWordIdx = wIdx;
    sylIdx++;
  }

  return lines.map(l => l.trim()).filter(Boolean).join('\n');
}

/**
 * Splits a verse AST into phrase-line objects at flex/mediant boundaries.
 * Each phrase becomes one line: { syllables, wordMap, notes, parsedNotes }.
 * @param {Array} ast
 * @param {number[]} wordMap — global syllable→word-index map for the whole verse
 * @returns {Array<{syllables, wordMap, notes, parsedNotes}>}
 */
function _splitAstToLines(ast, wordMap) {
  const phrases = [];
  let current = [];

  for (const token of ast) {
    current.push(token);
    if (token.role === 'flex' || token.role === 'mediant') {
      phrases.push([...current]);
      current = [];
    }
  }
  if (current.length) phrases.push(current);

  let sylOffset = 0;
  return phrases.map(phrase => {
    const sylTokens = phrase.filter(t => t.role !== 'flex' && t.role !== 'mediant');
    const syllables = sylTokens.map(t => t.syl);
    const phraseWordMap = wordMap ? wordMap.slice(sylOffset, sylOffset + syllables.length) : null;
    sylOffset += syllables.length;

    const notes = phrase.map(t => t.note).filter(Boolean).join(' ');
    const parsedNotes = tokenizeMelody(notes);
    return { syllables, wordMap: phraseWordMap, notes, parsedNotes };
  });
}

/**
 * Builds a full stanza object from a raw verse line.
 * Returns { rawLine, lines } where lines is a 2-3 element phrase-line array.
 */
function _buildStanza(rawLine, tone, plugin, isFirstVerse) {
  try {
    const ast = pointVerse(rawLine, tone, _cadenceKey, _isSolemn, plugin.syllabifyPhrase, isFirstVerse);
    const cleanLine = rawLine.replace(/[†*]/g, ' ').replace(/\s+/g, ' ').trim();
    const langTokens = plugin.syllabifyPhrase(cleanLine);
    const wordMap = langTokens.map(t => t.wordIdx);
    const markedLine = _buildMarkedLine(ast, wordMap);
    const lines = _splitAstToLines(ast, wordMap);
    // ast and wordMap stored at stanza level for HTML formatter
    return { rawLine: markedLine, ast, wordMap, lines };
  } catch (_e) {
    const cleanLine = rawLine.replace(/[†*]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = plugin.syllabifyPhrase(cleanLine);
    return {
      rawLine,
      ast:     null,
      wordMap: tokens.map(t => t.wordIdx),
      lines: [{
        syllables: tokens.map(t => t.syl),
        wordMap:   tokens.map(t => t.wordIdx),
        notes:       '',
        parsedNotes: [],
      }],
    };
  }
}

/**
 * Parses verse lines from rawText, points each one via the psalm tone,
 * and writes state.stanzas. Each stanza has { rawLine, lines: [phraseLines…] }.
 * Preserves manually-edited lines when a verse rawLine is unchanged.
 */
function _parseAndPoint(rawText, state) {
  const tone = TONES[_toneKey];
  const plugin = getLanguage(state.language);
  const verses = _groupVerses(rawText.split('\n').map(l => l.trim()).filter(Boolean));

  state.stanzas = verses.map((rawLine, vi) => {
    const existing = state.stanzas[vi];
    if (existing?.rawLine === rawLine && existing?.lines[0]?.notes) {
      return existing;
    }
    return _buildStanza(rawLine, tone, plugin, vi === 0);
  });
  state.clef = tone.clef;
  state.coda = null;
  _syncRawTextarea(state);
}

/**
 * Re-points all existing stanza lines with the current tone/cadence/solemn.
 * Called when tone, termination, or solemn changes.
 */
function _repointAll(state) {
  const tone = TONES[_toneKey];
  const plugin = getLanguage(state.language);

  state.stanzas.forEach((stanza, si) => {
    if (!stanza.rawLine) return;
    const newStanza = _buildStanza(stanza.rawLine, tone, plugin, si === 0);
    stanza.lines   = newStanza.lines;
    stanza.rawLine = newStanza.rawLine;
    stanza.ast     = newStanza.ast;
    stanza.wordMap = newStanza.wordMap;
  });

  state.clef = tone.clef;
  _syncRawTextarea(state);
}

/**
 * Writes the marked verse texts back into the raw textarea.
 */
function _syncRawTextarea(state) {
  _rawText().value = state.stanzas
    .map(s => s.rawLine ?? '')
    .filter(Boolean)
    .join('\n');
}

// ─── Dynamic verse rows ───────────────────────────────────────────────────────

function _renderStanzas(state) {
  const container = _stanzasEl();
  container.innerHTML = '';

  state.stanzas.forEach((stanza, si) => {
    const stanzaEl = document.createElement('div');
    stanzaEl.className = 'mb-4';

    const label = document.createElement('div');
    label.className = 'text-xs font-semibold uppercase tracking-wide text-op-ink-faint mb-1';
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
  input.type        = 'text';
  input.className   = 'editor-melody-input w-full font-mono text-xs border border-op-tan rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-op-gold';
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
      const chip = syl
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
