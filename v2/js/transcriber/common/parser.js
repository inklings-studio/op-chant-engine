/**
 * Parses raw hymn text into state.stanzas and state.coda.
 * Language-agnostic: delegates syllabification to the LanguagePlugin.
 *
 * @param {string} rawText
 * @param {object} state        - live state object from state.js (mutated in place)
 * @param {import('./language.js').LanguagePlugin} plugin
 */
export function parseText(rawText, state, plugin) {
  // Snapshot existing notes by [stanzaIdx][lineIdx] so they survive a rebuild.
  const existingNotes = state.stanzas.map(s => s.lines.map(l => l.notes));

  const rawStanzas = rawText
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);

  const newStanzas = [];
  let codaLine = null;

  for (let si = 0; si < rawStanzas.length; si++) {
    const rawLines = rawStanzas[si]
      .split(/\n/)
      .map(l => l.trim())
      .filter(Boolean);

    // Check last line of last stanza for a coda word.
    const isLastStanza = si === rawStanzas.length - 1;
    let linesToProcess = rawLines;

    if (isLastStanza && plugin.codaPattern && rawLines.length > 0) {
      const lastLine = rawLines[rawLines.length - 1];
      const words = lastLine.trim().split(/\s+/);
      const lastWord = words[words.length - 1];
      if (plugin.codaPattern.test(lastWord)) {
        const codaText = rawLines.pop();   // remove coda line from stanza
        codaLine = codaText;
      }
      linesToProcess = rawLines;
    }

    const lines = linesToProcess.map((lineText, li) => {
      const tokens = plugin.syllabifyPhrase(lineText);
      const syllables = tokens.map(t => t.syl);
      const preserved = existingNotes[si]?.[li] ?? '';
      const notes = preserved;
      return {
        syllables,
        notes,
        parsedNotes: tokenizeLine(notes),
      };
    });

    if (lines.length > 0) {
      newStanzas.push({ lines });
    }
  }

  state.stanzas = newStanzas;

  if (codaLine) {
    const tokens = plugin.syllabifyPhrase(codaLine);
    const existingCodaNotes = state.coda?.notes ?? '';
    state.coda = {
      syllables: tokens.map(t => t.syl),
      notes: existingCodaNotes,
      parsedNotes: tokenizeLine(existingCodaNotes),
    };
  } else {
    state.coda = null;
  }
}

/** @param {string} notesStr @returns {string[]} */
function tokenizeLine(notesStr) {
  return notesStr.trim().split(/\s+/).filter(Boolean);
}
