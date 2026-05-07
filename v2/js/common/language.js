/**
 * @typedef {Object} SyllableToken
 * @property {string} syl      - The syllable text
 * @property {number} wordIdx  - Index of the source word in the phrase
 * @property {number} sylIdx   - Index of this syllable within that word
 * @property {boolean} isStressed
 */

/**
 * @typedef {Object} LanguagePlugin
 * @property {string}  code          - ISO 639-1 code: 'sk', 'cs', 'en', 'fr'
 * @property {string}  label         - Display name: 'Slovak', 'Czech', etc.
 * @property {RegExp}  [codaPattern] - Regex to detect a coda word (e.g. /^amen$/i)
 * @property {Array<{num: number, label: string}>} [psalms]
 *   Ordered list of available psalm texts for this language.
 *   `num` is the psalm number (used to construct the file path);
 *   `label` is the display string shown in the selector and written to the annotation field.
 * @property {(word: string) => string[]} syllabifyWord
 *   Syllabify a single word (no spaces, no punctuation). Returns syllable strings.
 * @property {(phrase: string) => SyllableToken[]} syllabifyPhrase
 *   Tokenize a full text phrase — already run through {@link preprocessPhrase} — into
 *   syllable tokens with position metadata.
 *   Language plugins must honour {@link PIPE_SEP} (in-word split, same wordIdx) and
 *   {@link TIE_SEP} (join into one chip / one melody note).
 */

/**
 * Private-use character marking an in-word syllable split (from |).
 * Syllables separated by this share the same wordIdx → no GABC space between them.
 */
export const PIPE_SEP = '';

/**
 * Private-use character marking a semantic tie (from _).
 * All text fragments joined by this become ONE syllable token / ONE melody note.
 * Surrounding whitespace is consumed with the _ during preprocessing.
 */
export const TIE_SEP = '';

/**
 * Preprocess a raw phrase to normalise the two language-agnostic control characters
 * before handing the phrase to a language plugin:
 *
 *   _  — semantic tie: joins adjacent syllables into ONE token (one melody note).
 *         Surrounding whitespace is collapsed, so "a _ po" → "apo".
 *   |  — in-word split: forces a syllable break while keeping the same GABC word.
 *         Replaced with {@link PIPE_SEP}.
 *
 * @param {string} phrase
 * @returns {string}
 */
export function preprocessPhrase(phrase) {
  return phrase
    .replace(/\s*_\s*/g, TIE_SEP)
    .replace(/\|/g, PIPE_SEP);
}

const _registry = new Map();

/** @param {LanguagePlugin} plugin */
export function registerLanguage(plugin) {
  _registry.set(plugin.code, plugin);
}

/**
 * @param {string} code
 * @returns {LanguagePlugin|undefined}
 */
export function getLanguage(code) {
  return _registry.get(code);
}

/** @returns {LanguagePlugin[]} All registered languages, sorted by label */
export function listLanguages() {
  return [..._registry.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Creates a `syllabifyPhrase` function tailored to a specific language.
 * This factory encapsulates all the generic, language-agnostic logic for parsing a line of text,
 * handling special characters, punctuation, and stress patterns.
 *
 * @param {object} langConfig - Language-specific implementation details.
 * @param {function(string): string[]} langConfig.syllabifyWord - Function to syllabify a single clean word.
 * @param {function(string): boolean} langConfig.hasNucleus - Function to check if a word has a vowel/syllabic nucleus.
 * @param {Set<string>} langConfig.unstressedMonosyllables - A set of lowercase monosyllabic words that don't receive stress.
 *
 * @returns {function(string): SyllableToken[]} A complete `syllabifyPhrase` function.
 */
export function createPhraseSyllabifier(langConfig) {
  const { syllabifyWord, hasNucleus, unstressedMonosyllables } = langConfig;

  return function syllabifyPhrase(phrase) {
    const tokens = [];
    phrase = preprocessPhrase(phrase);

    const words = phrase.trim().split(/\s+/).filter(Boolean);
    let pendingPrefix = '';
    let wordIdxCounter = 0;

    for (let wi = 0; wi < words.length; wi++) {
      const raw = words[wi];

      // ── TIE (_): all syllables from every tied fragment collapse into ONE token ──
      if (raw.includes(TIE_SEP)) {
        const parts = raw.split(TIE_SEP).filter(Boolean);
        const allSyls = [];
        for (const part of parts) {
          const lp = part.match(/^[^\p{L}]*/u)?.[0] ?? '';
          const tp = part.match(/[^\p{L}]*$/u)?.[0] ?? '';
          const clean = part.slice(lp.length, part.length - tp.length);
          const syls = clean ? syllabifyWord(clean) : [];
          if (syls.length) {
            syls[0] = lp + syls[0];
            syls[syls.length - 1] += tp;
          } else {
            allSyls.push(lp + tp);
            continue;
          }
          allSyls.push(...syls);
        }
        const combinedSyl = (pendingPrefix + allSyls.join(' ')).trim();
        pendingPrefix = '';
        tokens.push({ syl: combinedSyl, wordIdx: wordIdxCounter++, sylIdx: 0, isStressed: true });
        continue;
      }

      // ── PIPE (|): explicit in-word split — parts share the same wordIdx ──
      if (raw.includes(PIPE_SEP)) {
        const parts = raw.split(PIPE_SEP).filter(Boolean);
        const wIdx = wordIdxCounter++;
        for (let pi = 0; pi < parts.length; pi++) {
          let syl = parts[pi];
          if (pi === 0 && pendingPrefix) { syl = pendingPrefix + syl; pendingPrefix = ''; }
          const isStressed = pi === 0 || (parts.length >= 4 && pi % 2 === 0);
          tokens.push({ syl, wordIdx: wIdx, sylIdx: pi, isStressed });
        }
        pendingPrefix = '';
        continue;
      }

      // ── Standard word ──
      const leadPunct = raw.match(/^[^\p{L}]*/u)?.[0] ?? '';
      const trailPunct = raw.match(/[^\p{L}]*$/u)?.[0] ?? '';
      let clean = raw.slice(leadPunct.length, raw.length - trailPunct.length); // FIXED BUG

      // Consonant-only word before another word → defer as prefix onto next syllable.
      if (clean && !hasNucleus(clean) && wi < words.length - 1) {
        pendingPrefix += leadPunct + clean + trailPunct + ' ';
        continue;
      }

      const syls = syllabifyWord(clean);
      const wIdx = wordIdxCounter++;
      for (let sylIdx = 0; sylIdx < syls.length; sylIdx++) {
        let syl = syls[sylIdx];
        if (sylIdx === 0) syl = pendingPrefix + leadPunct + syl;
        if (sylIdx === syls.length - 1) syl = syl + trailPunct;
        const defaultStressed = sylIdx === 0 || (syls.length >= 4 && sylIdx % 2 === 0);
        const isStressed = syls.length === 1
          ? !unstressedMonosyllables.has(clean.toLowerCase())
          : defaultStressed;
        tokens.push({ syl, wordIdx: wIdx, sylIdx, isStressed });
      }
      pendingPrefix = '';
    }

    // Leftover consonant-only word at end of phrase — emit as-is.
    if (pendingPrefix) {
      tokens.push({ syl: pendingPrefix.trim(), wordIdx: wordIdxCounter, sylIdx: 0, isStressed: true });
    }

    return tokens;
  }
}