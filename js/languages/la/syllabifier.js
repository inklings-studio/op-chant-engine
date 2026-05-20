import { Syllabifier } from '../../common/language.js';

// Unicode combining acute accent
const COMBINING_ACCENT = '́';

// Precomposed accented Latin vowels (including æ/œ variants)
const ACCENTED_VOWELS = new Set([...'áéíóúýǽÁÉÍÓÚÝǼ']);

// regexLatin copied verbatim from old/psalmtone.js line 3 — DO NOT EDIT
const regexLatin =
    /((?:<\w+>)*)(((?:(?:(\s+)|)(?:(?:i(?!i)|(?:n[cg]|q)u)(?=[aeiouyáéëíóúýǽœ́æœ])|[bcdfghjklmnprstvwxz]*)([aá]u|[ao][eé]?|[eiuyáéëíóúýǽæœ]́?)(?:(?:[\wáéíóúýǽæœ]́?)*(?=-)|(?=(?:n[cg]u|sc|[sc][tp]r?|gn|ps)[aeiouyáéëíóúýǽæœ]́?|[bcdgptf][lrh][\wáéíóúýǽæœ]́?)|(?:[bcdfghjklmnpqrstvwxz]+(?=$|[^\wáëéíóúýǽæœ])|[bcdfghjklmnpqrstvwxz](?=[bcdfghjklmnpqrstvwxz]+))?)))(?:([\*-])|((?:[^\w\sáëéíóúýǽæœ́])*(?:\s[:;†\^\*"«»''""„‟‹›‛])*\.?(?=\s|$))?)(?=(\s*|$)))((?:<\/\w+>)*)/gi;

function _splitWord(word) {
    regexLatin.lastIndex = 0;
    const syls = [];
    let match;
    while ((match = regexLatin.exec(word)) !== null) {
        let syl = match[3];
        // ngu/ncu: move leading 'n' into the previous syllable
        if (/^n[cg]u[aeiouyáéíóúýǽæœ]/i.test(match[0]) && syls.length > 0) {
            syls[syls.length - 1] += 'n';
            syl = syl.slice(1);
        }
        syl = syl.replace(/^\s+/, '');
        if (syl) syls.push(syl);
    }
    return syls;
}

function isAccented(syl) {
    for (const ch of syl) {
        if (ACCENTED_VOWELS.has(ch) || ch === COMBINING_ACCENT) return true;
    }
    return false;
}

export class LatinSyllabifier extends Syllabifier {
    /**
     * @param {string} word
     * @returns {import('../../common/language.js').WordResult}
     */
    syllabifyWord(word) {
        if (!word) return { hasNucleus: false, syllables: [] };

        const syls = _splitWord(word);
        if (syls.length === 0) return { hasNucleus: false, syllables: [] };

        // Find stressed syllable by accent mark; fall back to penultimate
        let stressedIdx = syls.findIndex(isAccented);
        if (stressedIdx === -1) {
            stressedIdx = syls.length <= 1 ? 0 : syls.length - 2;
        }

        return {
            hasNucleus: true,
            syllables: syls.map((syl, i) => ({ syl, isStressed: i === stressedIdx })),
        };
    }
}
