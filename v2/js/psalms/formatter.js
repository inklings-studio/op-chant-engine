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
 * Intonation tokens are filtered out (repeating verses begin on the tenor).
 * acc → <b>, prep → <i>, all other roles → plain text.
 * Syllables are space-joined to make stress positions visible to the cantor.
 * @param {Array<{syl:string, note:string, role:string}>} verseAst
 * @returns {string}
 */
export function generateBreviaryHtml(verseAst) {
  return verseAst
    .filter(t => t.role !== 'intonation')
    .map(t => {
      if (t.role === 'acc')  return `<b>${t.syl}</b>`;
      if (t.role === 'prep') return `<i>${t.syl}</i>`;
      return t.syl;
    })
    .join(' ');
}
