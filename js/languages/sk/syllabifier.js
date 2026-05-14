import { Syllabifier } from '../../common/language.js';

// Slovak syllabification — cursor-advance FSM.
// Nucleus priority: diphthong (ia/ie/iu) > vowel > syllabic consonant (r/l/ŕ/ĺ).
// Syllable boundary: first consonant unit = coda of previous syllable, rest = onset of next.

const VOWELS = new Set([...'yaeiouáéíóúýäôYAEIOUÁÉÍÓÚÝÄÔ']);
const SYLLABIC = new Set([...'rlŕĺRLŔĹ']);

// Monosyllabic function words that never carry primary stress.
const UNSTRESSED_MONOSYLLABLES = new Set([
    // conjunctions
    'a',
    'i',
    'aj',
    'že',
    // short pronouns / auxiliary verbs
    'sa',
    'si',
    'mi',
    'ti',
    'ho',
    'mu',
    'ju',
    'ich',
    'som',
    'je',
    'by',
    // syllabic prepositions
    'o',
    'u',
    'do',
    'na',
    'za',
    'pri',
    'po',
    'vo',
    'zo',
    'so',
    'ku',
]);

const DIPHTHONG_PAIRS = new Set([
    'ia',
    'ie',
    'iu',
    'ou',
    'Ia',
    'Ie',
    'Iu',
    'Ou',
    'IA',
    'IE',
    'IU',
    'OU',
]);
// Slovak digraphs: each pair is a single indivisible consonant unit.
const DIGRAPHS = new Set(['ch', 'Ch', 'CH', 'cH', 'dz', 'Dz', 'DZ', 'dZ', 'dž', 'Dž', 'DŽ', 'dŽ']);

function isDiphthongStart(word, i) {
    return i + 1 < word.length && DIPHTHONG_PAIRS.has(word[i] + word[i + 1]);
}

function isDigraphStart(str, i) {
    return i + 1 < str.length && DIGRAPHS.has(str[i] + str[i + 1]);
}

// Returns array of character-lengths for each consonant unit in a between-nuclei cluster.
// Digraphs count as one unit of length 2; all other characters count as length 1.
function consonantUnits(str) {
    const units = [];
    let j = 0;
    while (j < str.length) {
        if (isDigraphStart(str, j)) {
            units.push(2);
            j += 2;
        } else {
            units.push(1);
            j++;
        }
    }
    return units;
}

function isVowel(ch) {
    return VOWELS.has(ch);
}
function isSyllabic(ch) {
    return SYLLABIC.has(ch);
}

// Split a word into syllable strings using the FSM. Returns string[].
function _split(word) {
    // Collect nucleus positions and their lengths.
    const nuclei = [];
    let i = 0;
    while (i < word.length) {
        if (isDiphthongStart(word, i)) {
            nuclei.push({ pos: i, len: 2 });
            i += 2;
        } else if (isVowel(word[i])) {
            nuclei.push({ pos: i, len: 1 });
            i++;
        } else if (isSyllabic(word[i])) {
            // Syllabic only when not adjacent to a vowel.
            const prevVowel = i > 0 && isVowel(word[i - 1]);
            const nextVowel = i + 1 < word.length && isVowel(word[i + 1]);
            if (!prevVowel && !nextVowel) {
                nuclei.push({ pos: i, len: 1 });
            }
            i++;
        } else {
            i++;
        }
    }

    if (nuclei.length <= 1) return [word];

    // Determine split points between consecutive nuclei.
    // Rule: first consonant unit = coda, remaining units = onset of next syllable.
    const splits = [];
    for (let n = 1; n < nuclei.length; n++) {
        const prevEnd = nuclei[n - 1].pos + nuclei[n - 1].len;
        const nextStart = nuclei[n].pos;
        const between = word.slice(prevEnd, nextStart);

        if (between.length === 0) {
            splits.push(nextStart);
        } else {
            const units = consonantUnits(between);
            if (units.length === 1) {
                splits.push(prevEnd); // sole unit goes entirely to next syllable as onset
            } else {
                splits.push(prevEnd + units[0]); // first unit = coda, rest = onset
            }
        }
    }

    const syllables = [];
    let start = 0;
    for (const split of splits) {
        syllables.push(word.slice(start, split));
        start = split;
    }
    syllables.push(word.slice(start));

    return syllables.filter(Boolean);
}

export class SlovakSyllabifier extends Syllabifier {
    /**
     * @param {string} word
     * @returns {import('../../common/language.js').WordResult}
     */
    syllabifyWord(word) {
        if (!word) return { hasNucleus: false, syllables: [] };

        const syls = _split(word);
        const hasNucleus = [...word].some((c) => VOWELS.has(c) || SYLLABIC.has(c));

        return {
            hasNucleus,
            syllables: syls.map((syl, i) => ({
                syl,
                isStressed:
                    syls.length === 1
                        ? !UNSTRESSED_MONOSYLLABLES.has(word.toLowerCase())
                        : i === 0 || (syls.length >= 4 && i % 2 === 0),
            })),
        };
    }
}
