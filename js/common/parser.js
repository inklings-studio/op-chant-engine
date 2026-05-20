/**
 * Parses raw hymn text into state.stanzas and state.coda.
 * Language-agnostic: delegates syllabification to the LanguagePlugin.
 *
 * @param {string} rawText
 * @param {object} state        - live state object from state.js (mutated in place)
 * @param {import('./language.js').LanguagePlugin} plugin
 */
import { tokenizeMelody } from './melody.js';

export function parseText(rawText, state, plugin) {
    // Snapshot existing notes by [stanzaIdx][lineIdx] so they survive a rebuild.
    const existingNotes = state.stanzas.map((s) => s.lines.map((l) => l.notes));

    const rawStanzas = rawText
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);

    const newStanzas = [];
    let codaLine = null;

    for (let si = 0; si < rawStanzas.length; si++) {
        const rawLines = rawStanzas[si]
            .split(/\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        // Check last line of last stanza for a coda word.
        const isLastStanza = si === rawStanzas.length - 1;
        let linesToProcess = rawLines;

        if (isLastStanza && plugin.codaPattern && rawLines.length > 0) {
            const lastLine = rawLines[rawLines.length - 1];
            const words = lastLine.trim().split(/\s+/);
            const lastWord = words[words.length - 1];
            if (plugin.codaPattern.test(lastWord.replace(/\|/g, ''))) {
                rawLines.pop();
                codaLine = lastWord;
                if (words.length > 1) {
                    rawLines.push(words.slice(0, -1).join(' '));
                }
            }
            linesToProcess = rawLines;
        }

        const lines = linesToProcess.map((lineText, li) => {
            const tokens = plugin.syllabifier.syllabify(lineText);
            const syllables = tokens.map((t) => t.syl);
            const wordMap = tokens.map((t) => t.wordIdx);
            const preserved = existingNotes[si]?.[li] ?? '';
            const isLastLine = li === linesToProcess.length - 1;
            const barline = isLastLine ? '::' : li % 2 === 0 ? ',' : ':';
            const recto = syllables.map(() => 'f').join(' ') + ' ' + barline;
            const notes = preserved || recto;
            return {
                syllables,
                wordMap,
                notes,
                parsedNotes: tokenizeMelody(notes),
            };
        });

        if (lines.length > 0) {
            newStanzas.push({ lines });
        }
    }

    // Strophic copy: overwrite stanzas 1+ notes with stanza 0 notes.
    if (state.strophicInheritance && newStanzas.length > 1) {
        for (let si = 1; si < newStanzas.length; si++) {
            newStanzas[si].lines.forEach((line, li) => {
                const src = newStanzas[0].lines[li];
                if (src) {
                    line.notes = src.notes;
                    line.parsedNotes = src.parsedNotes;
                }
            });
        }
    }

    state.stanzas = newStanzas;

    if (codaLine) {
        const tokens = plugin.syllabifier.syllabify(codaLine);
        const existingCodaNotes = state.coda?.notes ?? '';
        const codaNotes = existingCodaNotes || 'fgf ef..';
        state.coda = {
            syllables: tokens.map((t) => t.syl),
            wordMap: tokens.map((t) => t.wordIdx),
            notes: codaNotes,
            parsedNotes: tokenizeMelody(codaNotes),
        };
    } else {
        state.coda = null;
    }
}
