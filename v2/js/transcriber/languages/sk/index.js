import { registerLanguage } from '../../common/language.js';
import { syllabifyWord, syllabifyPhrase } from './syllabifier.js';

registerLanguage({
  code: 'sk',
  label: 'Slovak',
  codaPattern: /^am[eé]n[.,;:!?]*$/i,
  syllabifyWord,
  syllabifyPhrase,
});
