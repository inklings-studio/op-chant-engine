/**
 * Split a raw verse on '†' and '*', syllabifies each chunk via
 * the supplied syllabifierFn, and aligns syllables to cadence slots.
 * All tokens are always returned (including intonation-role tokens);
 * the rendering layer decides whether to display them.
 *
 * @param {string}   rawVerseText  — may contain '†' (flex) and '*' (mediant) markers
 * @param {object}   toneObject    — tone schema from dominican.js
 * @param {string}   cadenceKey    — key into toneObject.terminations (ignored for single-termination tones)
 * @param {boolean}  isSolemn      — use solemn vs. mediant cadence
 * @param {function} syllabifierFn — syllabifyPhrase (or equivalent) returning [{syl, isStressed, ...}]
 * @returns {Array<{syl: string, note: string, role: string}>}
 *   role ∈ { 'tenor', 'intonation', 'acc', 'ep', 'fin', 'prep' }
 */
export function pointVerse(rawVerseText, toneObject, cadenceKey, isSolemn, syllabifierFn) {
  const daggerIdx = rawVerseText.indexOf('†');
  const flexRaw = daggerIdx !== -1 ? rawVerseText.slice(0, daggerIdx) : '';
  const mainRaw = daggerIdx !== -1 ? rawVerseText.slice(daggerIdx + 1) : rawVerseText;

  const starIdx = mainRaw.indexOf('*');
  if (starIdx === -1) throw new Error('pointVerse: verse is missing the * mediant marker');
  const mediantRaw = mainRaw.slice(0, starIdx);
  const termRaw = mainRaw.slice(starIdx + 1);

  const cadenceSection = isSolemn ? toneObject.solemn : toneObject.mediant;
  const intonation = cadenceSection.intonation;
  const tenorNote = toneObject.tenor;
  const termCadence = toneObject.terminations?.[cadenceKey] ?? toneObject.termination;

  const result = [];

  if (flexRaw.trim()) {
    const tokens = syllabifierFn(flexRaw.trim());
    result.push(...alignChunk(tokens, toneObject.flex, tenorNote, []));
  }

  const mediantTokens = syllabifierFn(mediantRaw.trim());
  result.push(...alignChunk(mediantTokens, cadenceSection.cadence, tenorNote, intonation));

  const termTokens = syllabifierFn(termRaw.trim());
  result.push(...alignChunk(termTokens, termCadence, tenorNote, []));

  return result;
}

/**
 * Align a token array to a cadence array using a right-to-left scan.
 * Remaining left positions receive intonation roles (first N) then tenor.
 *
 * Shortening rules:
 *   - fin is always the rightmost slot and is never dropped.
 *   - ep/prep are consumed strictly right-to-left; if tokens run out they are silently skipped.
 *   - acc scans leftward for the next stressed syllable; intervening unstressed tokens become tenor.
 *     If no stressed syllable remains, the acc slot is silently dropped.
 *   - Leftmost cadence slots (second acc, prep, intonation) are lost first on very short verses.
 *
 * @param {Array<{syl: string, isStressed: boolean}>} tokens
 * @param {Array<object>} cadence         — e.g. [{acc:"k"}, {ep:"j"}, {fin:"j."}]
 * @param {string}        tenorNote
 * @param {string[]}      intonationNotes — assigned left-to-right to any remaining positions
 * @returns {Array<{syl: string, note: string, role: string}>}
 */
export function alignChunk(tokens, cadence, tenorNote, intonationNotes) {
  const result = new Array(tokens.length).fill(null);
  let ti = tokens.length - 1;

  for (let ci = cadence.length - 1; ci >= 0 && ti >= 0; ci--) {
    const role = Object.keys(cadence[ci])[0];
    const note = cadence[ci][role];

    if (role === 'fin' || role === 'ep' || role === 'prep') {
      result[ti] = { syl: tokens[ti].syl, note, role };
      ti--;
    } else if (role === 'acc') {
      // Scan leftward past unstressed syllables, assigning them to tenor.
      while (ti >= 0 && !tokens[ti].isStressed) {
        result[ti] = { syl: tokens[ti].syl, note: tenorNote, role: 'tenor' };
        ti--;
      }
      if (ti >= 0) {
        result[ti] = { syl: tokens[ti].syl, note, role: 'acc' };
        ti--;
      }
      // No stressed syllable found: acc slot silently dropped.
    }
  }

  // Fill remaining left positions: intonation for first N, tenor for the rest.
  for (let i = 0; i <= ti; i++) {
    result[i] = i < intonationNotes.length
      ? { syl: tokens[i].syl, note: intonationNotes[i], role: 'intonation' }
      : { syl: tokens[i].syl, note: tenorNote, role: 'tenor' };
  }

  return result;
}
