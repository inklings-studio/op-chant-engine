const BARLINES      = new Set([',', ';', ':', '::']);
const DOUBLE_BAR    = '(::)';

/**
 * Tokenizes a melody input string into note/barline tokens.
 * @param {string} str
 * @returns {string[]}
 */
export function tokenizeMelody(str) {
  return str.trim().split(/\s+/).filter(Boolean);
}

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
  let result  = '';
  let sylIdx  = 0;
  let prevSep = '';   // separator to prepend before the next token

  for (const token of notes) {
    if (BARLINES.has(token)) {
      result  += prevSep + (token === '::' ? DOUBLE_BAR : `(${token})`);
      prevSep  = ' ';
    } else {
      const syl      = sylIdx < syllables.length ? syllables[sylIdx] : '-';
      const curWord  = wordMap?.[sylIdx]  ?? sylIdx;
      const nextWord = wordMap?.[sylIdx + 1] ?? sylIdx + 1;
      const lastSylOfWord = (syl === '-') || (sylIdx >= syllables.length - 1) || (curWord !== nextWord);
      sylIdx++;
      result  += prevSep + `${syl}(${token})`;
      prevSep  = lastSylOfWord ? ' ' : '';
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

  state.stanzas.forEach((stanza, si) => {
    const lineParts = [];

    stanza.lines.forEach((line, li) => {
      const isLastLine = li === stanza.lines.length - 1;
      const { notes, wordMap } = resolveNotes(state, si, li);
      const syllables = line.syllables ?? [];

      let lineStr = '';

      // Emit clef before very first note token
      if (!clefEmitted && notes.length) {
        lineStr     = `(${state.clef}) `;
        clefEmitted = true;
      }

      lineStr += buildLine(notes, syllables, wordMap);
      lineStr  = lineStr.trimEnd();

      // Guarantee every stanza's last line ends with (::) regardless of note content
      if (isLastLine && lineStr && !lineStr.endsWith(DOUBLE_BAR)) {
        lineStr += ' ' + DOUBLE_BAR;
      }

      if (lineStr.trim()) lineParts.push(lineStr);
    });

    if (lineParts.length) {
      parts.push(lineParts.join('\n'));
    }
  });

  // Coda block — appended as a peer of stanza blocks.
  // (::) separators between blocks come from the :: barline token at the end of each block's last line.
  if (state.coda) {
    const codaNotes   = state.coda.parsedNotes ?? [];
    const codaSyls    = state.coda.syllables   ?? [];
    const codaWordMap = state.coda.wordMap     ?? null;
    if (codaNotes.length) {
      parts.push(buildLine(codaNotes, codaSyls, codaWordMap) + ' ' + DOUBLE_BAR);
    }
  }

  const initialStyle = state.largeInitial ? 1 : 0;
  const header = `initial-style: ${initialStyle};\n%%`;
  return header + '\n' + parts.join('\n');
}
