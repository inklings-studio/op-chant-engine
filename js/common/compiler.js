import { BARLINES } from './melody.js';

export { tokenizeMelody } from './melody.js';

/**
 * Compiles only the first stanza into GABC.
 * Used in HTML output mode: verse 1 renders as GABC, verses 2+ render as breviary HTML.
 * @param {object} state
 * @returns {string}
 */
export function compileGabc1(state) {
    if (!state.stanzas.length) return '';
    return compileGabc({ ...state, stanzas: state.stanzas.slice(0, 1) });
}

const DOUBLE_BAR = '(::)';

function resolveNotes(state, si, li) {
    const line = state.stanzas[si]?.lines[li];
    if (!line) return { notes: [], wordMap: null };
    return { notes: line.parsedNotes, wordMap: line.wordMap ?? null };
}

/**
 * Builds a GABC line string from notes, syllables, and word-map.
 * Same-word syllables are concatenated with no separator; different words get a space.
 */
function buildLine(notes, syllables, wordMap) {
    let result = '';
    let sylIdx = 0;
    let prevSep = ''; // separator to prepend before the next token

    for (const token of notes) {
        if (BARLINES.has(token)) {
            if (token === '::') result += prevSep + DOUBLE_BAR;
            else if (token === ':') result += prevSep + '*(:)';
            else if (token === ',') result += prevSep + `(${token})`;
            else result += prevSep + `(${token})`;
            prevSep = ' ';
        } else {
            const syl = sylIdx < syllables.length ? syllables[sylIdx] : '-';
            const curWord = wordMap?.[sylIdx] ?? sylIdx;
            const nextWord = wordMap?.[sylIdx + 1] ?? sylIdx + 1;
            const lastSylOfWord =
                syl === '-' || sylIdx >= syllables.length - 1 || curWord !== nextWord;
            sylIdx++;
            result += prevSep + `${syl}(${token})`;
            prevSep = lastSylOfWord ? ' ' : '';
        }
    }

    return result;
}

/**
 * Compiles state into an integrated GABC string.
 * @param {object} state
 * @returns {string}
 */
export function compileGabc(state) {
    if (!state.stanzas.length && !state.coda) return '';

    const parts = [];
    let clefEmitted = false;

    // Stanza 1 gets a number when stanzaNumbers is on AND largeInitial is off
    // (large initial already visually identifies the first stanza).
    const numberFromStanza = state.stanzaNumbers ? (state.largeInitial ? 1 : 0) : Infinity;

    state.stanzas.forEach((stanza, si) => {
        const lineParts = [];

        stanza.lines.forEach((line, li) => {
            const isFirstLine = li === 0;
            const isLastLine = li === stanza.lines.length - 1;
            const { notes, wordMap } = resolveNotes(state, si, li);
            const syllables = line.syllables ?? [];

            let lineStr = '';

            if (!clefEmitted && notes.length) {
                lineStr = `(${state.clef}) `;
                clefEmitted = true;
            }

            // Prepend stanza number on the first line of qualifying stanzas
            if (isFirstLine && si >= numberFromStanza) {
                lineStr += `${si + 1}.() `;
            }

            lineStr += buildLine(notes, syllables, wordMap);
            lineStr = lineStr.trimEnd();

            if (isLastLine && lineStr && !lineStr.endsWith(DOUBLE_BAR)) {
                lineStr += ' ' + DOUBLE_BAR;
            }

            if (lineStr.trim()) lineParts.push(lineStr);
        });

        if (lineParts.length) {
            parts.push(lineParts.join('\n'));
        }
    });

    if (state.coda) {
        const codaNotes = state.coda.parsedNotes ?? [];
        const codaSyls = state.coda.syllables ?? [];
        const codaWordMap = state.coda.wordMap ?? null;
        if (codaNotes.length) {
            parts.push(buildLine(codaNotes, codaSyls, codaWordMap) + ' ' + DOUBLE_BAR);
        }
    }

    const initialStyle = state.largeInitial ? 1 : 0;
    let header = `initial-style: ${initialStyle};\n`;
    if (state.annotation?.trim()) {
        header += `annotation: ${state.annotation.trim()};\n`;
    }
    if (state.font) header += `%font: ${state.font};\n`;
    if (state.fontSizePt) header += `%fontsize: ${state.fontSizePt};\n`;
    if (state.pageWidthIn) header += `%width: ${state.pageWidthIn};\n`;
    if (state.pageHeightIn) header += `%height: ${state.pageHeightIn};\n`;
    header += '%%';
    return header + '\n' + parts.join('\n\n');
}
