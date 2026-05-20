// Entry point for the v2 Transcriber tool.
// Runs as an ES6 module. window.exsurge, window.tones, and saveSvgAsPng/saveSvg
// must already be available via classic <script> tags loaded before this module.

import {
    createContext,
    renderGabc,
    exportSvg,
    BASE_FONT_PX,
    BASE_GLYPH_S,
    BASE_FONT_PT,
} from '../core/renderer.js';
import {
    isAudioAvailable,
    playScore,
    stopScore,
    isPlayingScore,
    getCurrentNote,
    clearCurrentNote,
    getScoreNotes,
    getTranspose,
    changePitch,
    getBpm,
    setBpm,
    EXSURGE_TO_TONES_OFFSET,
} from '../core/audio.js';
import {
    formatPitch,
    formatPitchName,
    positionToolbar,
    showSaveModal,
    showLoadModal,
} from '../common/ui-helpers.js';
import { listSaves, getSave, putSave, deleteSave } from '../common/storage.js';

// Language plugins — self-register via side-effect import
import '../languages/sk/index.js';
import '../languages/la/index.js';

import { getState } from '../common/state.js';
import { initEditor, rebuildStanzas } from './editor.js';
import { parseGabc } from '../common/gabc-parser.js';
import { initMobilePane } from '../common/mobile-pane.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_EXPORT_WIDTH = 7.5 * 96;
const DEFAULT_DPI = 300;
const RENDER_DEBOUNCE_MS = 300;

// Maps sourceandsummit gabc-id → web font family for Exsurge live preview
const FONT_MAP = {
    Crimson: "'Crimson Text', serif",
    GaramondPremierPro: "'EB Garamond', serif",
    OFLSortsMillGoudy: "'Sorts Mill Goudy', serif",
    Fanwood: "'Fanwood Text', serif",
    IMFELLDoublePicaPRO: "'IM Fell Double Pica', serif",
    IMFELLDWPicaPRO: "'IM Fell DW Pica', serif",
    IMFELLEnglishPRO: "'IM Fell English', serif",
    IMFELLFrenchCanonPRO: "'IM Fell French Canon', serif",
    times: "'Times New Roman', serif",
    palatino: "Palatino, 'Palatino Linotype', serif",
    GillSansMTPro: "'Gill Sans', 'Gill Sans MT', sans-serif",
    GillSansMTProLight: "'Gill Sans', 'Gill Sans MT', sans-serif",
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const gabcEditor = document.getElementById('gabcEditor');
const chantPreview = document.getElementById('chantPreview');
const placeholder = document.getElementById('previewPlaceholder');
const statusMsg = document.getElementById('statusMessage');
const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');
const btnPdf = document.getElementById('btnExportPdf');
const btnPng = document.getElementById('btnDownloadPng');
const btnSvg = document.getElementById('btnDownloadSvg');
const pdfForm = document.getElementById('pdfForm');
const pdfGabcInput = document.getElementById('pdfGabc');
const pdfWidthInput = document.getElementById('pdfWidth');
const pdfHeightInput = document.getElementById('pdfHeight');
const pdfFontSizeInput = document.getElementById('pdfFontSize');
const pdfFontInput = document.getElementById('pdfFont');

// Preview header controls
const previewControls = document.getElementById('previewControls');
const btnPlayFromStart = document.getElementById('btnPlayFromStart');
const btnHeaderPitchUp = document.getElementById('btnHeaderPitchUp');
const btnHeaderPitchDown = document.getElementById('btnHeaderPitchDown');
const headerPitchDisplay = document.getElementById('headerPitchDisplay');

// Media controls
const mediaControls = document.getElementById('mediaControls');
const btnPauseResume = document.getElementById('btnPauseResume');
const btnBpmMinus = document.getElementById('btnBpmMinus');
const btnBpmPlus = document.getElementById('btnBpmPlus');
const bpmDisplay = document.getElementById('bpmDisplay');
const btnMediaStop = document.getElementById('btnMediaStop');

// ─── Module state ─────────────────────────────────────────────────────────────
let ctxt = null;
let score = null;
let _toolbar = null; // currently visible floating toolbar div

let _lastCompiledGabc = '';
let _isDirty = false;
let _initDone = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
    try {
        ctxt = createContext();
    } catch (err) {
        setStatus(err.message, 'error');
        console.error(err);
        return;
    }

    initEditor(getState(), onCompiledGabc);

    gabcEditor.addEventListener('input', onEditorInput);
    gabcEditor.addEventListener('keydown', onEditorKeydown);
    document.addEventListener('keydown', onDocumentKeydown);
    btnSave?.addEventListener('click', onSave);
    btnLoad?.addEventListener('click', onLoad);
    btnPdf.addEventListener('click', onExportPdf);
    btnPng.addEventListener('click', onExportPng);
    btnSvg.addEventListener('click', onExportSvg);
    window.addEventListener('beforeunload', (e) => {
        if (_isDirty) e.preventDefault();
    });

    // Click on note or syllable text in the preview
    chantPreview.addEventListener('click', onPreviewClick);

    // Dismiss toolbar when clicking outside preview + toolbar
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('click', (e) => {
        if (e.target instanceof HTMLButtonElement) e.target.blur();
    });

    // Preview header controls
    btnPlayFromStart?.addEventListener('click', () => {
        if (score && isAudioAvailable()) {
            clearCurrentNote();
            startPlayback(null);
        }
    });
    btnHeaderPitchUp?.addEventListener('click', () => {
        if (score) {
            changePitch(score, 1);
            _updateHeaderPitchDisplay();
        }
    });
    btnHeaderPitchDown?.addEventListener('click', () => {
        if (score) {
            changePitch(score, -1);
            _updateHeaderPitchDisplay();
        }
    });

    // Media controls
    btnPauseResume?.addEventListener('click', onPauseResume);
    btnBpmMinus?.addEventListener('click', () => updateBpm(-10));
    btnBpmPlus?.addEventListener('click', () => updateBpm(+10));
    btnMediaStop?.addEventListener('click', onMediaStop);

    setStatus(isAudioAvailable() ? 'Ready.' : 'Ready (audio unavailable).');

    // Tab switching
    document.getElementById('tabEditorBtn').addEventListener('click', () => switchToTab('editor'));
    document.getElementById('tabGabcBtn').addEventListener('click', () => switchToTab('gabc'));

    initMobilePane();

    _initDone = true;
}

// ─── Rendering ────────────────────────────────────────────────────────────────
let renderTimer = null;

function onEditorInput() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderFromEditor, RENDER_DEBOUNCE_MS);
}

// ─── Tab 1 → Tab 2 compiled output ───────────────────────────────────────────
function onCompiledGabc(gabcStr) {
    gabcEditor.value = gabcStr;
    _lastCompiledGabc = gabcStr;
    if (_initDone && gabcStr.trim()) _isDirty = true;
    renderFromEditor();
}

// ─── Tab switching ────────────────────────────────────────────────────────────
const _editorTab = document.getElementById('editorTab');
const _gabcTab = document.getElementById('gabcTab');
const _editorBtn = document.getElementById('tabEditorBtn');
const _gabcBtn = document.getElementById('tabGabcBtn');

function switchToTab(tab) {
    const toEditor = tab === 'editor';

    // Dirty-flag sync: Tab 2 was manually edited, parse it back into Tab 1.
    // Compare against the last programmatically compiled value so spurious
    // browser events (autocorrect, autofill) don't clobber the editor state.
    if (toEditor && gabcEditor.value !== _lastCompiledGabc) {
        const parsed = parseGabc(gabcEditor.value.trim());
        const state = getState();
        state.clef = parsed.clef;
        state.stanzas = parsed.stanzas;
        state.coda = parsed.coda;
        state.font = parsed.font;
        state.fontSizePt = parsed.fontSizePt;
        state.pageWidthIn = parsed.pageWidthIn;
        state.pageHeightIn = parsed.pageHeightIn;
        state.strophicInheritance = false;
        rebuildStanzas(state);
        _lastCompiledGabc = gabcEditor.value;
        _isDirty = true;
    }

    _editorTab.classList.toggle('hidden', !toEditor);
    _gabcTab.classList.toggle('hidden', toEditor);

    const [activeBtn, inactiveBtn] = toEditor ? [_editorBtn, _gabcBtn] : [_gabcBtn, _editorBtn];
    activeBtn.classList.add('tab-btn-active', 'border-op-gold', 'text-op-ink');
    activeBtn.classList.remove('border-transparent', 'text-op-ink-subtle');
    inactiveBtn.classList.remove('tab-btn-active', 'border-op-gold', 'text-op-ink');
    inactiveBtn.classList.add('border-transparent', 'text-op-ink-subtle');
}

// Applies font/size scaling from GABC header to ctxt and returns render width (px), if set.
function _applyContextSettings(gabc) {
    const sizeM = gabc.match(/%fontsize\s*:\s*(\d+(?:\.\d+)?)\s*;/m);
    const fontM = gabc.match(/%font\s*:\s*([^;\s]+)\s*;/m);
    const widthM = gabc.match(/%width\s*:\s*(\d+(?:\.\d+)?)\s*;/m);
    const scale = sizeM ? parseFloat(sizeM[1]) / BASE_FONT_PT : 1;
    const family = fontM && FONT_MAP[fontM[1]] ? FONT_MAP[fontM[1]] : "'Crimson Text', serif";
    ctxt.setFont(family, BASE_FONT_PX * scale);
    ctxt.setGlyphScaling(BASE_GLYPH_S * scale);
    ctxt.textStyles.dropCap.size = 64 * scale;
    ctxt.textStyles.annotation.size = 12.8 * scale;
    return widthM ? parseFloat(widthM[1]) * 96 : undefined;
}

function renderFromEditor() {
    const gabc = gabcEditor.value.trim();
    if (!gabc) {
        chantPreview.innerHTML = '';
        if (placeholder) {
            chantPreview.appendChild(placeholder);
            placeholder.style.display = '';
        }
        score = null;
        _syncPreviewControls();
        setStatus('');
        return;
    }
    const renderWidthPx = _applyContextSettings(gabc);
    if (placeholder) placeholder.style.display = 'none';
    setStatus('Rendering…');
    try {
        score = renderGabc(ctxt, gabc, chantPreview, renderWidthPx);
        _syncPreviewControls();
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
        const end = gabcEditor.selectionEnd;
        gabcEditor.value = gabcEditor.value.slice(0, start) + '  ' + gabcEditor.value.slice(end);
        gabcEditor.selectionStart = gabcEditor.selectionEnd = start + 2;
    }
}

// ─── Global keyboard shortcuts ────────────────────────────────────────────────
function onDocumentKeydown(e) {
    if (e.repeat) return;

    const tag = document.activeElement?.tagName;
    const isInteractive =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        document.activeElement?.isContentEditable;

    if (e.key === ' ') {
        if (isInteractive || !score || !isAudioAvailable()) return;
        e.preventDefault();
        if (isPlayingScore()) {
            stopScore(); // _currentNote preserved for resume
            setPlayPauseIcon(false);
            if (btnPlayFromStart) btnPlayFromStart.disabled = false;
        } else {
            startPlayback(getCurrentNote()); // null = from start if not paused mid-song
        }
    } else if (e.key === 'Escape') {
        if (mediaControls?.classList.contains('hidden')) return;
        e.preventDefault();
        clearCurrentNote();
        stopScore();
        hideMediaControls();
        removeToolbar();
        if (btnPlayFromStart) btnPlayFromStart.disabled = false;
    }
}

// ─── Floating toolbar ─────────────────────────────────────────────────────────

function removeToolbar() {
    if (_toolbar) {
        _toolbar.remove();
        _toolbar = null;
    }
    // remove active highlight from all elements (unless playing)
    if (!isPlayingScore()) {
        chantPreview.querySelectorAll('use.active, text.active').forEach((el) => {
            el.classList.remove('active');
        });
    }
}

/**
 * Given a clicked SVG element (use or text), returns the corresponding note
 * object and the neume group element for positioning.
 */
function resolveClickedNote(el) {
    let noteEl = null; // the use[source-index] element
    let note = null; // the Note object (has .pitch, .svgNode)
    let group = null; // the parent <g> of the neume (for toolbar positioning)

    if (el.tagName.toLowerCase() === 'use' && el.source?.neume) {
        noteEl = el;
        note = el.source;
        group = el.parentElement;
    } else if (el.tagName.toLowerCase() === 'text') {
        // Find the first pitched use element in the same neume group
        group = el.parentElement;
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
    const isFirst = getScoreNotes(score).find((n) => n.pitch && !n.isDivider)?.svgNode === noteEl;
    btnPlay.textContent = isFirst ? '▶ Play Chant' : '▶ Play from here';
    btnPlay.addEventListener('click', (e) => {
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
    btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        changePitch(score, 1);
        updatePitchDisplay(pitchCenter, note);
    });

    const pitchCenter = document.createElement('button');
    pitchCenter.className = 'toolbar-btn toolbar-btn-info toolbar-pitch-info';
    pitchCenter.addEventListener('click', (e) => e.stopPropagation());

    const btnDown = document.createElement('button');
    btnDown.className = 'toolbar-btn toolbar-btn-success';
    btnDown.textContent = '▼';
    btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        changePitch(score, -1);
        updatePitchDisplay(pitchCenter, note);
    });

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

// Returns computed pitch data from the current score, or null if unavailable.
function _getPitchData() {
    if (!score) return null;
    const notes = getScoreNotes(score);
    const firstPitched = notes.find((n) => n.pitch && !n.isDivider);
    if (!firstPitched || !score.defaultStartPitch) return null;
    const transpose = score.defaultStartPitch.toInt() - firstPitched.pitch.toInt();
    const allPitched = notes.filter((n) => n.pitch && !n.isDivider);
    return {
        firstPitched,
        transpose,
        low: Math.min(...allPitched.map((n) => n.pitch.toInt())),
        high: Math.max(...allPitched.map((n) => n.pitch.toInt())),
    };
}

function updatePitchDisplay(pitchCenter, note, doLabel) {
    if (!note?.pitch) return;
    getTranspose(score);
    const d = _getPitchData();
    if (!d) return;
    const { transpose, low, high } = d;
    const OFF = EXSURGE_TO_TONES_OFFSET;
    pitchCenter.innerHTML =
        'Pitch: ' +
        formatPitch(note.pitch.toInt() + transpose + OFF) +
        '<br>Range: ' +
        formatPitch(low + transpose + OFF) +
        ' to ' +
        formatPitch(high + transpose + OFF);
    if (doLabel) {
        doLabel.textContent =
            'Do = ' + formatPitchName(score.defaultStartPitch.toInt() + transpose + OFF);
    }
}

function onPreviewClick(e) {
    // Match both use[source-index] and text[source-index]:not(.dropCap)
    const useEl = e.target.closest('use[source-index]');
    const textEl = !useEl && e.target.closest('text[source-index]');

    if (textEl && textEl.classList.contains('dropCap')) {
        e.stopPropagation();
        // Show toolbar for the first pitched note, positioned near the drop cap
        if (score && isAudioAvailable()) {
            const firstUse = Array.from(
                chantPreview.querySelectorAll('svg use[source-index]')
            ).find((u) => u.source?.pitch);
            if (firstUse) showToolbarForNote(firstUse, textEl);
        }
        return;
    }

    const target = useEl || textEl;
    if (!target) {
        removeToolbar();
        return;
    }

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

function _syncPreviewControls() {
    const visible = !!score && isAudioAvailable();
    if (previewControls) previewControls.classList.toggle('hidden', !visible);
    if (visible) _updateHeaderPitchDisplay();
}

function _updateHeaderPitchDisplay() {
    if (!headerPitchDisplay) return;
    getTranspose(score);
    const d = _getPitchData();
    if (!d) {
        headerPitchDisplay.innerHTML = '—';
        return;
    }
    const { firstPitched, transpose, low, high } = d;
    const OFF = EXSURGE_TO_TONES_OFFSET;
    headerPitchDisplay.innerHTML =
        'Pitch: ' +
        formatPitch(firstPitched.pitch.toInt() + transpose + OFF) +
        '<span class="hidden md:inline">&ensp;·&ensp;Range: ' +
        formatPitch(low + transpose + OFF) +
        ' to ' +
        formatPitch(high + transpose + OFF) +
        '</span>';
}

function startPlayback(startNote) {
    stopScore();
    if (btnPlayFromStart) btnPlayFromStart.disabled = true;
    showMediaControls();
    updateBpmDisplay();
    setPlayPauseIcon(true);

    playScore(score, startNote, {
        onEnd: () => {
            hideMediaControls();
            if (btnPlayFromStart) btnPlayFromStart.disabled = false;
        },
    });
}

function onPauseResume(e) {
    e.stopPropagation();
    if (isPlayingScore()) {
        stopScore();
        setPlayPauseIcon(false);
        if (btnPlayFromStart) btnPlayFromStart.disabled = false;
    } else {
        startPlayback(getCurrentNote()); // null = from start if not paused mid-song
        setPlayPauseIcon(true);
    }
}

function onMediaStop(e) {
    e.stopPropagation();
    clearCurrentNote();
    stopScore();
    hideMediaControls();
    removeToolbar();
    if (btnPlayFromStart) btnPlayFromStart.disabled = false;
}

function updateBpm(delta) {
    setBpm(getBpm() + delta);
    updateBpmDisplay();
}

function updateBpmDisplay() {
    if (bpmDisplay) bpmDisplay.textContent = getBpm() + ' BPM';
}

function setPlayPauseIcon(playing) {
    if (btnPauseResume)
        btnPauseResume.innerHTML = (playing ? '⏸' : '▶') + '<kbd class="op-kbd">Space</kbd>';
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

// ─── Save / Load handlers ─────────────────────────────────────────────────────
function onSave() {
    const state = getState();
    showSaveModal({
        title: 'Save Hymn',
        defaultName: state.annotation?.trim() || '',
        saves: listSaves('transcriber'),
        onSave(name) {
            try {
                putSave('transcriber', name, {
                    v: 1,
                    gabc: _lastCompiledGabc,
                    language: state.language,
                    strophic: state.strophicInheritance,
                    stanzaNumbers: state.stanzaNumbers,
                });
            } catch (err) {
                setStatus('Save failed: ' + err.message, 'error');
                return false;
            }
            _isDirty = false;
            setStatus(`Saved as '${name}'.`);
            return true;
        },
        onDelete(name) {
            deleteSave('transcriber', name);
        },
    });
}

function onLoad() {
    showLoadModal({
        title: 'Load Hymn',
        saves: listSaves('transcriber'),
        onLoad(name) {
            const data = getSave('transcriber', name);
            if (!data) {
                setStatus('Could not load save.', 'error');
                return;
            }
            const parsed = parseGabc(data.gabc ?? '');
            const state = getState();
            state.clef = parsed.clef;
            state.stanzas = parsed.stanzas;
            state.coda = parsed.coda;
            state.font = parsed.font;
            state.fontSizePt = parsed.fontSizePt;
            state.pageWidthIn = parsed.pageWidthIn;
            state.pageHeightIn = parsed.pageHeightIn;
            state.language = data.language ?? state.language;
            state.strophicInheritance = data.strophic ?? false;
            state.stanzaNumbers = data.stanzaNumbers ?? false;
            rebuildStanzas(state);
            _isDirty = false;
            setStatus(`Loaded '${name}'.`);
        },
        onDelete(name) {
            deleteSave('transcriber', name);
        },
    });
}

// ─── Export handlers ──────────────────────────────────────────────────────────
function onExportPdf(e) {
    e.preventDefault();
    const gabc = gabcEditor.value.trim();
    if (!gabc) return setStatus('Nothing to export.', 'warn');
    pdfGabcInput.value = gabc;
    const state = getState();
    if (state.font) pdfFontInput.value = state.font;
    if (state.fontSizePt) pdfFontSizeInput.value = state.fontSizePt;
    if (state.pageWidthIn) pdfWidthInput.value = state.pageWidthIn;
    if (state.pageHeightIn) pdfHeightInput.value = state.pageHeightIn;
    pdfForm.submit();
}

function onExportPng(e) {
    e.preventDefault();
    if (!score) return setStatus('Nothing to export.', 'warn');
    try {
        const svgNode = exportSvg(ctxt, score, DEFAULT_EXPORT_WIDTH);
        saveSvgAsPng(svgNode, getFilename('png'), {
            scale: DEFAULT_DPI / 96,
            backgroundColor: '#fff',
        });
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
        const svgNode = exportSvg(ctxt, score, DEFAULT_EXPORT_WIDTH);
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
    const base = match ? match[1].replace(/[^a-z0-9_-]/gi, '_') : 'chant';
    return base + '.' + ext;
}

function setStatus(msg, level = 'info') {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    const classes = {
        info: 'text-xs text-gray-400',
        error: 'text-xs text-red-500',
        warn: 'text-xs text-yellow-600',
    };
    statusMsg.className = classes[level] || classes.info;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
