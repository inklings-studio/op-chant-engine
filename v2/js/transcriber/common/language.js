/**
 * @typedef {Object} SyllableToken
 * @property {string} syl      - The syllable text
 * @property {number} wordIdx  - Index of the source word in the phrase
 * @property {number} sylIdx   - Index of this syllable within that word
 */

/**
 * @typedef {Object} LanguagePlugin
 * @property {string}  code          - ISO 639-1 code: 'sk', 'cs', 'en', 'fr'
 * @property {string}  label         - Display name: 'Slovak', 'Czech', etc.
 * @property {RegExp}  [codaPattern] - Regex to detect a coda word (e.g. /^amen$/i)
 * @property {(word: string) => string[]} syllabifyWord
 *   Syllabify a single word (no spaces, no punctuation). Returns syllable strings.
 * @property {(phrase: string) => SyllableToken[]} syllabifyPhrase
 *   Tokenize a full text phrase into syllable tokens with position metadata.
 */

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
