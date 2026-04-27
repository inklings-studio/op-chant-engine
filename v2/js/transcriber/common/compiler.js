const BARLINES = new Set([',', ';', ':', '::']);

/**
 * Tokenizes a melody input string into note/barline tokens.
 * @param {string} str
 * @returns {string[]}
 */
export function tokenizeMelody(str) {
  return str.trim().split(/\s+/).filter(Boolean);
}

/**
 * Resolves the effective note tokens for a line, applying strophic inheritance.
 * @param {object} state
 * @param {number} si  - stanza index
 * @param {number} li  - line index
 * @returns {string[]}
 */
function resolveNotes(state, si, li) {
  const line = state.stanzas[si]?.lines[li];
  if (!line) return [];
  if (line.notes.trim()) return line.parsedNotes;
  if (state.strophicInheritance && si > 0) {
    return state.stanzas[0]?.lines[li]?.parsedNotes ?? [];
  }
  return [];
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
      const notes     = resolveNotes(state, si, li);
      const syllables = line.syllables ?? [];
      const lineBuf   = [];
      let sylIdx      = 0;

      // Emit clef before very first note token
      if (!clefEmitted && notes.length) {
        lineBuf.push(`(${state.clef})`);
        clefEmitted = true;
      }

      for (const token of notes) {
        if (BARLINES.has(token)) {
          lineBuf.push(`(${token})`);
        } else {
          const syl = sylIdx < syllables.length ? syllables[sylIdx++] : '-';
          lineBuf.push(`${syl}(${token})`);
        }
      }

      if (lineBuf.length) lineParts.push(lineBuf.join(' '));
    });

    if (lineParts.length) {
      parts.push(lineParts.join('\n'));
    }
  });

  // Stanza separator: double barline between stanzas
  let gabc = parts.join('\n(::\n)\n');

  // Coda
  if (state.coda) {
    const codaNotes = state.coda.parsedNotes ?? [];
    const codaSyls  = state.coda.syllables  ?? [];
    if (codaNotes.length) {
      const codaBuf = [];
      let sylIdx = 0;
      for (const token of codaNotes) {
        if (BARLINES.has(token)) {
          codaBuf.push(`(${token})`);
        } else {
          const syl = sylIdx < codaSyls.length ? codaSyls[sylIdx++] : '-';
          codaBuf.push(`${syl}(${token})`);
        }
      }
      gabc += '\n' + codaBuf.join(' ');
    }
  }

  return gabc;
}
