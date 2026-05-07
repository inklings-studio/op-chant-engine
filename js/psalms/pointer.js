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
 * @param {boolean}  isFirstVerse  — true only for verse index 0; controls intonation assignment
 * @returns {Array<{syl: string, note: string, role: string}>}
 *   role ∈ { 'tenor', 'intonation', 'acc', 'ep', 'fin', 'prep', 'flex', 'mediant' }
 *   'flex' and 'mediant' are barline sentinels: syl is '' and note is ',' / ';' respectively.
 */
export function pointVerse(rawVerseText, toneObject, cadenceKey, isSolemn, syllabifierFn, isFirstVerse = true) {
  const daggerIdx = rawVerseText.indexOf('†');
  const flexRaw = daggerIdx !== -1 ? rawVerseText.slice(0, daggerIdx) : '';
  const mainRaw = daggerIdx !== -1 ? rawVerseText.slice(daggerIdx + 1) : rawVerseText;

  const starIdx = mainRaw.indexOf('*');
  if (starIdx === -1) throw new Error('pointVerse: verse is missing the * mediant marker');
  const mediantRaw = mainRaw.slice(0, starIdx);
  const termRaw = mainRaw.slice(starIdx + 1);

  const cadenceSection = isSolemn ? toneObject.solemn : toneObject.mediant;
  // Intonation is only sung on the first verse; subsequent verses start directly on the tenor.
  const intonation = isFirstVerse ? cadenceSection.intonation : [];
  const tenorNote = toneObject.tenor;
  const termCadence = toneObject.terminations?.[cadenceKey] ?? toneObject.termination;

  const result = [];

  if (flexRaw.trim()) {
    const tokens = syllabifierFn(flexRaw.trim());
    result.push(...alignChunk(tokens, toneObject.flex, tenorNote, []));
    result.push({ syl: '', note: ',', role: 'flex' });
  }

  const mediantTokens = syllabifierFn(mediantRaw.trim());
  result.push(...alignChunk(mediantTokens, cadenceSection.cadence, tenorNote, intonation));
  result.push({ syl: '', note: ':', role: 'mediant' });

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
 *   - ep/prep are consumed right-to-left, BUT skipped when the current token is stressed
 *     and an acc slot still remains to the left — this ensures the acc note always lands
 *     on the last stressed syllable rather than an earlier unstressed neighbour.
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

    if (role === 'fin') {
      result[ti] = { syl: tokens[ti].syl, note, role };
      ti--;
    } else if (role === 'ep' || role === 'prep') {
      // Skip this slot when the current token is stressed and an acc slot remains to the
      // left in the cadence — the acc should claim this stressed syllable, not ep/prep.
      const hasAccLeft = cadence.slice(0, ci).some(c => Object.keys(c)[0] === 'acc');
      if (tokens[ti].isStressed && hasAccLeft) {
        continue;
      }
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
  // Only apply intonation when at least one tenor note would survive after it.
  const applyIntonation = intonationNotes.length > 0 && (ti + 1) > intonationNotes.length;
  for (let i = 0; i <= ti; i++) {
    result[i] = (applyIntonation && i < intonationNotes.length)
      ? { syl: tokens[i].syl, note: intonationNotes[i], role: 'intonation' }
      : { syl: tokens[i].syl, note: tenorNote, role: 'tenor' };
  }

  return result;
}
