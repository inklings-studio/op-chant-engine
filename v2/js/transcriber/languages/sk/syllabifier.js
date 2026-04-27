// Slovak syllabification — cursor-advance FSM.
// Nucleus priority: diphthong (ia/ie/iu) > vowel > syllabic consonant (r/l/ŕ/ĺ).
// Syllable boundary: one-consonant onset (split before last consonant before next nucleus).

const VOWELS = new Set([...'yaeiouáéíóúýäôYAEIOUÁÉÍÓÚÝÄÔ']);
const SYLLABIC = new Set([...'rlŕĺRLŔĹ']);

const DIPHTHONG_PAIRS = new Set(['ia', 'ie', 'iu', 'Ia', 'Ie', 'Iu', 'IA', 'IE', 'IU']);

function isDiphthongStart(word, i) {
  return i + 1 < word.length && DIPHTHONG_PAIRS.has(word[i] + word[i + 1]);
}

function isVowel(ch) { return VOWELS.has(ch); }
function isSyllabic(ch) { return SYLLABIC.has(ch); }
function isConsonant(ch) { return ch && !isVowel(ch); }

/**
 * Syllabify a single word (no spaces, no punctuation).
 * @param {string} word
 * @returns {string[]}
 */
export function syllabifyWord(word) {
  if (!word) return [];

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
  // One-consonant onset: split just before the last consonant cluster member
  // immediately preceding the next nucleus.
  const splits = [];
  for (let n = 1; n < nuclei.length; n++) {
    const prevEnd = nuclei[n - 1].pos + nuclei[n - 1].len;
    const nextStart = nuclei[n].pos;
    const between = word.slice(prevEnd, nextStart); // consonant cluster between nuclei

    if (between.length === 0) {
      splits.push(nextStart);
    } else if (between.length === 1) {
      splits.push(prevEnd); // single consonant goes to next syllable
    } else {
      // Two or more consonants: give one onset consonant to the next syllable.
      splits.push(prevEnd + between.length - 1);
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

/**
 * Tokenize a full phrase into syllable tokens with position metadata.
 * Strips punctuation from words before syllabifying; preserves it in the token.
 * @param {string} phrase
 * @returns {import('../../common/language.js').SyllableToken[]}
 */
export function syllabifyPhrase(phrase) {
  const tokens = [];
  const words = phrase.trim().split(/\s+/);

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const raw = words[wordIdx];
    // Strip leading/trailing punctuation for syllabification, keep it on first/last syl.
    const leadPunct = raw.match(/^[^\p{L}]*/u)?.[0] ?? '';
    const trailPunct = raw.match(/[^\p{L}]*$/u)?.[0] ?? '';
    const clean = raw.slice(leadPunct.length, raw.length - trailPunct.length);

    const syls = syllabifyWord(clean);
    for (let sylIdx = 0; sylIdx < syls.length; sylIdx++) {
      let syl = syls[sylIdx];
      if (sylIdx === 0) syl = leadPunct + syl;
      if (sylIdx === syls.length - 1) syl = syl + trailPunct;
      tokens.push({ syl, wordIdx, sylIdx });
    }
  }

  return tokens;
}
