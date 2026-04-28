// Slovak syllabification — cursor-advance FSM.
// Nucleus priority: diphthong (ia/ie/iu) > vowel > syllabic consonant (r/l/ŕ/ĺ).
// Syllable boundary: first consonant unit = coda of previous syllable, rest = onset of next.

const VOWELS = new Set([...'yaeiouáéíóúýäôYAEIOUÁÉÍÓÚÝÄÔ']);
const SYLLABIC = new Set([...'rlŕĺRLŔĹ']);

const DIPHTHONG_PAIRS = new Set(['ia', 'ie', 'iu', 'ou', 'Ia', 'Ie', 'Iu', 'Ou', 'IA', 'IE', 'IU', 'OU']);
// Slovak digraphs: each pair is a single indivisible consonant unit.
const DIGRAPHS = new Set(['ch','Ch','CH','cH','dz','Dz','DZ','dZ','dž','Dž','DŽ','dŽ']);

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
    if (isDigraphStart(str, j)) { units.push(2); j += 2; }
    else                        { units.push(1); j++;   }
  }
  return units;
}

function isVowel(ch) { return VOWELS.has(ch); }
function isSyllabic(ch) { return SYLLABIC.has(ch); }

// Per-word exception dictionary for morphological boundaries and loanwords.
const DICTIONARY = new Map();

/**
 * Register a syllabification exception. Lookup is case-insensitive.
 * @param {string} word
 * @param {string[]} syllables
 */
export function addException(word, syllables) {
  DICTIONARY.set(word.toLowerCase(), syllables);
}

/**
 * Syllabify a single word (no spaces, no punctuation).
 * @param {string} word
 * @returns {string[]}
 */
export function syllabifyWord(word) {
  if (!word) return [];

  const entry = DICTIONARY.get(word.toLowerCase());
  if (entry) return entry;

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

  if (nuclei.length === 0) return [word];
  if (nuclei.length === 1) return [word];

  // Determine split points between consecutive nuclei.
  // Rule: first consonant unit = coda, remaining units = onset of next syllable.
  // Digraphs are treated as a single indivisible unit.
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
        splits.push(prevEnd);              // sole unit goes entirely to next syllable as onset
      } else {
        splits.push(prevEnd + units[0]);   // first unit = coda, rest = onset
      }
    }
  }

  // Slice word at split points.
  const syllables = [];
  let start = 0;
  for (const split of splits) {
    syllables.push(word.slice(start, split));
    start = split;
  }
  syllables.push(word.slice(start));

  return syllables.filter(Boolean);
}

function _hasNucleus(word) {
  for (const ch of word) {
    if (isVowel(ch) || isSyllabic(ch)) return true;
  }
  return false;
}

/**
 * Tokenize a full phrase into syllable tokens with position metadata.
 * Strips punctuation from words before syllabifying; preserves it in the token.
 *
 * Consonant-only words (no vowel/syllabic nucleus) — Slovak prepositions v, s, k, z —
 * are prepended to the first syllable of the following word ("s tebou" → "s te" + "bou").
 * Vowel prepositions (o, a, u…) keep their own syllable slot.
 * @param {string} phrase
 * @returns {import('../../common/language.js').SyllableToken[]}
 */
export function syllabifyPhrase(phrase) {
  const tokens = [];
  const words = phrase.trim().split(/\s+/);
  let pendingPrefix = '';

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const raw = words[wordIdx];
    const leadPunct = raw.match(/^[^\p{L}]*/u)?.[0] ?? '';
    const trailPunct = raw.match(/[^\p{L}]*$/u)?.[0] ?? '';
    const clean = raw.slice(leadPunct.length, raw.length - trailPunct.length);

    // Consonant-only word before another word → defer as prefix onto next syllable.
    if (clean && !_hasNucleus(clean) && wordIdx < words.length - 1) {
      pendingPrefix += leadPunct + clean + trailPunct + ' ';
      continue;
    }

    const syls = syllabifyWord(clean);
    for (let sylIdx = 0; sylIdx < syls.length; sylIdx++) {
      let syl = syls[sylIdx];
      if (sylIdx === 0) syl = pendingPrefix + leadPunct + syl;
      if (sylIdx === syls.length - 1) syl = syl + trailPunct;
      tokens.push({ syl, wordIdx, sylIdx });
    }
    pendingPrefix = '';
  }

  // Leftover consonant-only word at end of phrase — emit as-is.
  if (pendingPrefix) {
    tokens.push({ syl: pendingPrefix.trim(), wordIdx: words.length - 1, sylIdx: 0 });
  }

  return tokens;
}
