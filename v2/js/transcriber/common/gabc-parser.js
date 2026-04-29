const CLEF_RE    = /^[cf]b?[1-4]$/;

/**
 * Reconstructs plain hymn text from state stanzas and optional coda.
 * Reverses the syllable/wordMap structure back into space-separated words,
 * lines separated by \n, stanzas separated by \n\n.
 *
 * @param {Array} stanzas
 * @param {{ syllables: string[], wordMap: number[] }|null} [coda]
 * @returns {string}
 */
export function reconstructText(stanzas, coda = null) {
  function lineToWords(syllables, wordMap) {
    if (!syllables?.length) return '';
    const wm = wordMap ?? syllables.map((_, i) => i);
    const words = [];
    let curIdx = -1;
    let buf = '';
    wm.forEach((wIdx, sIdx) => {
      if (wIdx !== curIdx) {
        if (buf) words.push(buf);
        buf = syllables[sIdx];
        curIdx = wIdx;
      } else {
        buf += syllables[sIdx];
      }
    });
    if (buf) words.push(buf);
    return words.join(' ');
  }

  const parts = stanzas
    .map(s => s.lines.map(l => lineToWords(l.syllables, l.wordMap)).filter(Boolean).join('\n'))
    .filter(Boolean);

  if (coda?.syllables?.length) {
    const codaWord = lineToWords(coda.syllables, coda.wordMap);
    if (parts.length > 0) {
      parts[parts.length - 1] += '\n' + codaWord;
    } else {
      parts.push(codaWord);
    }
  }

  return parts.join('\n\n');
}
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
      const wordMap   = [];
      TOKEN_RE.lastIndex = 0;

      let match;
      let wordIdx          = 0;
      let prevSylEnd       = -1;
      let barlineSinceLast = false;

      while ((match = TOKEN_RE.exec(rawLine)) !== null) {
        const sylText  = match[1] ?? '';
        const noteText = match[2] ?? '';

        if (CLEF_RE.test(noteText)) {
          clef = noteText;
          continue;
        }

        if (BARLINE_RE.test(noteText) || noteText === '::') {
          noteParts.push(noteText === '::' ? '::' : noteText);
          barlineSinceLast = true;
          continue;
        }

        // Skip stanza-number tokens emitted by the compiler (e.g. "2.()")
        // — empty note with a digit-dot syllable is never real content.
        if (noteText === '' && /^\d+\.$/.test(sylText)) {
          continue;
        }

        // Word boundary: gap since the last syllable token, or a barline between.
        // Adjacent tokens (match.index === prevSylEnd) stay in the same word.
        if (prevSylEnd !== -1 && (barlineSinceLast || match.index > prevSylEnd)) {
          wordIdx++;
        }
        barlineSinceLast = false;
        prevSylEnd = match.index + match[0].length;

        wordMap.push(wordIdx);
        if (sylText && sylText !== '-') {
          syllables.push(sylText);
        }
        noteParts.push(noteText);
      }

      return {
        syllables,
        notes: noteParts.join(' '),
        parsedNotes: noteParts,
        wordMap,
      };
    }).filter(l => l.syllables.length || l.parsedNotes.length);

    if (!lines.length) return;

    // Restore the (::) double barline consumed by the stanza split.
    // The compiler always appends (::) on compile, but the editor melody inputs
    // should show it so the user can see and edit the terminating barline.
    const lastLine = lines[lines.length - 1];
    if (lastLine && !lastLine.parsedNotes.includes('::')) {
      lastLine.parsedNotes.push('::');
      lastLine.notes = lastLine.parsedNotes.join(' ');
    }

    // Heuristic: last stanza block with only 1–2 short lines may be coda.
    // We keep it simple: if it was the last block AND all syllables match
    // a coda pattern (amen-like), treat as coda; otherwise treat as stanza.
    // For now we always treat it as a regular stanza — the editor re-detects
    // the coda on the next Build. The dirty sync only needs note values.
    stanzas.push({ lines });
  });

  return { clef, stanzas, coda };
}
