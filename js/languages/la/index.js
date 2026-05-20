import { registerLanguage } from '../../common/language.js';
import { LatinSyllabifier } from './syllabifier.js';

export const codaPattern = /^amen[.,;:!?]*$/i;

const psalms = Array.from({ length: 150 }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return { num: `ps_${n}`, label: `Ps. ${i + 1}` };
});

const cantica = [
    { num: 'magnificat', label: 'Magnificat' },
    { num: 'benedictus', label: 'Benedictus' },
    { num: 'nunc_dimittis', label: 'Nunc dimittis' },
    { num: 'can_annae', label: 'Cant. Annæ' },
    { num: 'can_david', label: 'Cant. David' },
    { num: 'can_ezechiae', label: 'Cant. Ezech.' },
    { num: 'can_ezechielis_36_24-28', label: 'Cant. Ez. 36,24-28' },
    { num: 'can_habacuc', label: 'Cant. Habacuc' },
    { num: 'can_habacuc_3_1-6', label: 'Cant. Hab. 3,1-6' },
    { num: 'can_habacuc_3_7-12', label: 'Cant. Hab. 3,7-12' },
    { num: 'can_habacuc_3_13-19', label: 'Cant. Hab. 3,13-19' },
    { num: 'can_isaiae', label: 'Cant. Isaiae' },
    { num: 'can_isaiae_alterum', label: 'Cant. Is. (alt.)' },
    { num: 'can_isaiae_12', label: 'Cant. Is. 12' },
    { num: 'can_isaiae_33_2-10', label: 'Cant. Is. 33,2-10' },
    { num: 'can_isaiae_33_13-18', label: 'Cant. Is. 33,13-18' },
    { num: 'can_isaiae_40_10-17', label: 'Cant. Is. 40,10-17' },
    { num: 'can_isaiae_42_10-16', label: 'Cant. Is. 42,10-16' },
    { num: 'can_isaiae_49_7-13', label: 'Cant. Is. 49,7-13' },
    { num: 'can_isaiae_63_1-5', label: 'Cant. Is. 63,1-5' },
    { num: 'can_jeremiae', label: 'Cant. Ieremiae' },
    { num: 'can_jeremiae_14_17-21', label: 'Cant. Ier. 14,17-21' },
    { num: 'can_judith', label: 'Cant. Judith' },
    { num: 'can_moysis_exod', label: 'Cant. Moys. (Exod)' },
    { num: 'can_moysis_dt32_1-18', label: 'Cant. Moys. Dt 32,1-18' },
    { num: 'can_moysis_I', label: 'Cant. Moys. I' },
    { num: 'can_moysis_II', label: 'Cant. Moys. II' },
    { num: 'can_oseae_6_1-6', label: 'Cant. Os. 6,1-6' },
    { num: 'can_sophoniae_3_8-13', label: 'Cant. Soph. 3,8-13' },
    { num: 'can_threni_5', label: 'Cant. Threni 5' },
    { num: 'can_tobiae', label: 'Cant. Tobiae' },
    { num: 'can_trium_puerorum', label: 'Cant. Trium puer.' },
    { num: 'can_ecclesiastici', label: 'Cant. Eccli.' },
    { num: 'can_ecclesiastici_monastic', label: 'Cant. Eccli. (monastic)' },
    { num: 'can_ecclesiasticae_36_14-19', label: 'Cant. Eccli. 36,14-19' },
    { num: 'can_symbolum_athanasianum', label: 'Symb. Athanasianum' },
];

registerLanguage({
    code: 'la',
    label: '✝️ Latin',
    codaPattern,
    psalms: [...psalms, ...cantica],
    syllabifier: new LatinSyllabifier(),
});
