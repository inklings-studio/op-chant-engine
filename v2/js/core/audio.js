// Wraps window.tones (UMD global from js/tones.js).
// Do NOT import this module before js/tones.js has executed.

/**
 * Resumes the AudioContext if suspended (browser autoplay policy), then calls fn().
 */
function withAudioContext(fn) {
  const ctx = window.tones?.context;
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(fn).catch(err => console.error('[audio.js] context.resume failed:', err));
  } else {
    fn();
  }
}

// ─── State ───────────────────────────────────────────────────────────────────
let _bpm = 165;
let _isPlaying = false;
let _timers = [];
let _currentNoteEl = null;
let _currentSyllableEl = null;

// ─── Public helpers ───────────────────────────────────────────────────────────
export function isAudioAvailable() {
  return typeof window.tones !== 'undefined';
}

export function getBpm() { return _bpm; }

export function setBpm(bpm) {
  _bpm = Math.max(40, Math.min(400, bpm));
}

export function isPlayingScore() { return _isPlaying; }

// ─── Note helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all pitched Note objects from the score in playback order.
 * Includes dividers (isDivider) for rests; excludes accidentals.
 */
export function getScoreNotes(score) {
  return [].concat(...score.notations.map(n => n.notes || [n]))
    .filter(n => !n.isAccidental);
}

/**
 * Returns the beat-count duration of a note (1 = one quarter-note beat).
 */
function getNoteDuration(note) {
  if (!note.pitch) {
    // divider rest
    if (note.constructor === exsurge.FullBar || note.constructor === exsurge.DoubleBar) return 2;
    return 0.75;
  }
  if (note.morae && note.morae.length > 0) return 2;
  if (note.episemata && note.episemata.length > 0) return 1.5;
  return 1;
}

function clearHighlight() {
  if (_currentNoteEl) { _currentNoteEl.classList.remove('active'); _currentNoteEl = null; }
  if (_currentSyllableEl) { _currentSyllableEl.classList.remove('active'); _currentSyllableEl = null; }
}

function highlightNote(noteEl) {
  clearHighlight();
  if (!noteEl) return;
  _currentNoteEl = noteEl;
  noteEl.classList.add('active');
  // SVG structure: grandparent <g> contains text[source-index] + inner <g> containing the use
  const neumeGroup = noteEl.parentElement?.parentElement;
  const syllable = neumeGroup?.querySelector('text[source-index]');
  if (syllable) { syllable.classList.add('active'); _currentSyllableEl = syllable; }
}

// ─── Default pitch calculation ────────────────────────────────────────────────

/**
 * Calculates a sensible default starting pitch if none is set on the score.
 * Centers the chant range around G4 (MIDI 55), matching the legacy behaviour.
 */
// Exsurge Pitch.toInt() scale differs from tones.map by 36 semitones.
// Exsurge: C4=12, tones.map: C4=48.
export const EXSURGE_TO_TONES_OFFSET = 36;

// Exsurge G4 in the new Pitch.toInt() scale = octave1*12+7 = 19
const EXSURGE_G4 = 19;

function ensureDefaultStartPitch(score, notes) {
  if (score.defaultStartPitch) return;
  const pitchedNotes = notes.filter(n => n.pitch && !n.isDivider);
  if (!pitchedNotes.length) return;
  const pitchInts = pitchedNotes.map(n => n.pitch.toInt());
  const low = Math.min(...pitchInts);
  const high = Math.max(...pitchInts);
  const startPitch = pitchedNotes[0].pitch.toInt();
  // Center the midpoint of the range at G4 (Exsurge int 19)
  score.defaultStartPitch = new exsurge.Pitch(startPitch + (EXSURGE_G4 - Math.floor((low + high) / 2)));
}

export function getTranspose(score) {
  const notes = getScoreNotes(score);
  ensureDefaultStartPitch(score, notes);
  const firstPitchedNote = notes.find(n => n.pitch && !n.isDivider);
  if (!firstPitchedNote || !score.defaultStartPitch) return 0;
  return score.defaultStartPitch.toInt() - firstPitchedNote.pitch.toInt();
}

/** Shift the score's starting pitch by delta semitones. */
export function changePitch(score, delta) {
  const notes = getScoreNotes(score);
  ensureDefaultStartPitch(score, notes);
  if (!score.defaultStartPitch) return;
  score.defaultStartPitch = new exsurge.Pitch(score.defaultStartPitch.toInt() + delta);
}

// ─── Playback ─────────────────────────────────────────────────────────────────

/**
 * Plays the score starting from startNote.
 * @param {object} score - ChantScore returned by renderGabc.
 * @param {object|null} startNote - Note object to start from; null = beginning.
 * @param {object} [callbacks] - { onEnd, onNote }
 */
export function playScore(score, startNote = null, callbacks = {}) {
  stopScore();
  if (!isAudioAvailable()) return;

  const allNotes = getScoreNotes(score);
  ensureDefaultStartPitch(score, allNotes);

  const firstPitchedNote = allNotes.find(n => n.pitch && !n.isDivider);
  if (!firstPitchedNote) return;

  const transpose = score.defaultStartPitch
    ? score.defaultStartPitch.toInt() - firstPitchedNote.pitch.toInt()
    : 0;

  const startIdx = startNote ? Math.max(0, allNotes.indexOf(startNote)) : 0;
  const slice = allNotes.slice(startIdx);

  _isPlaying = true;

  withAudioContext(() => {
    let elapsed = 0;
    slice.forEach((note, i) => {
      const beatMs = 60000 / _bpm;
      const duration = getNoteDuration(note);
      const delay = elapsed;

      _timers.push(setTimeout(() => {
        if (!_isPlaying) return;
        callbacks.onNote?.(note, i + startIdx);

        if (note.svgNode) highlightNote(note.svgNode);

        if (note.pitch && !note.isDivider) {
          const pitchInt = note.pitch.toInt() + transpose + EXSURGE_TO_TONES_OFFSET;
          const freq = window.tones.map[pitchInt];
          if (freq) window.tones.playFrequency(freq, { length: duration * beatMs * 0.88 });
        }
      }, delay));

      elapsed += duration * beatMs;
    });

    // End: clear state
    _timers.push(setTimeout(() => {
      clearHighlight();
      _isPlaying = false;
      callbacks.onEnd?.();
    }, elapsed));
  });
}

export function stopScore() {
  _timers.forEach(clearTimeout);
  _timers = [];
  _isPlaying = false;
  clearHighlight();
}
