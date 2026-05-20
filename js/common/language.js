/**
 * @typedef {Object} SyllableToken
 * @property {string} syl      - The syllable text
 * @property {number} wordIdx  - Index of the source word in the phrase
 * @property {number} sylIdx   - Index of this syllable within that word
 * @property {boolean} isStressed
 */

/**
 * @typedef {Object} WordResult
 * @property {boolean} hasNucleus - Whether the word has a phonological nucleus (vowel/syllabic).
 *   Words without a nucleus (consonant-only prepositions like 'v', 's') are deferred as
 *   prefixes onto the next syllable token.
 * @property {Array<{syl: string, isStressed: boolean}>} syllables
 *   Syllable strings with per-syllable stress. Must be non-empty when hasNucleus is true.
 */

/**
 * @typedef {Object} LanguagePlugin
 * @property {string}   code          - ISO 639-1 code: 'sk', 'cs', 'en', 'fr'
 * @property {string}   label         - Display name: 'Slovak', 'Czech', etc.
 * @property {RegExp}   [codaPattern] - Regex to detect a coda word (e.g. /^amen$/i)
 * @property {Array<{num: string, label: string}>} [psalms]
 *   Ordered list of available psalm texts for this language.
 * @property {Syllabifier} syllabifier - Language-specific syllabifier instance.
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
    return phrase.replace(/\s*_\s*/g, TIE_SEP).replace(/\|/g, PIPE_SEP);
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
 * Abstract base class for language syllabifiers.
 * Subclasses implement only {@link syllabifyWord}; all phrase-level logic
 * (TIE, PIPE, prefix deferral, punctuation handling) lives here.
 */
export class Syllabifier {
    /**
     * Syllabify a single clean word (no spaces, no punctuation).
     * @param {string} word
     * @returns {WordResult}
     */
    syllabifyWord(_word) {
        throw new Error('syllabifyWord() must be implemented by subclass');
    }

    /**
     * Tokenize a full text phrase into syllable tokens with position metadata.
     * @param {string} phrase
     * @returns {SyllableToken[]}
     */
    syllabify(phrase) {
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
                    const syls = clean ? this.syllabifyWord(clean).syllables.map((s) => s.syl) : [];
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
                tokens.push({
                    syl: combinedSyl,
                    wordIdx: wordIdxCounter++,
                    sylIdx: 0,
                    isStressed: true,
                });
                continue;
            }

            // ── PIPE (|): explicit in-word split — parts share the same wordIdx ──
            if (raw.includes(PIPE_SEP)) {
                const parts = raw.split(PIPE_SEP).filter(Boolean);
                const wIdx = wordIdxCounter++;
                for (let pi = 0; pi < parts.length; pi++) {
                    let syl = parts[pi];
                    if (pi === 0 && pendingPrefix) {
                        syl = pendingPrefix + syl;
                        pendingPrefix = '';
                    }
                    const isStressed = pi === 0 || (parts.length >= 4 && pi % 2 === 0);
                    tokens.push({ syl, wordIdx: wIdx, sylIdx: pi, isStressed });
                }
                pendingPrefix = '';
                continue;
            }

            // ── Marker tokens (* / †): emit as standalone with own wordIdx ──
            if (raw === '*' || raw === '†') {
                tokens.push({
                    syl: raw,
                    wordIdx: wordIdxCounter++,
                    sylIdx: 0,
                    isStressed: false,
                });
                continue;
            }

            // ── Standard word ──
            const leadPunct = raw.match(/^[^\p{L}]*/u)?.[0] ?? '';
            const trailPunct = raw.match(/[^\p{L}]*$/u)?.[0] ?? '';
            const clean = raw.slice(leadPunct.length, raw.length - trailPunct.length);

            const { syllables, hasNucleus } = this.syllabifyWord(clean);

            // Consonant-only word before another word → defer as prefix onto next syllable.
            if (!hasNucleus && wi < words.length - 1) {
                pendingPrefix += leadPunct + clean + trailPunct + ' ';
                continue;
            }

            const wIdx = wordIdxCounter++;
            for (let sylIdx = 0; sylIdx < syllables.length; sylIdx++) {
                let syl = syllables[sylIdx].syl;
                if (sylIdx === 0) syl = pendingPrefix + leadPunct + syl;
                if (sylIdx === syllables.length - 1) syl += trailPunct;
                tokens.push({
                    syl,
                    wordIdx: wIdx,
                    sylIdx,
                    isStressed: syllables[sylIdx].isStressed,
                });
            }
            pendingPrefix = '';
        }

        // Leftover consonant-only word at end of phrase — emit as-is.
        if (pendingPrefix) {
            tokens.push({
                syl: pendingPrefix.trim(),
                wordIdx: wordIdxCounter,
                sylIdx: 0,
                isStressed: true,
            });
        }

        return tokens;
    }
}
