/**
 * Pure AST → text converters for psalm tone output.
 * Input: Array<{syl: string, note: string, role: string}> from pointVerse().
 */

/**
 * Convert a verse AST to an integrated GABC body string (no header, no clef).
 * All tokens including intonation are emitted; the controller prepends the clef header.
 * @param {Array<{syl:string, note:string, role:string}>} verseAst
 * @returns {string}
 */
export function generateGabc(verseAst) {
    return verseAst.map((t) => `${t.syl.trim()}(${t.note})`).join(' ');
}

/**
 * Convert a verse AST to a breviary-style HTML string for verses 2+.
 * Intonation tokens are skipped unless repeatIntonation is true.
 * flex → †, mediant → *, acc → wrapped in accBegin/End (flexAccBegin/End in flex phrase),
 * prep → wrapped in prepBegin/End, ep/fin → wrapped in flexBegin/End.
 * Syllables of the same word are joined without space; different words get a space.
 * wordMap[sylIdx] provides the word-index for each non-barline syllable.
 *
 * @param {Array<{syl:string, note:string, role:string}>} verseAst
 * @param {number[]} [wordMap]
 * @param {{ prepBegin?:string, prepEnd?:string, accBegin?:string, accEnd?:string,
 *           flexAccBegin?:string, flexAccEnd?:string, flexBegin?:string, flexEnd?:string }} [wrappers]
 * @param {boolean} [repeatIntonation]
 * @returns {string}
 */
export function generateBreviaryHtml(verseAst, wordMap, wrappers = {}, repeatIntonation = false) {
    const pb = wrappers.prepBegin ?? '<i>';
    const pe = wrappers.prepEnd ?? '</i>';
    const ab = wrappers.accBegin ?? '<b>';
    const ae = wrappers.accEnd ?? '</b>';
    const fab = wrappers.flexAccBegin ?? '';
    const fae = wrappers.flexAccEnd ?? '';
    const fb = wrappers.flexBegin ?? '<i>';
    const fe = wrappers.flexEnd ?? '</i>';

    let result = '';
    let sylIdx = 0;
    let prevWordIdx = null;
    let inFlexPhrase = verseAst.some((t) => t.role === 'flex');

    for (const t of verseAst) {
        if (t.role === 'flex') {
            result += ' <span class="verse-mark">†</span>';
            prevWordIdx = null;
            inFlexPhrase = false;
            continue;
        }
        if (t.role === 'mediant') {
            result += ' <span class="verse-mark">*</span>';
            prevWordIdx = null;
            inFlexPhrase = false;
            continue;
        }
        if (t.role === 'intonation' && !repeatIntonation) {
            sylIdx++;
            continue;
        }

        const wIdx = wordMap?.[sylIdx] ?? sylIdx;
        const sameWord = prevWordIdx !== null && wIdx === prevWordIdx;
        if (!sameWord && result !== '') result += ' ';

        if (t.role === 'acc' && inFlexPhrase) result += `${fab}${t.syl}${fae}`;
        else if (t.role === 'acc') result += `${ab}${t.syl}${ae}`;
        else if (t.role === 'prep') result += `${pb}${t.syl}${pe}`;
        else if ((t.role === 'ep' || t.role === 'fin') && inFlexPhrase)
            result += `${fb}${t.syl}${fe}`;
        else result += t.syl;

        prevWordIdx = wIdx;
        sylIdx++;
    }

    return result;
}

/**
 * Compile breviary HTML for verses 2+ from state.stanzas.
 * Each stanza must have an `ast` and `wordMap` at the stanza level.
 * Returns an HTML string of <p class="verse-line"> elements with verse numbers.
 * @param {object} state
 * @param {{ prepBegin?:string, prepEnd?:string, accBegin?:string, accEnd?:string,
 *           flexAccBegin?:string, flexAccEnd?:string, flexBegin?:string, flexEnd?:string }} [wrappers]
 * @param {boolean} [repeatIntonation]
 * @returns {string}
 */
export function compileBreviaryHtml(state, wrappers = {}, repeatIntonation = false) {
    return state.stanzas
        .slice(1)
        .map((stanza, idx) => {
            const ast = stanza.ast;
            const wordMap = stanza.wordMap;
            if (!ast) return '';
            const verseNum = idx + 2;
            const html = generateBreviaryHtml(ast, wordMap, wrappers, repeatIntonation);
            return `<p class="verse-line" data-verse="${verseNum}"><span class="verse-num">${verseNum}.</span><span class="verse-text">${html}</span></p>`;
        })
        .filter(Boolean)
        .join('\n');
}
