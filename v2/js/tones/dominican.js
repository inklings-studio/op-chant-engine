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
  flex: [{ acc: "g" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["f", "g"],
    // source: "f gh hr 'ixi hr 'g hr h" → 2 accents: ixi neume, g; ep h (hr), fin h
    cadence: [{ acc: "ixi" }, { acc: "g" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["f", "g"],
    // source: "f gh hr hg ixgi h hr 'hg gh" → acc hg neume, fin gh neume
    cadence: [{ acc: "hg" }, { fin: "gh." }],
  },
  terminations: {
    // source: "hr g f 'gh gr gvFED" → prep g, prep f, acc gh neume, ep g (gr), fin gvFED neume
    D: [{ prep: "g" }, { prep: "f" }, { acc: "gh" }, { ep: "g" }, { fin: "gvFED." }],
    // source: "hr g f 'gh gr g" → prep g, prep f, acc gh neume, ep g (gr), fin g
    g: [{ prep: "g" }, { prep: "f" }, { acc: "gh" }, { ep: "g" }, { fin: "g." }],
    // source: "hr g f 'g hr h" → prep g, prep f, acc g, ep h (hr), fin h
    a: [{ prep: "g" }, { prep: "f" }, { acc: "g" }, { ep: "h" }, { fin: "h." }],
  },
};

export const tone2 = {
  clef: "f3",
  tenor: "h",
  flex: [{ acc: "f" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["e", "f"],
    // source: "e f hr 'i hr h" → acc i, ep h (hr), fin h
    cadence: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["e", "f"],
    // source: "e fe eh hr hg hi i 'hi hr h" → acc hi neume, ep h (hr), fin h
    cadence: [{ acc: "hi" }, { ep: "h" }, { fin: "h." }],
  },
  // source: "hr g 'e fr f" → prep g, acc e, ep f (fr), fin f
  termination: [{ prep: "g" }, { acc: "e" }, { ep: "f" }, { fin: "f." }],
};

export const tone3 = {
  clef: "c4",
  tenor: "j",
  flex: [{ acc: "h" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["g", "h"],
    // source: "g hj jr 'k jr jr 'ih j" → 2 accents: k (left), ih (right); ep j, fin j
    cadence: [{ acc: "k" }, { ep: "j" }, { acc: "ih" }, { fin: "j." }],
  },
  solemn: {
    intonation: ["g", "h"],
    // source: "g hj jr 'jk jr jr 'ih hj" → acc jk neume, acc ih, fin hj neume
    cadence: [{ acc: "jk" }, { ep: "j" }, { acc: "ih" }, { fin: "hj." }],
  },
  terminations: {
    // source: "jr h 'j jr ih" → prep h, acc j, ep j (jr), fin ih
    a:  [{ prep: "h" }, { acc: "j" }, { ep: "j" }, { fin: "ih." }],
    // source: "jr ji hi 'h gr gh" → prep ji neume, prep hi neume, acc h, ep g (gr), fin gh neume
    a2: [{ prep: "ji" }, { prep: "hi" }, { acc: "h" }, { ep: "g" }, { fin: "gh." }],
  },
};

export const tone4 = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "g" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["h", "g"],
    // source: "h gh hr g h 'i hr h" → acc i, ep h (hr), fin h
    cadence: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["h", "g"],
    // source: "h gh hr hg gi i 'hi hr h" → acc hi neume, ep h (hr), fin h
    cadence: [{ acc: "hi" }, { ep: "h" }, { fin: "h." }],
  },
  terminations: {
    // source: "hr g h ih gr 'gf e" → prep g, prep h, prep ih neume, acc gf neume, fin e
    E: [{ prep: "g" }, { prep: "h" }, { prep: "ih" }, { acc: "gf" }, { fin: "e." }],
  },
};

export const tone4alt = {
  clef: "c3",
  tenor: "i",
  flex: [{ acc: "h" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["i", "h"],
    // source: "i hi ir h i 'j ir i" → acc j, ep i (ir), fin i
    cadence: [{ acc: "j" }, { ep: "i" }, { fin: "i." }],
  },
  solemn: {
    intonation: ["i", "h"],
    // source: "i hi ir ih hj j 'ij ir i" → acc ij neume, ep i (ir), fin i
    cadence: [{ acc: "ij" }, { ep: "i" }, { fin: "i." }],
  },
  terminations: {
    // source: "ir h i j 'h fr f" → prep h, prep i, prep j, acc h, ep f (fr), fin f
    A: [{ prep: "h" }, { prep: "i" }, { prep: "j" }, { acc: "h" }, { ep: "f" }, { fin: "f." }],
  },
};

export const tone5 = {
  clef: "c3",
  tenor: "h",
  flex: [{ acc: "f" }, { ep: "f" }, { fin: "f." }],
  mediant: {
    intonation: ["d", "f"],
    // source: "d f hr 'i hr h" → acc i, ep h (hr), fin h
    cadence: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["d", "f"],
    // source: "d f hr i 'i hr h" → acc i, ep h (hr), fin h
    cadence: [{ acc: "i" }, { ep: "h" }, { fin: "h." }],
  },
  // source: "hr 'i gr 'h fr f" → acc i, acc h, ep f (fr), fin f
  termination: [{ acc: "i" }, { acc: "h" }, { ep: "f" }, { fin: "f." }],
};

export const tone6 = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "g" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["f", "g"],
    // source: "f gh hr 'ixi hr 'g hr h" → 2 accents: ixi neume, g; ep h (hr), fin h
    cadence: [{ acc: "ixi" }, { acc: "g" }, { ep: "h" }, { fin: "h." }],
  },
  solemn: {
    intonation: ["f", "g"],
    // source: "f gh hr hg ixgi h hr 'hg gh" → acc hg neume, fin gh neume
    cadence: [{ acc: "hg" }, { fin: "gh." }],
  },
  // source: "hr f gh 'g fr f" → prep f, prep gh neume, acc g, ep f (fr), fin f
  termination: [{ prep: "f" }, { prep: "gh" }, { acc: "g" }, { ep: "f" }, { fin: "f." }],
};

export const tone7 = {
  clef: "c3",
  tenor: "j",
  flex: [{ acc: "i" }, { ep: "i" }, { fin: "i." }],
  mediant: {
    intonation: ["h", "h"],
    // source: "hg hi ir 'k jr 'i jr j" → acc k, acc i, ep j (jr), fin j
    cadence: [{ acc: "k" }, { acc: "i" }, { ep: "j" }, { fin: "j." }],
  },
  shortMediant: {
    intonation: ["h", "h"],
    // source: "hg hi ir" → intonation only, no cadence
    cadence: [],
  },
  solemn: {
    intonation: ["e", "h"],
    // source: "ehg hi ir 'ik jr jr 'ji ij" → acc ik neume, acc ji neume, fin ij neume
    cadence: [{ acc: "ik" }, { acc: "ji" }, { fin: "ij." }],
  },
  shortSolemn: {
    intonation: ["e", "h"],
    // source: "ehg hi ir i" → fin i only
    cadence: [{ fin: "i." }],
  },
  terminations: {
    // source: "ir 'j ir 'h hr gf" → acc j, acc h, ep h (hr), fin gf neume
    a: [{ acc: "j" }, { acc: "h" }, { ep: "h" }, { fin: "gf." }],
    // source: "ir 'j ir 'h hr gi" → acc j, acc h, ep h (hr), fin gi neume
    d: [{ acc: "j" }, { acc: "h" }, { ep: "h" }, { fin: "gi." }],
  },
};

export const tone8 = {
  clef: "c4",
  tenor: "j",
  flex: [{ acc: "h" }, { ep: "h" }, { fin: "h." }],
  mediant: {
    intonation: ["g", "h"],
    // source: "g h jr 'k jr j" → acc k, ep j (jr), fin j
    cadence: [{ acc: "k" }, { ep: "j" }, { fin: "j." }],
  },
  solemn: {
    intonation: ["g", "h"],
    // source: "g hg gj jr ji jk k 'jk jr j" → acc jk neume, ep j (jr), acc k, fin j
    cadence: [{ acc: "jk" }, { ep: "j" }, { acc: "k" }, { fin: "j." }],
  },
  terminations: {
    // source: "jr i j 'h gr g" → prep i, acc j, ep h (gr), fin g
    G: [{ prep: "i" }, { acc: "j" }, { ep: "h" }, { fin: "g." }],
    // source: "jr h j 'k jr j" → acc k, ep j (jr), fin j
    c: [{ acc: "k" }, { ep: "j" }, { fin: "j." }],
  },
};

export const per = {
  clef: "c4",
  tenor: "h",
  flex: [{ acc: "g" }, { ep: "g" }, { fin: "g." }],
  mediant: {
    intonation: ["ixhi"],
    // source: "ixhi hr ixi h 'g fr f" → acc g, ep f (fr), fin f
    cadence: [{ acc: "g" }, { ep: "f" }, { fin: "f." }],
  },
  // source: "gr d 'f fr ed" → prep d, acc f, ep f (fr), fin ed neume
  termination: [{ prep: "d" }, { acc: "f" }, { ep: "f" }, { fin: "ed." }],
};
