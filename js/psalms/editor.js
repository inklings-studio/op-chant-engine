import { listLanguages, getLanguage } from '../common/language.js';
import { compileGabc, compileGabc1 } from '../common/compiler.js';
import { parseGabc } from '../common/gabc-parser.js';
import { BARLINES, tokenizeMelody } from '../common/melody.js';
import { pointVerse, deriveRolesFromNotes } from './pointer.js';
import { loadPsalm } from './loader.js';
import { compileBreviaryHtml } from './formatter.js';
import {
    tone1,
    tone2,
    tone3,
    tone4,
    tone4alt,
    tone5,
    tone6,
    tone7,
    tone8,
    per,
} from '../tones/dominican.js';
import { createMelodyInputRow } from '../common/editor.js';

const TONES = { tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per };
const TONE_LABELS = {
    tone1: 'Tone 1',
    tone2: 'Tone 2',
    tone3: 'Tone 3',
    tone4: 'Tone 4',
    tone4alt: 'Tone 4 (alt)',
    tone5: 'Tone 5',
    tone6: 'Tone 6',
    tone7: 'Tone 7',
    tone8: 'Tone 8',
    per: 'Peregrinus',
};

let _state = null;
let _onGabcCompiled = null;
let _onStatus = null;
let _toneKey = 'tone8';
let _cadenceKey = null;
let _isSolemn = false;
let _repeatIntonation = false;
let _outputMode = 'gabc';

// ─── DOM refs (initialised in initEditor to allow Node.js test imports) ───────
let _langSel,
    _psalmSel,
    _psalmLabel,
    _largeInitChk,
    _repeatIntonChk,
    _annotationInput,
    _rawText,
    _buildBtn,
    _rebuildBtn,
    _editToggle,
    _textArea,
    _stanzasEl,
    _toneSelect,
    _termSelect,
    _solemnChk,
    _gabcOptions,
    _htmlLeft,
    _htmlRight,
    _btnOutputGabc,
    _btnOutputHtml;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the editor: populates controls, wires events.
 * Call once on page load.
 * @param {object} state
 * @param {function(object): void} onGabcCompiled
 * @param {{ onStatus?: function(string, string=): void }} [options]
 */
export function initEditor(state, onGabcCompiled, options = {}) {
    // Reset ephemeral module state so each initEditor call starts from known defaults.
    _toneKey = 'tone8';
    _cadenceKey = null;
    _isSolemn = false;
    _repeatIntonation = false;
    _outputMode = 'gabc';

    _langSel = document.getElementById('editorLang');
    _psalmSel = document.getElementById('psalmSelect');
    _psalmLabel = document.getElementById('psalmSelectLabel');
    _largeInitChk = document.getElementById('editorLargeInitial');
    _repeatIntonChk = document.getElementById('editorRepeatIntonation');
    _annotationInput = document.getElementById('editorAnnotation');
    _rawText = document.getElementById('editorRawText');
    _buildBtn = document.getElementById('editorBuildBtn');
    _rebuildBtn = document.getElementById('editorRebuildBtn');
    _editToggle = document.getElementById('editorEditToggle');
    _textArea = document.getElementById('editorTextInputArea');
    _stanzasEl = document.getElementById('editorStanzas');
    _toneSelect = document.getElementById('editorTone');
    _termSelect = document.getElementById('editorTerm');
    _solemnChk = document.getElementById('editorSolemn');
    _gabcOptions = document.getElementById('editorGabcOptions');
    _htmlLeft = document.getElementById('editorHtmlLeft');
    _htmlRight = document.getElementById('editorHtmlRight');
    _btnOutputGabc = document.getElementById('btnOutputGabc');
    _btnOutputHtml = document.getElementById('btnOutputHtml');

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
        prepBegin: document.getElementById('editorPrepBegin')?.value ?? '<i>',
        prepEnd: document.getElementById('editorPrepEnd')?.value ?? '</i>',
        accBegin: document.getElementById('editorAccBegin')?.value ?? '<b>',
        accEnd: document.getElementById('editorAccEnd')?.value ?? '</b>',
        flexAccBegin: document.getElementById('editorFlexAccBegin')?.value ?? '',
        flexAccEnd: document.getElementById('editorFlexAccEnd')?.value ?? '',
        flexBegin: document.getElementById('editorFlexBegin')?.value ?? '<i>',
        flexEnd: document.getElementById('editorFlexEnd')?.value ?? '</i>',
    };
}

// ─── Tone helpers ─────────────────────────────────────────────────────────────

function _populateToneSelect() {
    const sel = _toneSelect;
    sel.innerHTML = Object.entries(TONE_LABELS)
        .map(([k, label]) => `<option value="${k}">${label}</option>`)
        .join('');
    sel.value = _toneKey;
}

function _populateTermSelect() {
    const tone = TONES[_toneKey];
    const sel = _termSelect;
    const keys = tone.terminations ? Object.keys(tone.terminations) : ['—'];
    sel.innerHTML = keys.map((k) => `<option value="${k}">${k}</option>`).join('');
    _cadenceKey = sel.value;
}

// ─── Static control wiring ────────────────────────────────────────────────────

function _populateLangSelect(state) {
    const sel = _langSel;
    sel.innerHTML = '';
    listLanguages().forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.code;
        opt.textContent = p.label;
        opt.selected = p.code === state.language;
        sel.appendChild(opt);
    });
}

function _populatePsalmSelect(lang) {
    const hasPsalms = Array.isArray(lang?.psalms) && lang.psalms.length > 0;
    _psalmLabel.classList.toggle('hidden', !hasPsalms);
    _psalmSel.classList.toggle('hidden', !hasPsalms);
    if (!hasPsalms) return;

    const sel = _psalmSel;
    sel.innerHTML = '<option value="">— select —</option>';
    lang.psalms.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = String(p.num);
        opt.textContent = p.label;
        sel.appendChild(opt);
    });
}

function _syncControlsToState(state) {
    _langSel.value = state.language;
    _largeInitChk.checked = state.largeInitial;
    _repeatIntonChk.checked = _repeatIntonation;
    _annotationInput.value = state.annotation ?? '';
    _toneSelect.value = _toneKey;
    _solemnChk.checked = _isSolemn;
}

function _wireStaticEvents(state) {
    _langSel.addEventListener('change', () => {
        state.language = _langSel.value;
        _populatePsalmSelect(getLanguage(state.language));
        if (state.stanzas.length) {
            _repointAll(state);
            _renderStanzas(state);
        }
        triggerCompile(state);
    });

    _largeInitChk.addEventListener('change', () => {
        state.largeInitial = _largeInitChk.checked;
        triggerCompile(state);
    });

    _annotationInput.addEventListener('input', () => {
        state.annotation = _annotationInput.value;
        triggerCompile(state);
    });

    _toneSelect.addEventListener('change', () => {
        _toneKey = _toneSelect.value;
        _populateTermSelect();
        if (state.stanzas.length) {
            _repointAll(state);
            _renderStanzas(state);
        }
        triggerCompile(state);
    });

    _termSelect.addEventListener('change', () => {
        _cadenceKey = _termSelect.value;
        if (state.stanzas.length) {
            _repointAll(state);
            _renderStanzas(state);
        }
        triggerCompile(state);
    });

    _solemnChk.addEventListener('change', () => {
        _isSolemn = _solemnChk.checked;
        if (state.stanzas.length) {
            _repointAll(state);
            _renderStanzas(state);
        }
        triggerCompile(state);
    });

    _repeatIntonChk.addEventListener('change', () => {
        _repeatIntonation = _repeatIntonChk.checked;
        if (state.stanzas.length) {
            _repointAll(state);
            _renderStanzas(state);
        }
        triggerCompile(state);
    });

    _buildBtn.addEventListener('click', () => {
        const raw = _rawText.value.trim();
        if (!raw) return;
        _doBuild(raw, state);
    });

    _psalmSel.addEventListener('change', async () => {
        const val = _psalmSel.value;
        if (!val) return;
        const lang = getLanguage(state.language);
        const entry = lang?.psalms?.find((p) => String(p.num) === val);
        if (!entry) return;

        _annotationInput.value = entry.label;
        state.annotation = entry.label;

        _onStatus?.('Loading psalm…');
        try {
            const text = await loadPsalm(state.language, entry.num);
            _rawText.value = text;
            _doBuild(text, state);
            _onStatus?.('');
        } catch (err) {
            _onStatus?.('Failed to load psalm: ' + err.message, 'error');
        }
    });

    _rebuildBtn.addEventListener('click', () => {
        const raw = _rawText.value.trim();
        if (!raw) return;
        _parseAndPoint(raw, state);
        _renderStanzas(state);
        triggerCompile(state);
    });

    function _setOutputMode(mode) {
        _outputMode = mode;
        const isHtml = _outputMode === 'html';
        _btnOutputGabc?.classList.toggle('output-mode-btn-selected', !isHtml);
        _btnOutputHtml?.classList.toggle('output-mode-btn-selected', isHtml);
        _gabcOptions.style.display = isHtml ? 'none' : 'grid';
        _htmlLeft.style.display = isHtml ? 'grid' : 'none';
        _htmlRight.style.display = isHtml ? 'grid' : 'none';
        // Large Initial: always on in HTML mode (drop cap on verse 1), user-controlled in GABC
        state.largeInitial = isHtml ? true : _largeInitChk.checked;
        triggerCompile(state);
    }
    _btnOutputGabc?.addEventListener('click', () => _setOutputMode('gabc'));
    _btnOutputHtml?.addEventListener('click', () => _setOutputMode('html'));

    [
        'editorPrepBegin',
        'editorPrepEnd',
        'editorAccBegin',
        'editorAccEnd',
        'editorFlexAccBegin',
        'editorFlexAccEnd',
        'editorFlexBegin',
        'editorFlexEnd',
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => triggerCompile(state));
    });

    _editToggle.addEventListener('click', () => {
        const hidden = _textArea.classList.toggle('hidden');
        _editToggle.textContent = hidden ? 'Edit text' : 'Hide';
        _stanzasEl.classList.toggle('hidden', !hidden);
        if (!hidden) _syncRawTextarea(state);
    });

    // Return focus to page after any select/checkbox change so Space key works for playback
    document
        .querySelectorAll('#editorTab select, #editorTab input[type=checkbox]')
        .forEach((el) => {
            el.addEventListener('change', () => el.blur());
        });
}

function _showStanzas() {
    _textArea.classList.add('hidden');
    _stanzasEl.classList.remove('hidden');
    _editToggle.classList.remove('hidden');
    _editToggle.textContent = 'Edit text';
}

// Swap between Build (empty state) and Re-Build (has content).
function _syncBuildButtons(state) {
    const hasContent = state.stanzas.length > 0;
    _buildBtn.classList.toggle('hidden', hasContent);
    _rebuildBtn.classList.toggle('hidden', !hasContent);
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

    return lines
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n');
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
    return phrases.map((phrase) => {
        const sylTokens = phrase.filter((t) => t.role !== 'flex' && t.role !== 'mediant');
        const syllables = sylTokens.map((t) => t.syl);
        const phraseWordMap = wordMap
            ? wordMap.slice(sylOffset, sylOffset + syllables.length)
            : null;
        sylOffset += syllables.length;

        const notes = phrase
            .map((t) => t.note)
            .filter(Boolean)
            .join(' ');
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
        const ast = pointVerse(
            rawLine,
            tone,
            _cadenceKey,
            _isSolemn,
            plugin.syllabifier,
            isFirstVerse
        );
        const cleanLine = rawLine.replace(/[†*]/g, ' ').replace(/\s+/g, ' ').trim();
        const langTokens = plugin.syllabifier.syllabify(cleanLine);
        const wordMap = langTokens.map((t) => t.wordIdx);
        const markedLine = _buildMarkedLine(ast, wordMap);
        const lines = _splitAstToLines(ast, wordMap);
        // ast, wordMap, and tone snapshot stored at stanza level for HTML formatter and role re-derivation
        return {
            rawLine: markedLine,
            ast,
            wordMap,
            lines,
            toneKey: _toneKey,
            cadenceKey: _cadenceKey,
            isSolemn: _isSolemn,
        };
    } catch (_e) {
        const cleanLine = rawLine.replace(/[†*]/g, ' ').replace(/\s+/g, ' ').trim();
        const tokens = plugin.syllabifier.syllabify(cleanLine);
        return {
            rawLine,
            ast: null,
            wordMap: tokens.map((t) => t.wordIdx),
            lines: [
                {
                    syllables: tokens.map((t) => t.syl),
                    wordMap: tokens.map((t) => t.wordIdx),
                    notes: '',
                    parsedNotes: [],
                },
            ],
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
    const verses = _groupVerses(
        rawText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
    );

    state.stanzas = verses.map((rawLine, vi) => {
        const existing = state.stanzas[vi];
        if (existing?.rawLine === rawLine && existing?.lines[0]?.notes) {
            return existing;
        }
        return _buildStanza(rawLine, tone, plugin, vi === 0 || _repeatIntonation);
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
        const newStanza = _buildStanza(stanza.rawLine, tone, plugin, si === 0 || _repeatIntonation);
        stanza.lines = newStanza.lines;
        stanza.rawLine = newStanza.rawLine;
        stanza.ast = newStanza.ast;
        stanza.wordMap = newStanza.wordMap;
        stanza.toneKey = newStanza.toneKey;
        stanza.cadenceKey = newStanza.cadenceKey;
        stanza.isSolemn = newStanza.isSolemn;
    });

    state.clef = tone.clef;
    _syncRawTextarea(state);
}

/**
 * Writes the marked verse texts back into the raw textarea.
 */
function _syncRawTextarea(state) {
    _rawText.value = state.stanzas
        .map((s) => s.rawLine ?? '')
        .filter(Boolean)
        .join('\n');
}

// ─── Dynamic verse rows ───────────────────────────────────────────────────────

/**
 * Returns the cadence array for the given phrase (detected from its trailing barline token).
 * Uses the stanza-level tone snapshot so that role re-derivation is stable even if the
 * user subsequently changes the tone selector.
 */
function _phraseCadence(phraseTokens, tone, cadenceKey, isSolemn) {
    const last = phraseTokens[phraseTokens.length - 1];
    if (last?.role === 'flex') return tone.flex;
    if (last?.role === 'mediant') return (isSolemn ? tone.solemn : tone.mediant)?.cadence ?? null;
    return tone.terminations?.[cadenceKey] ?? tone.termination ?? null;
}

/**
 * Patches note values and re-derives roles for stanza.ast phrase li from parsedNotes.
 * Roles are identified by matching note values to cadence slots whose note differs from
 * the tenor note (unambiguous). Intonation tokens are preserved. All other tokens default
 * to tenor. This keeps the HTML breviary formatting in sync when the user moves accent
 * notes to different syllables.
 */
function _syncAstFromLine(stanza, li, parsedNotes) {
    if (!stanza.ast) return;

    const phrases = [];
    let current = [];
    for (const token of stanza.ast) {
        current.push(token);
        if (token.role === 'flex' || token.role === 'mediant') {
            phrases.push(current);
            current = [];
        }
    }
    if (current.length) phrases.push(current);

    const phrase = phrases[li];
    if (!phrase) return;

    const astSylTokens = phrase.filter((t) => t.role !== 'flex' && t.role !== 'mediant');
    const noteStrings = parsedNotes.filter((n) => !BARLINES.has(n));
    const len = Math.min(astSylTokens.length, noteStrings.length);

    for (let i = 0; i < len; i++) astSylTokens[i].note = noteStrings[i];

    const tone = TONES[stanza.toneKey ?? _toneKey];
    const cadence = _phraseCadence(
        phrase,
        tone,
        stanza.cadenceKey ?? _cadenceKey,
        stanza.isSolemn ?? _isSolemn
    );
    if (!cadence) return;

    const freshRoles = deriveRolesFromNotes(noteStrings.slice(0, len), cadence);
    for (let i = 0; i < len; i++) {
        if (astSylTokens[i].role === 'intonation') continue;
        astSylTokens[i].role = freshRoles[i];
    }
}

function _handleLineUpdate({ si, li, notes, parsedNotes }) {
    const stanza = _state.stanzas[si];
    const target = stanza?.lines[li];
    if (!target) return null;
    target.notes = notes;
    target.parsedNotes = parsedNotes;
    _syncAstFromLine(stanza, li, parsedNotes);
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
        label.textContent = `Verse ${si + 1}`;
        stanzaEl.appendChild(label);

        stanza.lines.forEach((line, li) => {
            const row = createMelodyInputRow(line, si, li, { onUpdate: _handleLineUpdate });
            stanzaEl.appendChild(row);
        });
        container.appendChild(stanzaEl);
    });
}

// ─── Persistence API ──────────────────────────────────────────────────────────

/**
 * Builds the save envelope for the current psalm editor state.
 * Uses the same JSON-wrapping-GABC format as the transcriber.
 *
 * @param {object} state
 * @returns {object}
 */
export function buildSaveData(state) {
    return {
        v: 1,
        gabc: compileGabc(state),
        language: state.language,
        largeInitial: state.largeInitial,
        toneKey: _toneKey,
        cadenceKey: _cadenceKey,
        isSolemn: _isSolemn,
        repeatIntonation: _repeatIntonation,
    };
}

/**
 * Reconstructs the raw verse text (with †/* markers) from a parsed GABC stanza.
 * Scans the parsedNotes stream: barline ',' → flex †, ':' or ';' → mediant *.
 * Syllables are joined into words using wordMap, phrases separated by markers.
 *
 * @param {{ lines: Array<{syllables: string[], parsedNotes: string[], wordMap: number[]}> }} parsedStanza
 * @returns {string}
 */
function _reconstructRawLine(parsedStanza) {
    return parsedStanza.lines
        .map((line) => {
            const { syllables, parsedNotes, wordMap } = line;

            // Join syllables into words using wordMap.
            const words = [];
            let curWordIdx = -1;
            syllables.forEach((syl, i) => {
                const wIdx = wordMap?.[i] ?? i;
                if (wIdx !== curWordIdx) {
                    words.push(syl);
                    curWordIdx = wIdx;
                } else {
                    words[words.length - 1] += syl;
                }
            });

            const text = words.join(' ');

            // Find the terminal barline token to determine which marker follows this phrase.
            const lastBarline = [...parsedNotes]
                .reverse()
                .find((t) => t === ',' || t === ':' || t === ';' || t === '::');
            const marker =
                lastBarline === ',' ? '†' : lastBarline === ':' || lastBarline === ';' ? '*' : '';

            return text + marker;
        })
        .join(' ');
}

/**
 * Full reimport from a save envelope: parses GABC, restores tone controls,
 * reconstructs raw verse text, re-points, applies saved notes, re-derives roles.
 *
 * @param {object} state
 * @param {object} data   — save envelope from buildSaveData / getSave
 */
export function restoreFromSave(state, data) {
    // 1. Apply tone metadata to module vars and DOM controls.
    _toneKey = data.toneKey ?? _toneKey;
    _isSolemn = data.isSolemn ?? false;
    _repeatIntonation = data.repeatIntonation ?? false;
    _toneSelect.value = _toneKey;
    _populateTermSelect();
    _cadenceKey = data.cadenceKey ?? _cadenceKey;
    _termSelect.value = _cadenceKey;
    _solemnChk.checked = _isSolemn;
    _repeatIntonChk.checked = _repeatIntonation;

    // 2. Parse GABC → extract per-stanza syllables, notes, and word structure.
    const parsed = parseGabc(data.gabc ?? '');
    state.language = data.language ?? state.language;
    state.largeInitial = data.largeInitial ?? state.largeInitial;
    state.clef = parsed.clef;
    _langSel.value = state.language;
    _largeInitChk.checked = state.largeInitial;

    // 3. Reconstruct raw verse text (with †/* markers) from the parsed GABC stanzas.
    const rawLines = parsed.stanzas.map((s) => _reconstructRawLine(s));

    // 4. Re-point all verses using the restored tone.
    _parseAndPoint(rawLines.join('\n'), state);

    // 5. Override auto-pointed notes with the saved note values and re-derive roles.
    parsed.stanzas.forEach((parsedStanza, si) => {
        const stanza = state.stanzas[si];
        if (!stanza) return;
        stanza.lines.forEach((line, li) => {
            const srcLine = parsedStanza.lines[li];
            if (!srcLine) return;
            line.notes = srcLine.notes;
            line.parsedNotes = srcLine.parsedNotes;
            _syncAstFromLine(stanza, li, line.parsedNotes);
        });
    });

    _renderStanzas(state);
    _showStanzas();
    _syncBuildButtons(state);
    triggerCompile(state);
}
