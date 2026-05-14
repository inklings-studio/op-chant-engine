import { createContext, renderGabc, exportSvg } from '../core/renderer.js';
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
import { getState } from '../common/state.js';
import '../languages/sk/index.js';
import { initEditor, buildSaveData, restoreFromSave } from './editor.js';
import { initMobilePane } from '../common/mobile-pane.js';
import {
    formatPitch,
    formatPitchName,
    positionToolbar,
    showSaveModal,
} from '../common/ui-helpers.js';
import { listSaves, getSave, putSave, deleteSave, hasSave } from '../common/storage.js';

const DEFAULT_EXPORT_WIDTH = 7.5 * 96;
const DEFAULT_DPI = 300;
const RENDER_DEBOUNCE_MS = 300;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const gabcEditor = document.getElementById('gabcEditor');
const chantPreview = document.getElementById('chantPreview');
const versesPreview = document.getElementById('versesPreview');
const placeholder = document.getElementById('previewPlaceholder');
const statusMsg = document.getElementById('statusMessage');
const btnSave = document.getElementById('btnSave');
const btnPng = document.getElementById('btnDownloadPng');
const btnSvg = document.getElementById('btnDownloadSvg');

const previewControls = document.getElementById('previewControls');
const btnPlayFromStart = document.getElementById('btnPlayFromStart');
const btnHeaderPitchUp = document.getElementById('btnHeaderPitchUp');
const btnHeaderPitchDown = document.getElementById('btnHeaderPitchDown');
const headerPitchDisplay = document.getElementById('headerPitchDisplay');

const mediaControls = document.getElementById('mediaControls');
const btnPauseResume = document.getElementById('btnPauseResume');
const btnBpmMinus = document.getElementById('btnBpmMinus');
const btnBpmPlus = document.getElementById('btnBpmPlus');
const bpmDisplay = document.getElementById('bpmDisplay');
const btnMediaStop = document.getElementById('btnMediaStop');

// ─── Tab refs ─────────────────────────────────────────────────────────────────
const _editorTab = document.getElementById('editorTab');
const _gabcTab = document.getElementById('gabcTab');
const _editorBtn = document.getElementById('tabEditorBtn');
const _gabcBtn = document.getElementById('tabGabcBtn');

// ─── Module state ─────────────────────────────────────────────────────────────
let ctxt = null;
let score = null;
let _audioScore = null; // full-chant score for audio in HTML output mode
let _audioContainer = null; // off-screen container for _audioScore's SVG layout
let _currentMode = 'gabc'; // tracks last compiled output mode
let _renderGabc = ''; // what _doRender actually renders (may differ from gabcEditor in HTML mode)
let _toolbar = null;
let _lastAutoLoadKey = '';
let _inAutoLoad = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
    try {
        ctxt = createContext();
    } catch (err) {
        setStatus(err.message, 'error');
        return;
    }

    // Off-screen container for the full-chant audio score in HTML output mode.
    // Uses visibility:hidden (not display:none) so Exsurge can measure dimensions.
    _audioContainer = document.createElement('div');
    _audioContainer.style.cssText =
        'position:fixed;left:-9999px;top:-9999px;width:720px;visibility:hidden;pointer-events:none';
    document.body.appendChild(_audioContainer);

    const state = getState();
    state.largeInitial = true;
    state.strophicInheritance = false;
    state.stanzaNumbers = true;

    // Register before initEditor so these fire before editor.js change handlers,
    // ensuring _lastAutoLoadKey is cleared before triggerCompile → onCompiled runs.
    ['editorTone', 'editorTerm', 'editorSolemn', 'psalmSelect'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => {
            _lastAutoLoadKey = '';
        });
    });

    initEditor(state, onCompiled, { onStatus: setStatus });
    initMobilePane();

    btnPlayFromStart?.addEventListener('click', () => {
        if ((_audioScore ?? score) && isAudioAvailable()) {
            clearCurrentNote();
            startPlayback(null);
        }
    });
    btnHeaderPitchUp?.addEventListener('click', () => {
        if (score) changePitch(score, 1);
        if (_audioScore) changePitch(_audioScore, 1);
        if (score || _audioScore) _updateHeaderPitchDisplay();
    });
    btnHeaderPitchDown?.addEventListener('click', () => {
        if (score) changePitch(score, -1);
        if (_audioScore) changePitch(_audioScore, -1);
        if (score || _audioScore) _updateHeaderPitchDisplay();
    });

    btnPauseResume?.addEventListener('click', onPauseResume);
    btnBpmMinus?.addEventListener('click', () => updateBpm(-10));
    btnBpmPlus?.addEventListener('click', () => updateBpm(+10));
    btnMediaStop?.addEventListener('click', onMediaStop);

    chantPreview.addEventListener('click', onPreviewClick);
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onDocumentKeydown);
    document.addEventListener('click', (e) => {
        if (e.target instanceof HTMLButtonElement) e.target.blur();
    });

    btnSave?.addEventListener('click', onSave);
    btnPng?.addEventListener('click', onExportPng);
    btnSvg?.addEventListener('click', onExportSvg);

    _editorBtn.addEventListener('click', () => switchToTab('editor'));
    _gabcBtn.addEventListener('click', () => switchToTab('gabc'));

    setStatus(isAudioAvailable() ? 'Ready.' : 'Ready (audio unavailable).');
}

// ─── Save / Auto-load ─────────────────────────────────────────────────────────
function _psalmAutoLoadKey() {
    const psalmVal = document.getElementById('psalmSelect')?.value || '';
    const toneVal = document.getElementById('editorTone')?.value || 'tone8';
    return (psalmVal ? `Ps${psalmVal}` : 'custom') + `_${toneVal}`;
}

function onSave() {
    const state = getState();
    showSaveModal({
        title: 'Save Psalm',
        defaultName: _psalmAutoLoadKey(),
        saves: listSaves('psalms'),
        onSave(name) {
            try {
                putSave('psalms', name, buildSaveData(state));
            } catch (err) {
                setStatus('Save failed: ' + err.message, 'error');
                return false;
            }
            setStatus(`Saved as '${name}'.`);
            return true;
        },
        onDelete(name) {
            deleteSave('psalms', name);
        },
    });
}

// ─── Compiled output callback ─────────────────────────────────────────────────
function onCompiled(result) {
    // Auto-load: if a save matches the current psalm+tone key, apply it once.
    // Re-entry guard prevents the triggerCompile inside restoreFromSave from looping.
    if (!_inAutoLoad) {
        const key = _psalmAutoLoadKey();
        if (key !== _lastAutoLoadKey && hasSave('psalms', key)) {
            const data = getSave('psalms', key);
            if (data?.gabc) {
                _lastAutoLoadKey = key;
                _inAutoLoad = true;
                restoreFromSave(getState(), data);
                _inAutoLoad = false;
                setStatus(`Auto-loaded '${key}'.`);
                return;
            }
        }
    }

    _currentMode = result.mode;
    gabcEditor.value = result.gabcFull; // GABC tab always shows full GABC

    if (result.mode === 'html') {
        // Verse 1 renders visually; full GABC renders into hidden container for audio.
        _scheduleRender(result.gabc1 ?? '');
        _audioScore = result.gabcFull?.trim()
            ? renderGabc(ctxt, result.gabcFull, _audioContainer, DEFAULT_EXPORT_WIDTH)
            : null;
        _syncPreviewControls();

        if (versesPreview) {
            versesPreview.innerHTML = result.versesHtml ?? '';
            versesPreview.classList.toggle('hidden', !result.versesHtml);
        }
    } else {
        // GABC mode — clear audio score and HTML verses, render full GABC visually.
        _audioScore = null;
        if (versesPreview) {
            versesPreview.innerHTML = '';
            versesPreview.classList.add('hidden');
        }
        _scheduleRender(result.gabcFull);
    }
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchToTab(tab) {
    const toEditor = tab === 'editor';

    _editorTab.classList.toggle('hidden', !toEditor);
    _gabcTab.classList.toggle('hidden', toEditor);

    const [activeBtn, inactiveBtn] = toEditor ? [_editorBtn, _gabcBtn] : [_gabcBtn, _editorBtn];
    activeBtn.classList.add('tab-btn-active', 'border-op-gold', 'text-op-ink');
    activeBtn.classList.remove('border-transparent', 'text-op-ink-subtle');
    inactiveBtn.classList.remove('tab-btn-active', 'border-op-gold', 'text-op-ink');
    inactiveBtn.classList.add('border-transparent', 'text-op-ink-subtle');
}

// ─── Rendering ────────────────────────────────────────────────────────────────
let renderTimer = null;

function _scheduleRender(gabc) {
    _renderGabc = gabc;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(_doRender, RENDER_DEBOUNCE_MS);
}

function _doRender() {
    const gabc = _renderGabc.trim();
    if (!gabc) {
        chantPreview.innerHTML = '';
        if (placeholder) placeholder.style.display = '';
        score = null;
        _syncPreviewControls();
        setStatus('');
        return;
    }
    if (placeholder) placeholder.style.display = 'none';
    setStatus('Rendering…');
    try {
        score = renderGabc(ctxt, gabc, chantPreview);
        _syncPreviewControls();
        setStatus('');
    } catch (err) {
        setStatus('Render error: ' + err.message, 'error');
        console.error('[app.js] renderGabc failed:', err);
    }
}

// ─── Floating toolbar ─────────────────────────────────────────────────────────

function removeToolbar() {
    if (_toolbar) {
        _toolbar.remove();
        _toolbar = null;
    }
    if (!isPlayingScore()) {
        chantPreview.querySelectorAll('use.active, text.active').forEach((el) => {
            el.classList.remove('active');
        });
    }
}

function resolveClickedNote(el) {
    let noteEl = null;
    let note = null;
    let group = null;

    if (el.tagName.toLowerCase() === 'use' && el.source?.neume) {
        noteEl = el;
        note = el.source;
        group = el.parentElement;
    } else if (el.tagName.toLowerCase() === 'text') {
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

    el.classList.add('active');
    if (anchorOverride) anchorOverride.classList.add('active');

    const toolbar = document.createElement('div');
    toolbar.className = 'chant-toolbar';
    toolbar.setAttribute('data-toolbar', '');

    const btnPlay = document.createElement('button');
    btnPlay.className = 'toolbar-btn toolbar-btn-primary';
    const isFirst = getScoreNotes(score).find((n) => n.pitch && !n.isDivider)?.svgNode === noteEl;
    btnPlay.textContent = isFirst ? '▶ Play Chant' : '▶ Play from here';
    btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        startPlayback(noteEl?.source ?? null);
        removeToolbar();
    });
    toolbar.appendChild(btnPlay);

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

    const doLabel = document.createElement('div');
    doLabel.className = 'toolbar-do-label';
    toolbar.appendChild(doLabel);

    updatePitchDisplay(pitchCenter, note, doLabel);

    document.body.appendChild(toolbar);
    _toolbar = toolbar;
    positionToolbar(toolbar, anchorOverride || group || noteEl || el);
}

function _getPitchData() {
    const pitchScore = _audioScore ?? score;
    if (!pitchScore) return null;
    const notes = getScoreNotes(pitchScore);
    const firstPitched = notes.find((n) => n.pitch && !n.isDivider);
    if (!firstPitched || !pitchScore.defaultStartPitch) return null;
    const allPitched = notes.filter((n) => n.pitch && !n.isDivider);
    return {
        firstPitched,
        transpose: pitchScore.defaultStartPitch.toInt() - firstPitched.pitch.toInt(),
        low: Math.min(...allPitched.map((n) => n.pitch.toInt())),
        high: Math.max(...allPitched.map((n) => n.pitch.toInt())),
    };
}

function updatePitchDisplay(pitchCenter, note, doLabel) {
    if (!note?.pitch) return;
    getTranspose(_audioScore ?? score);
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
    // In HTML mode verse 1 SVG is visual only; play is driven by the full audio score.
    if (_currentMode === 'html') {
        removeToolbar();
        return;
    }

    const useEl = e.target.closest('use[source-index]');
    const textEl = !useEl && e.target.closest('text[source-index]');

    if (textEl && textEl.classList.contains('dropCap')) {
        e.stopPropagation();
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
    if (_toolbar.contains(e.target) || chantPreview.contains(e.target)) return;
    removeToolbar();
}

// ─── Playback ────────────────────────────────────────────────────────────────

function _syncPreviewControls() {
    const playableScore = _audioScore ?? score;
    const visible = !!playableScore && isAudioAvailable();
    if (previewControls) previewControls.classList.toggle('hidden', !visible);
    if (visible) _updateHeaderPitchDisplay();
}

function _updateHeaderPitchDisplay() {
    if (!headerPitchDisplay) return;
    getTranspose(_audioScore ?? score);
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
    const playableScore = _audioScore ?? score;
    if (!playableScore) return;
    stopScore();
    if (btnPlayFromStart) btnPlayFromStart.disabled = true;
    showMediaControls();
    updateBpmDisplay();
    setPlayPauseIcon(true);
    playScore(playableScore, startNote, {
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
        startPlayback(null);
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
            stopScore();
            setPlayPauseIcon(false);
            if (btnPlayFromStart) btnPlayFromStart.disabled = false;
        } else {
            startPlayback(getCurrentNote());
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
    if (mediaControls) mediaControls.classList.remove('hidden');
}

function hideMediaControls() {
    if (mediaControls) mediaControls.classList.add('hidden');
}

// ─── Export ───────────────────────────────────────────────────────────────────

function onExportPng(e) {
    e.preventDefault();
    if (!score) return setStatus('Nothing to export.', 'warn');
    try {
        const svgNode = exportSvg(ctxt, score, DEFAULT_EXPORT_WIDTH);
        saveSvgAsPng(svgNode, 'psalm.png', { scale: DEFAULT_DPI / 96, backgroundColor: '#fff' });
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
        saveSvg(svgNode, 'psalm.svg');
        setStatus('SVG downloaded.');
    } catch (err) {
        setStatus('SVG export failed: ' + err.message, 'error');
        console.error(err);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
