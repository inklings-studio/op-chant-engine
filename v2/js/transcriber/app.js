// Entry point for the v2 Transcriber tool.
// Runs as an ES6 module. window.exsurge, window.tones, and saveSvgAsPng/saveSvg
// must already be available via classic <script> tags loaded before this module.

import { createContext, renderGabc, exportSvg } from '../core/renderer.js';
import {
  isAudioAvailable, playScore, stopScore, isPlayingScore,
  getScoreNotes, getTranspose, changePitch, getBpm, setBpm,
} from '../core/audio.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const PDF_SERVICE_URL      = 'https://www.sourceandsummit.com/editor/legacy/process.php';
const DEFAULT_EXPORT_WIDTH = 7.5 * 96;
const DEFAULT_DPI          = 300;
const LOCALSTORAGE_KEY     = 'v2_gabc_editor';
const RENDER_DEBOUNCE_MS   = 300;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const gabcEditor    = document.getElementById('gabcEditor');
const chantPreview  = document.getElementById('chantPreview');
const placeholder   = document.getElementById('previewPlaceholder');
const statusMsg     = document.getElementById('statusMessage');
const btnPdf        = document.getElementById('btnExportPdf');
const btnPng        = document.getElementById('btnDownloadPng');
const btnSvg        = document.getElementById('btnDownloadSvg');
const pdfForm       = document.getElementById('pdfForm');
const pdfGabcInput  = document.getElementById('pdfGabc');

// Media controls
const mediaControls  = document.getElementById('mediaControls');
const btnPauseResume = document.getElementById('btnPauseResume');
const btnBpmMinus    = document.getElementById('btnBpmMinus');
const btnBpmPlus     = document.getElementById('btnBpmPlus');
const bpmDisplay     = document.getElementById('bpmDisplay');
const btnMediaStop   = document.getElementById('btnMediaStop');

// ─── Module state ─────────────────────────────────────────────────────────────
let ctxt  = null;
let score = null;
let _toolbar = null;   // currently visible floating toolbar div

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  try {
    ctxt = createContext();
  } catch (err) {
    setStatus(err.message, 'error');
    console.error(err);
    return;
  }

  const saved = localStorage.getItem(LOCALSTORAGE_KEY);
  if (saved) {
    gabcEditor.value = saved;
    renderFromEditor();
  }

  gabcEditor.addEventListener('input', onEditorInput);
  gabcEditor.addEventListener('keydown', onEditorKeydown);
  btnPdf.addEventListener('click', onExportPdf);
  btnPng.addEventListener('click', onExportPng);
  btnSvg.addEventListener('click', onExportSvg);

  // Click on note or syllable text in the preview
  chantPreview.addEventListener('click', onPreviewClick);

  // Dismiss toolbar when clicking outside preview + toolbar
  document.addEventListener('click', onDocumentClick, true);

  // Media controls
  btnPauseResume?.addEventListener('click', onPauseResume);
  btnBpmMinus?.addEventListener('click', () => updateBpm(-10));
  btnBpmPlus?.addEventListener('click', () => updateBpm(+10));
  btnMediaStop?.addEventListener('click', onMediaStop);

  setStatus(isAudioAvailable() ? 'Ready.' : 'Ready (audio unavailable).');
}

// ─── Rendering ────────────────────────────────────────────────────────────────
let renderTimer = null;

function onEditorInput() {
  localStorage.setItem(LOCALSTORAGE_KEY, gabcEditor.value);
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderFromEditor, RENDER_DEBOUNCE_MS);
}

function renderFromEditor() {
  const gabc = gabcEditor.value.trim();
  if (!gabc) {
    chantPreview.innerHTML = '';
    if (placeholder) placeholder.style.display = '';
    score = null;
    setStatus('');
    return;
  }
  if (placeholder) placeholder.style.display = 'none';
  setStatus('Rendering…');
  try {
    score = renderGabc(ctxt, gabc, chantPreview);
    setStatus('');
  } catch (err) {
    setStatus('Render error: ' + err.message, 'error');
    console.error('[app.js] renderGabc failed:', err);
  }
}

// ─── Keyboard: Tab inserts two spaces ─────────────────────────────────────────
function onEditorKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = gabcEditor.selectionStart;
    const end   = gabcEditor.selectionEnd;
    gabcEditor.value =
      gabcEditor.value.slice(0, start) + '  ' + gabcEditor.value.slice(end);
    gabcEditor.selectionStart = gabcEditor.selectionEnd = start + 2;
  }
}

// ─── Floating toolbar ─────────────────────────────────────────────────────────

function removeToolbar() {
  if (_toolbar) { _toolbar.remove(); _toolbar = null; }
  // remove active highlight from all elements (unless playing)
  if (!isPlayingScore()) {
    chantPreview.querySelectorAll('use.active, text.active').forEach(el => {
      el.classList.remove('active');
    });
  }
}

/**
 * Given a clicked SVG element (use or text), returns the corresponding note
 * object and the neume group element for positioning.
 */
function resolveClickedNote(el) {
  let noteEl = null;   // the use[source-index] element
  let note   = null;   // the Note object (has .pitch, .svgNode)
  let group  = null;   // the parent <g> of the neume (for toolbar positioning)

  if (el.tagName.toLowerCase() === 'use' && el.source?.neume) {
    noteEl = el;
    note   = el.source;
    group  = el.parentElement;
  } else if (el.tagName.toLowerCase() === 'text') {
    // Find the first pitched use element in the same neume group
    group  = el.parentElement;
    noteEl = group?.querySelector('use[source-index]') ?? null;
    if (noteEl && noteEl.source?.neume) note = noteEl.source;
  }

  return { noteEl, note, group };
}

function showToolbarForNote(el, anchorOverride) {
  removeToolbar();
  if (!score || !isAudioAvailable()) return;

  const { noteEl, note, group } = resolveClickedNote(el);
  if (!note || !note.pitch) return;

  // Highlight the clicked element (and the drop cap if that triggered this)
  el.classList.add('active');
  if (anchorOverride) anchorOverride.classList.add('active');

  // Build toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'chant-toolbar';
  toolbar.setAttribute('data-toolbar', '');

  // ─ Play button ────────────────────────────────────────────────────────────
  const btnPlay = document.createElement('button');
  btnPlay.className = 'toolbar-btn toolbar-btn-primary';
  btnPlay.innerHTML = '&#9654; ' + (noteEl === getScoreNotes(score).find(n => n.svgNode === noteEl)
    ? 'Play Chant' : 'Play from here');
  // Re-check on first paint to set the label correctly
  btnPlay.textContent = '▶ Play from here';
  btnPlay.addEventListener('click', e => {
    e.stopPropagation();
    const startNote = noteEl?.source ?? null;
    startPlayback(startNote);
    removeToolbar();
  });
  toolbar.appendChild(btnPlay);

  // ─ Pitch row (↑ [Pitch info] ↓) ──────────────────────────────────────────
  const pitchRow = document.createElement('div');
  pitchRow.className = 'toolbar-row';

  const btnUp = document.createElement('button');
  btnUp.className = 'toolbar-btn toolbar-btn-success';
  btnUp.textContent = '▲';
  btnUp.addEventListener('click', e => { e.stopPropagation(); changePitch(score, 1); updatePitchDisplay(pitchCenter, note); });

  const pitchCenter = document.createElement('button');
  pitchCenter.className = 'toolbar-btn toolbar-btn-info toolbar-pitch-info';
  pitchCenter.addEventListener('click', e => e.stopPropagation());

  const btnDown = document.createElement('button');
  btnDown.className = 'toolbar-btn toolbar-btn-success';
  btnDown.textContent = '▼';
  btnDown.addEventListener('click', e => { e.stopPropagation(); changePitch(score, -1); updatePitchDisplay(pitchCenter, note); });

  pitchRow.appendChild(btnUp);
  pitchRow.appendChild(pitchCenter);
  pitchRow.appendChild(btnDown);
  toolbar.appendChild(pitchRow);

  // ─ "Do = X" label ─────────────────────────────────────────────────────────
  const doLabel = document.createElement('div');
  doLabel.className = 'toolbar-do-label';
  toolbar.appendChild(doLabel);

  updatePitchDisplay(pitchCenter, note, doLabel);

  // ─ Position above the neume ───────────────────────────────────────────────
  document.body.appendChild(toolbar);
  _toolbar = toolbar;

  positionToolbar(toolbar, anchorOverride || group || noteEl || el);
}

function updatePitchDisplay(pitchCenter, note, doLabel) {
  if (!score || !note?.pitch) return;
  getTranspose(score); // ensures score.defaultStartPitch is initialized
  const notes = getScoreNotes(score);
  const firstPitched = notes.find(n => n.pitch && !n.isDivider);
  if (!firstPitched || !score.defaultStartPitch) return;

  const startPitchInt = firstPitched.pitch.toInt();
  const transpose = score.defaultStartPitch.toInt() - startPitchInt;
  const allPitched = notes.filter(n => n.pitch && !n.isDivider);
  const low  = Math.min(...allPitched.map(n => n.pitch.toInt()));
  const high = Math.max(...allPitched.map(n => n.pitch.toInt()));

  const OFFSET = 36; // Exsurge new scale → tones.map index
  const thisPitchInt  = note.pitch.toInt() + transpose + OFFSET;
  const lowPitchInt   = low  + transpose + OFFSET;
  const highPitchInt  = high + transpose + OFFSET;
  const doPitchInt    = score.defaultStartPitch.toInt() - startPitchInt + startPitchInt + transpose + OFFSET;

  pitchCenter.innerHTML =
    'Pitch: ' + formatPitch(thisPitchInt) +
    '<br>Range: ' + formatPitch(lowPitchInt) + ' to ' + formatPitch(highPitchInt);

  if (doLabel) {
    doLabel.textContent = 'Do = ' + formatPitchName(doPitchInt);
  }
}

function formatPitch(tonesMapIdx) {
  const noteNames = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const octave = Math.floor(tonesMapIdx / 12);
  const name   = noteNames[((tonesMapIdx % 12) + 12) % 12];
  return name + '<sub>' + octave + '</sub>';
}

function formatPitchName(tonesMapIdx) {
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return noteNames[((tonesMapIdx % 12) + 12) % 12];
}

function positionToolbar(toolbar, anchorEl) {
  if (!anchorEl) return;
  const anchorRect = anchorEl.getBoundingClientRect();
  const toolbarH   = toolbar.offsetHeight;
  const toolbarW   = toolbar.offsetWidth;
  const scrollTop  = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  let top  = anchorRect.top + scrollTop - toolbarH - 6;
  let left = anchorRect.left + scrollLeft + anchorRect.width / 2 - toolbarW / 2;

  // If toolbar would go above the document, flip below
  if (top < scrollTop + 4) top = anchorRect.bottom + scrollTop + 6;

  // Clamp horizontally
  left = Math.max(scrollLeft + 8, Math.min(left, scrollLeft + window.innerWidth - toolbarW - 8));

  toolbar.style.top  = top  + 'px';
  toolbar.style.left = left + 'px';
}

function onPreviewClick(e) {
  // Match both use[source-index] and text[source-index]:not(.dropCap)
  const useEl  = e.target.closest('use[source-index]');
  const textEl = !useEl && e.target.closest('text[source-index]');

  if (textEl && textEl.classList.contains('dropCap')) {
    e.stopPropagation();
    // Show toolbar for the first pitched note, positioned near the drop cap
    if (score && isAudioAvailable()) {
      const firstUse = Array.from(chantPreview.querySelectorAll('svg use[source-index]'))
        .find(u => u.source?.pitch);
      if (firstUse) showToolbarForNote(firstUse, textEl);
    }
    return;
  }

  const target = useEl || textEl;
  if (!target) { removeToolbar(); return; }

  e.stopPropagation();
  showToolbarForNote(target);
}

function onDocumentClick(e) {
  if (!_toolbar) return;
  // Ignore clicks inside toolbar or preview
  if (_toolbar.contains(e.target) || chantPreview.contains(e.target)) return;
  removeToolbar();
}

// ─── Playback ────────────────────────────────────────────────────────────────

function startPlayback(startNote) {
  stopScore();
  showMediaControls();
  updateBpmDisplay();
  setPlayPauseIcon(true);

  playScore(score, startNote, {
    onEnd: () => {
      hideMediaControls();
    },
  });
}

function onPauseResume(e) {
  e.stopPropagation();
  // Simple toggle: stop = "pause" (we don't have true pause yet; restart from beginning)
  if (isPlayingScore()) {
    stopScore();
    setPlayPauseIcon(false);
  } else {
    startPlayback(null);
    setPlayPauseIcon(true);
  }
}

function onMediaStop(e) {
  e.stopPropagation();
  stopScore();
  hideMediaControls();
  removeToolbar();
}

function updateBpm(delta) {
  setBpm(getBpm() + delta);
  updateBpmDisplay();
}

function updateBpmDisplay() {
  if (bpmDisplay) bpmDisplay.textContent = getBpm() + ' BPM';
}

function setPlayPauseIcon(playing) {
  if (btnPauseResume) btnPauseResume.textContent = playing ? '⏸' : '▶';
}

function showMediaControls() {
  if (mediaControls) {
    mediaControls.classList.remove('hidden');
  }
}

function hideMediaControls() {
  if (mediaControls) {
    mediaControls.classList.add('hidden');
  }
}

// ─── Export handlers ──────────────────────────────────────────────────────────
function onExportPdf(e) {
  e.preventDefault();
  const gabc = gabcEditor.value.trim();
  if (!gabc) return setStatus('Nothing to export.', 'warn');
  pdfGabcInput.value = gabc;
  pdfForm.submit();
}

function onExportPng(e) {
  e.preventDefault();
  if (!score) return setStatus('Nothing to export.', 'warn');
  try {
    const svgNode  = exportSvg(ctxt, score, DEFAULT_EXPORT_WIDTH);
    saveSvgAsPng(svgNode, getFilename('png'), { scale: DEFAULT_DPI / 96, backgroundColor: '#fff' });
    setStatus('PNG downloaded.');
  } catch (err) {
    setStatus('PNG export failed: ' + err.message, 'error');
    console.error(err);
  }
}

function onExportSvg(e) {
  e.preventDefault();
  if (!score) return setStatus('Nothing to export.', 'warn');
  try {
    const svgNode  = exportSvg(ctxt, score, DEFAULT_EXPORT_WIDTH);
    saveSvg(svgNode, getFilename('svg'));
    setStatus('SVG downloaded.');
  } catch (err) {
    setStatus('SVG export failed: ' + err.message, 'error');
    console.error(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFilename(ext) {
  const match = gabcEditor.value.match(/^name:\s*(.+?)\s*;/m);
  const base  = match ? match[1].replace(/[^a-z0-9_\-]/gi, '_') : 'chant';
  return base + '.' + ext;
}

function setStatus(msg, level = 'info') {
  if (!statusMsg) return;
  statusMsg.textContent = msg;
  const classes = {
    info:  'text-xs text-gray-400',
    error: 'text-xs text-red-500',
    warn:  'text-xs text-yellow-600',
  };
  statusMsg.className = classes[level] || classes.info;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
