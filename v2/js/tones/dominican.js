// Dominican psalm tone schemas derived from d_tones in legacy psalmtone.js.
//
// Top-level keys per tone:
//   clef          — GABC clef string (e.g. "c4", "f3", "c3")
//   tenor         — reciting note letter (GABC pitch, e.g. "j")
//   flex          — cadence array for the flex (†) half-verse
//   mediant       — { intonation, cadence } for the mediant (*) cadence, normal style
//   solemn        — { intonation, cadence } for the mediant (*) cadence, solemn style
//   shortMediant  — (tone 7 only) intonation-only variant for short verses
//   shortSolemn   — (tone 7 only) solemn intonation-only variant for short verses
//   terminations  — map of cadence key → cadence array (tones with multiple endings)
//   termination   — single cadence array (tones with only one ending)
//
// intonation: string[] — GABC note letters sung on the first syllables of verse 1.
//
// Cadence arrays are ordered left-to-right within the cadence region;
// alignChunk() in pointer.js consumes them right-to-left.
// Each cadence entry is a single-key object; the key is the syllable role:
//   prep  — preparatory syllable(s) before the accent
//   acc   — accented syllable (stress-bearing)
//   ep    — post-accent epiphonema syllable
//   fin   — final syllable (always present, never dropped)
// The value is the GABC note letter(s) for that slot; '.' suffix = sustain.

export const tone1 = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["f", "gh"],
    cadence: [{ acc: "ixi" }, { ep: "h" }, { acc: "g" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["f", "gh"],
    cadence: [{ prep: "hg" }, { prep: "ixgi" }, { prep: "h" }, { prep: "h" }, { acc: "hg" }, { fin: "gh." }],
  },
  terminations: {
    "D": [{ prep: "g" }, { prep: "f" }, { acc: "gh" }, { ep: "g" }, { fin: "gvFED." }],
    "D-": [{ prep: "g" }, { prep: "f" }, { acc: "g" }, { ep: "g" }, { fin: "gvFED." }],
    "D2": [{ prep: "g" }, { prep: "f" }, { prep: "g" }, { acc: "gf" }, { fin: "d." }],
    "f": [{ prep: "g" }, { prep: "f" }, { acc: "gh" }, { ep: "g" }, { fin: "gf." }],
    "g": [{ prep: "g" }, { prep: "f" }, { acc: "gh" }, { ep: "g" }, { fin: "g." }],
    "g2": [{ prep: "g" }, { prep: "f" }, { acc: "g" }, { ep: "g" }, { fin: "ghg." }],
    "g3": [{ prep: "g" }, { prep: "f" }, { acc: "g" }, { ep: "g" }, { fin: "g." }],
    "a": [{ prep: "g" }, { prep: "f" }, { acc: "g" }, { ep: "h" }, { fin: "h." }],
    "a2": [{ prep: "g" }, { prep: "f" }, { acc: "g" }, { ep: "g" }, { fin: "gh." }],
    "a3": [{ prep: "g" }, { prep: "f" }, { acc: "gh" }, { ep: "g" }, { fin: "gh." }]
  },
};

export const tone2 = {
  clef: "f3",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["e", "f"],
    cadence: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["e", "fe", "eh"],
    cadence: [{ prep: "hg" }, { prep: "hi" }, { prep: "i" }, { acc: "hi" }, { ep: "h" }, { fin: "h." }],
  },
  termination: [{ prep: "g" }, { acc: "e" }, { ep: "f" }, { fin: "f." }],
};

export const tone2monasticus = {
  clef: "f3",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "f" }, { fin: "f." }],
  mediant: tone2.mediant,
  solemn: tone2.solemn,
  termination: [{ prep: "g" }, { prep: "e" }, { acc: "ef" }, { fin: "f." }],
};

export const tone3 = {
  clef: "c4",
  tenor: "j",
  flex: [{ acc: "j" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["g", "hj"],
    cadence: [{ acc: "k" }, { ep: "j" }, { prep: "j" }, { acc: "ih" }, { fin: "j." }],
  },
  solemn: {
    intonation: ["g", "hj"],
    cadence: [{ acc: "jk" }, { ep: "j" }, { prep: "j" }, { acc: "ih" }, { fin: "hj." }],
  },
  terminations: {
    "b": [{ prep: "h" }, { acc: "j" }, { ep: "j" }, { fin: "i." }],
    "a": [{ prep: "h" }, { acc: "j" }, { ep: "j" }, { fin: "ih." }],
    "a2": [{ prep: "ji" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "gh." }],
    "g": [{ prep: "ji" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "g." }],
    "g2": [{ prep: "h" }, { prep: "j" }, { prep: "i" }, { acc: "h" }, { ep: "g" }, { fin: "g." }]
  },
};

export const tone3antiquo = {
  clef: "c4",
  tenor: "i",
  flex: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["g", "hi"],
    cadence: [{ acc: "k" }, { ep: "j" }, { prep: "j" }, { acc: "ih" }, { fin: "j." }],
  },
  solemn: {
    intonation: ["g", "hi"],
    cadence: [{ acc: "jk" }, { ep: "j" }, { prep: "j" }, { acc: "ih" }, { fin: "hj." }],
  },
  terminations: {
    "b": [{ acc: "j" }, { ep: "h" }, { acc: "j" }, { ep: "j" }, { fin: "i." }],
    "a": [{ acc: "j" }, { ep: "h" }, { acc: "j" }, { ep: "j" }, { fin: "ih." }],
    "a2": [{ acc: "j" }, { ep: "h" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "gh." }],
    "a3": [{ acc: "ji" }, { ep: "h" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "gh." }],
    "g": [{ acc: "j" }, { ep: "h" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "g." }],
    "g2": [{ acc: "ji" }, { ep: "h" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "g." }]
  },
};

export const tone4 = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["h", "gh"],
    cadence: [{ prep: "g" }, { prep: "h" }, { acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["h", "gh"],
    cadence: [{ prep: "hg" }, { prep: "gi" }, { prep: "i" }, { acc: "hi" }, { ep: "h" }, { fin: "h." }],
  },
  terminations: {
    "g": [{ acc: "h" }, { ep: "g" }, { fin: "g." }],
    "E": [{ prep: "g" }, { prep: "h" }, { prep: "ih" }, { prep: "g" }, { acc: "gf" }, { fin: "e." }]
  },
};

export const tone4antiquo = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["e", "gh"],
    cadence: tone4.mediant.cadence,
  },
  solemn: tone4.solemn,
  terminations: tone4.terminations,
};

export const tone4alt = {
  clef: "c3",
  tenor: "i",
  flex: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["i", "hi"],
    cadence: [{ prep: "h" }, { prep: "i" }, { acc: "j" }, { ep: "i" }, { fin: "i." }],
  },
  solemn: {
    intonation: ["i", "hi"],
    cadence: [{ prep: "ih" }, { prep: "hj" }, { prep: "j" }, { acc: "ij" }, { ep: "i" }, { fin: "i." }],
  },
  terminations: {
    "c": [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
    "A": [{ prep: "h" }, { prep: "i" }, { prep: "j" }, { acc: "h" }, { ep: "f" }, { fin: "f." }],
    "A*": [{ prep: "h" }, { prep: "i" }, { prep: "j" }, { acc: "h" }, { ep: "f" }, { fin: "fg." }],
    "d": [{ prep: "h" }, { prep: "i" }, { prep: "j" }, { acc: "h" }, { ep: "i" }, { fin: "i." }]
  },
};

export const tone4antiquoAlt = {
  clef: "c3",
  tenor: "i",
  flex: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["f", "hi"],
    cadence: tone4alt.mediant.cadence,
  },
  solemn: tone4alt.solemn,
  terminations: tone4alt.terminations,
};

export const tone5 = {
  clef: "c3",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["d", "f"],
    cadence: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["d", "f"],
    cadence: [{ prep: "i" }, { acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  termination: [{ acc: "i" }, { ep: "g" }, { acc: "h" }, { ep: "f" }, { fin: "f." }],
};

export const tone6 = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["f", "gh"],
    cadence: [{ acc: "ixi" }, { ep: "h" }, { acc: "g" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["f", "gh"],
    cadence: [{ prep: "hg" }, { prep: "ixgi" }, { prep: "h" }, { prep: "h" }, { acc: "hg" }, { fin: "gh." }],
  },
  termination: [{ prep: "f" }, { prep: "gh" }, { acc: "g" }, { ep: "f" }, { fin: "f." }],
};

export const tone6alt = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["f", "gh"],
    cadence: [{ prep: "g" }, { acc: "h" }, { ep: "f" }, { fin: "f." }],
  },
  termination: tone6.termination,
};

export const tone7 = {
  clef: "c3",
  tenor: "i",
  flex: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["hg", "hi"],
    cadence: [{ acc: "k" }, { ep: "j" }, { acc: "i" }, { ep: "j" }, { fin: "j." }],
  },
  shortMediant: {
    intonation: ["hg", "hi"],
    cadence: [{ fin: "i." }],
  },
  solemn: {
    intonation: ["ehg", "hi"],
    cadence: [{ acc: "ik" }, { ep: "j" }, { prep: "j" }, { acc: "ji" }, { fin: "ij." }],
  },
  shortSolemn: {
    intonation: ["ehg", "hi"],
    cadence: [{ fin: "i." }],
  },
  terminations: {
    "a": [{ acc: "j" }, { ep: "i" }, { acc: "h" }, { ep: "h" }, { fin: "gf." }],
    "b": [{ acc: "j" }, { ep: "i" }, { acc: "h" }, { ep: "h" }, { fin: "g." }],
    "c": [{ acc: "j" }, { ep: "i" }, { acc: "h" }, { ep: "h" }, { fin: "gh." }],
    "c2": [{ acc: "j" }, { ep: "i" }, { acc: "h" }, { ep: "h" }, { fin: "ih." }],
    "d": [{ acc: "j" }, { ep: "i" }, { acc: "h" }, { ep: "h" }, { fin: "gi." }]
  },
};

export const tone8 = {
  clef: "c4",
  tenor: "j",
  flex: [{ acc: "j" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["g", "h"],
    cadence: [{ acc: "k" }, { ep: "j" }, { fin: "j." }],
  },
  solemn: {
    intonation: ["g", "hg", "gj"],
    cadence: [{ prep: "ji" }, { prep: "jk" }, { prep: "k" }, { acc: "jk" }, { ep: "j" }, { fin: "j." }],
  },
  terminations: {
    "G": [{ prep: "i" }, { prep: "j" }, { acc: "h" }, { ep: "g" }, { fin: "g." }],
    "G*": [{ prep: "i" }, { prep: "j" }, { acc: "h" }, { ep: "g" }, { fin: "gh." }],
    "c": [{ prep: "h" }, { prep: "j" }, { acc: "k" }, { ep: "j" }, { fin: "j." }]
  },
};

export const per = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "h" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["ixhi"],
    cadence: [{ prep: "g" }, { prep: "ixi" }, { prep: "h" }, { acc: "g" }, { ep: "f" }, { fin: "f." }],
  },
  // Note: The tenor for the second half of Peregrinus drops to 'g'. 
  // The 'pointer.js' algorithm currently inherits the global tenor 'h'. 
  // This may require an override in the caller for true Peregrinus rendering.
  termination: [{ prep: "d" }, { acc: "f" }, { ep: "f" }, { fin: "ed." }],
};
