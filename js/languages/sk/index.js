import { registerLanguage } from '../../common/language.js';
import { SlovakSyllabifier } from './syllabifier.js';

export const codaPattern = /^am[eé]n[.,;:!?]*$/i;

registerLanguage({
  code: 'sk',
  label: '🇸🇰 Slovak',
  codaPattern,
  syllabifier: new SlovakSyllabifier(),
  psalms: [
    { num: 5, label: 'Ž. 5' },
  ],
});
