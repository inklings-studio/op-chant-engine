const CLEF_RE    = /^[cf]b?[1-4]$/;
const BARLINE_RE = /^[:;,]+$/;
const TOKEN_RE   = /([^(\s]+)?\(([^)]*)\)/g;

/**
 * Parses an integrated GABC string back into a structured model.
 * Used by the dirty-flag sync when Tab 2 is manually edited.
 *
 * @param {string} gabc
 * @returns {{ clef: string, stanzas: Array<{lines: Array<{syllables: string[], notes: string}>}>, coda: {syllables: string[], notes: string}|null }}
 */
export function parseGabc(gabc) {
  let clef = 'c4';

  // Strip GABC header block (lines before %%)
  const headerSep = gabc.indexOf('%%');
  const body = headerSep !== -1 ? gabc.slice(headerSep + 2) : gabc;

  // Split on stanza boundaries (double barline tokens) first.
  // The compiler emits (\n::\n) between stanzas, so we split on that pattern.
  const stanzaBlocks = body.split(/\s*\(::\)\s*|\(::\s*\)/);

  // Separate the last block as potential coda if it was emitted after the last stanza sep.
  // (Coda is simply treated as the last stanza block for now — no structural distinction on parse.)
  const stanzas = [];
  let coda = null;

  stanzaBlocks.forEach((block, blockIdx) => {
    if (!block.trim()) return;

    // Split block into lines on newline boundaries.
    const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean);

    const lines = rawLines.map(rawLine => {
      const syllables = [];
      const noteParts = [];
      TOKEN_RE.lastIndex = 0;

      let match;
      while ((match = TOKEN_RE.exec(rawLine)) !== null) {
        const sylText  = match[1] ?? '';
        const noteText = match[2] ?? '';

        if (CLEF_RE.test(noteText)) {
          clef = noteText;
          continue;
        }

        if (BARLINE_RE.test(noteText) || noteText === '::') {
          noteParts.push(noteText === '::' ? '::' : noteText);
          continue;
        }

        if (sylText && sylText !== '-') {
          syllables.push(sylText);
        }
        noteParts.push(noteText);
      }

      return {
        syllables,
        notes: noteParts.join(' '),
        parsedNotes: noteParts,
      };
    }).filter(l => l.syllables.length || l.parsedNotes.length);

    if (!lines.length) return;

    // Heuristic: last stanza block with only 1–2 short lines may be coda.
    // We keep it simple: if it was the last block AND all syllables match
    // a coda pattern (amen-like), treat as coda; otherwise treat as stanza.
    // For now we always treat it as a regular stanza — the editor re-detects
    // the coda on the next Build. The dirty sync only needs note values.
    stanzas.push({ lines });
  });

  return { clef, stanzas, coda };
}
