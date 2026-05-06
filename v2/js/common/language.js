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
