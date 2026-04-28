import { registerLanguage } from '../../common/language.js';
import { syllabifyWord, syllabifyPhrase } from './syllabifier.js';

export const codaPattern = /^am[eé]n[.,;:!?]*$/i;

registerLanguage({
  code: 'sk',
  label: 'Slovak',
  codaPattern,
  syllabifyWord,
  syllabifyPhrase,
});
