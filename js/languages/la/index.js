import { registerLanguage } from '../../common/language.js';
import { LatinSyllabifier } from './syllabifier.js';

export const codaPattern = /^amen[.,;:!?]*$/i;

const psalms = Array.from({ length: 150 }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return { num: `ps_${n}`, label: `Ps. ${i + 1}` };
});

registerLanguage({
    code: 'la',
    label: '✝️ Latin',
    codaPattern,
    psalms,
    syllabifier: new LatinSyllabifier(),
});
