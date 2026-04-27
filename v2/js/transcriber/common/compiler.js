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

  // Stanza 1 gets a number when stanzaNumbers is on AND largeInitial is off
  // (large initial already visually identifies the first stanza).
  const numberFromStanza = state.stanzaNumbers
    ? (state.largeInitial ? 1 : 0)
    : Infinity;

  state.stanzas.forEach((stanza, si) => {
    const lineParts = [];

    stanza.lines.forEach((line, li) => {
      const isFirstLine = li === 0;
      const isLastLine  = li === stanza.lines.length - 1;
      const { notes, wordMap } = resolveNotes(state, si, li);
      const syllables = line.syllables ?? [];

      let lineStr = '';

      if (!clefEmitted && notes.length) {
        lineStr     = `(${state.clef}) `;
        clefEmitted = true;
      }

      // Prepend stanza number on the first line of qualifying stanzas
      if (isFirstLine && si >= numberFromStanza) {
        lineStr += `^${si + 1}.^() `;
      }

      lineStr += buildLine(notes, syllables, wordMap);
      lineStr  = lineStr.trimEnd();

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
    const codaNotes   = state.coda.parsedNotes ?? [];
    const codaSyls    = state.coda.syllables   ?? [];
    const codaWordMap = state.coda.wordMap     ?? null;
    if (codaNotes.length) {
      parts.push(buildLine(codaNotes, codaSyls, codaWordMap) + ' ' + DOUBLE_BAR);
    }
  }

  const initialStyle = state.largeInitial ? 1 : 0;
  let header = `initial-style: ${initialStyle};\n`;
  if (state.annotation?.trim()) {
    header += `annotation: ${state.annotation.trim()};\n`;
  }
  header += '%%';
  return header + '\n' + parts.join('\n\n');
}
