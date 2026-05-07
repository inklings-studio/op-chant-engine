import { BARLINES, tokenizeMelody } from './melody.js';

function chip(text, cls) {
  const span = document.createElement('span');
  span.className   = cls;
  span.textContent = text;
  return span;
}

export function renderTrack(trackEl, syllables, parsedNotes, wordMap) {
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
      trackEl.appendChild(chip(token === '::' ? '‖' : '|', 'track-chip track-chip-barline'));
    } else {
      const syl  = syllables[sylIdx];
      const wIdx = wordMap?.[sylIdx] ?? sylIdx;
      sylIdx++;
      const group = _groupFor(wIdx);
      const c = syl
        ? chip(`${syl}(${token})`, 'track-chip track-chip-matched')
        : chip('—', 'track-chip track-chip-empty');
      c.dataset.isMatched = syl ? '1' : '0';
      group.appendChild(c);
    }
  }

  _flushGroup();

  while (sylIdx < syllables.length) {
    trackEl.appendChild(chip(syllables[sylIdx++], 'track-chip track-chip-overflow'));
  }

  if (!parsedNotes.length && !syllables.length) {
    const hint = document.createElement('span');
    hint.className   = 'text-xs italic track-chip track-chip-empty';
    hint.textContent = 'enter notes above';
    trackEl.appendChild(hint);
  }
}

function cursorNoteIndex(notes, cursorPos) {
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

export function highlightCursorChip(input, track) {
  const idx = cursorNoteIndex(input.value, input.selectionStart);
  track.querySelectorAll('.track-chip-matched, .track-chip-empty, .track-chip-cursor').forEach((chip, i) => {
    const active = i === idx;
    chip.classList.toggle('track-chip-cursor',  active);
    chip.classList.toggle('track-chip-matched', !active && chip.dataset.isMatched === '1');
    chip.classList.toggle('track-chip-empty',   !active && chip.dataset.isMatched === '0');
  });
}

export function clearCursorHighlight(track) {
  track.querySelectorAll('.track-chip-cursor').forEach(chip => {
    chip.classList.remove('track-chip-cursor');
    chip.classList.add(chip.dataset.isMatched === '1' ? 'track-chip-matched' : 'track-chip-empty');
  });
}

export function updateInputOverflow(input, syllables, parsedNotes) {
  const noteCount = parsedNotes.filter(t => !BARLINES.has(t)).length;
  input.classList.toggle('editor-melody-input-overflow', noteCount > syllables.length);
}

/**
 * Creates a full melody line row (input + track) and wires up events.
 * @param {object} line - The line object from state { notes, syllables, parsedNotes, wordMap }
 * @param {number|string} si - Stanza index (or 'coda')
 * @param {number} li - Line index
 * @param {function} onUpdate - Callback fired on input. It receives {si, li, notes, parsedNotes}
 *                              and should update state and trigger a compile. It should return the
 *                              updated line object from state.
 * @returns {HTMLElement} The row element.
 */
export function createMelodyInputRow(line, si, li, { onUpdate }) {
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

  renderTrack(track, line.syllables ?? [], line.parsedNotes ?? [], line.wordMap ?? null);
  updateInputOverflow(input, line.syllables ?? [], line.parsedNotes ?? []);

  input.addEventListener('input', () => {
    const notes = input.value;
    const parsedNotes = tokenizeMelody(notes);

    const updatedLine = onUpdate({ si, li, notes, parsedNotes });
    if (!updatedLine) return;

    renderTrack(track, updatedLine.syllables, updatedLine.parsedNotes, updatedLine.wordMap ?? null);
    updateInputOverflow(input, updatedLine.syllables, updatedLine.parsedNotes);
    if (document.activeElement === input) highlightCursorChip(input, track);
  });

  const onCursorMove = () => highlightCursorChip(input, track);
  const onBlur = () => clearCursorHighlight(track);
  input.addEventListener('focus', onCursorMove);
  input.addEventListener('click', onCursorMove);
  input.addEventListener('keyup', onCursorMove);
  input.addEventListener('blur', onBlur);

  row.appendChild(input);
  row.appendChild(track);
  return row;
}
