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
  return verseAst.map(t => `${t.syl.trim()}(${t.note})`).join(' ');
}

/**
 * Convert a verse AST to a breviary-style HTML string for verses 2+.
 * Intonation tokens are skipped (not sung on repeating verses).
 * flex → †, mediant → *, acc → wrapped in accBegin/End, prep → wrapped in prepBegin/End.
 * Syllables of the same word are joined without space; different words get a space.
 * wordMap[sylIdx] provides the word-index for each non-barline syllable.
 *
 * @param {Array<{syl:string, note:string, role:string}>} verseAst
 * @param {number[]} [wordMap]
 * @param {{ prepBegin?:string, prepEnd?:string, accBegin?:string, accEnd?:string }} [wrappers]
 * @returns {string}
 */
export function generateBreviaryHtml(verseAst, wordMap, wrappers = {}) {
  const pb = wrappers.prepBegin ?? '<i>';
  const pe = wrappers.prepEnd   ?? '</i>';
  const ab = wrappers.accBegin  ?? '<b>';
  const ae = wrappers.accEnd    ?? '</b>';

  let result = '';
  let sylIdx = 0;
  let prevWordIdx = null;

  for (const t of verseAst) {
    if (t.role === 'flex') {
      result += ' <span class="verse-mark">†</span>';
      prevWordIdx = null;
      continue;
    }
    if (t.role === 'mediant') {
      result += ' <span class="verse-mark">*</span>';
      prevWordIdx = null;
      continue;
    }
    if (t.role === 'intonation') {
      sylIdx++;
      continue;
    }

    const wIdx = wordMap?.[sylIdx] ?? sylIdx;
    const sameWord = prevWordIdx !== null && wIdx === prevWordIdx;
    if (!sameWord && result !== '') result += ' ';

    if (t.role === 'acc')       result += `${ab}${t.syl}${ae}`;
    else if (t.role === 'prep') result += `${pb}${t.syl}${pe}`;
    else                        result += t.syl;

    prevWordIdx = wIdx;
    sylIdx++;
  }

  return result;
}

/**
 * Compile breviary HTML for verses 2+ from state.stanzas.
 * Each stanza line must have an `ast` and `wordMap` (stored by editor._pointLine).
 * Returns an HTML string of <p class="verse-line"> elements with verse numbers.
 * @param {object} state
 * @param {{ prepBegin?:string, prepEnd?:string, accBegin?:string, accEnd?:string }} [wrappers]
 * @returns {string}
 */
export function compileBreviaryHtml(state, wrappers = {}) {
  return state.stanzas
    .slice(1)
    .map((stanza, idx) => {
      const line    = stanza.lines[0];
      const ast     = line?.ast;
      const wordMap = line?.wordMap;
      if (!ast) return '';
      const verseNum = idx + 2;
      const html = generateBreviaryHtml(ast, wordMap, wrappers);
      return `<p class="verse-line" data-verse="${verseNum}"><span class="verse-num">${verseNum}.</span><span class="verse-text">${html}</span></p>`;
    })
    .filter(Boolean)
    .join('\n');
}
