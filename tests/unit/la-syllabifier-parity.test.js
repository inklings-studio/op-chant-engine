import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LatinSyllabifier } from '../../js/languages/la/syllabifier.js';

// ── Old algorithm (read-only reference from old/psalmtone.js) ─────────────────
//
// regexLatin splits a Latin string into syllable matches.  Each match[3] is the
// syllable text (onset + nucleus + coda), possibly with a leading whitespace
// captured in group 4 when crossing a word boundary.
//
// The ngu/ncu special case: if a match starts with "ngu…" or "ncu…" the leading
// 'n' is moved into the PREVIOUS syllable (it was part of the previous word's
// coda in the source text but got swept into the next match by the regex).

// regexLatin copied verbatim from old/psalmtone.js line 3 — DO NOT EDIT
const regexLatin =
    /((?:<\w+>)*)(((?:(?:(\s+)|)(?:(?:i(?!i)|(?:n[cg]|q)u)(?=[aeiouyáéëíóúýǽœ́æœ])|[bcdfghjklmnprstvwxz]*)([aá]u|[ao][eé]?|[eiuyáéëíóúýǽæœ]́?)(?:(?:[\wáéíóúýǽæœ]́?)*(?=-)|(?=(?:n[cg]u|sc|[sc][tp]r?|gn|ps)[aeiouyáéëíóúýǽæœ]́?|[bcdgptf][lrh][\wáéíóúýǽæœ]́?)|(?:[bcdfghjklmnpqrstvwxz]+(?=$|[^\wáëéíóúýǽæœ])|[bcdfghjklmnpqrstvwxz](?=[bcdfghjklmnpqrstvwxz]+))?)))(?:([\*-])|((?:[^\w\sáëéíóúýǽæœ́])*(?:\s[:;†\^\*"«»''""„‟‹›‛])*\.?(?=\s|$))?)(?=(\s*|$)))((?:<\/\w+>)*)/gi;

/**
 * Apply the old regexLatin to a single plain word and return its syllables.
 *
 * The syllable text lives in match[3] (group 3 = onset+nucleus+coda, possibly
 * prefixed by word-boundary whitespace captured in group 4).  We strip that
 * leading space so the result contains only the syllable characters.
 *
 * The ngu/ncu adjustment mirrors what _getSyllables does: when a match begins
 * with "ngu…" or "ncu…" the leading 'n' is moved to the tail of the previous
 * syllable and removed from the current match[3].
 */
function oldSplit(word) {
    regexLatin.lastIndex = 0;
    const syls = [];
    let match;
    while ((match = regexLatin.exec(word)) !== null) {
        let syl = match[3]; // syllable text (group 3)
        // ngu/ncu: move leading 'n' into the previous syllable
        if (/^n[cg]u[aeiouyáéíóúýǽæœ]/i.test(match[0]) && syls.length > 0) {
            syls[syls.length - 1] += 'n';
            syl = syl.slice(1);
        }
        // strip word-boundary whitespace (group 4 value at start of group 3)
        syl = syl.replace(/^\s+/, '');
        if (syl) syls.push(syl);
    }
    return syls;
}

// ── New algorithm ─────────────────────────────────────────────────────────────

const la = new LatinSyllabifier();

function newSplit(word) {
    return la.syllabifyWord(word).syllables.map((s) => s.syl);
}

// ── Parity assertion ──────────────────────────────────────────────────────────

function parity(word) {
    const old = oldSplit(word);
    const neu = newSplit(word);
    assert.deepEqual(neu, old, `"${word}": old=[${old.join('·')}] new=[${neu.join('·')}]`);
}

// ── Monosyllables ─────────────────────────────────────────────────────────────

test('parity: et', () => parity('et'));
test('parity: in', () => parity('in'));
test('parity: non', () => parity('non'));
test('parity: est', () => parity('est'));
test('parity: ad', () => parity('ad'));
test('parity: sed', () => parity('sed'));
test('parity: vir', () => parity('vir'));
test('parity: nox', () => parity('nox'));
test('parity: lux', () => parity('lux'));
test('parity: quod', () => parity('quod'));
test('parity: qui', () => parity('qui'));
test('parity: me', () => parity('me'));
test('parity: te', () => parity('te'));
test('parity: a', () => parity('a'));
test('parity: e', () => parity('e'));

// ── 2-syllable words ──────────────────────────────────────────────────────────

test('parity: Deus', () => parity('Deus'));
test('parity: pater', () => parity('pater'));
test('parity: mater', () => parity('mater'));
test('parity: lumen', () => parity('lumen'));
test('parity: amen', () => parity('amen'));
test('parity: vita', () => parity('vita'));
test('parity: lege', () => parity('lege'));
test('parity: ejus', () => parity('ejus'));
test('parity: nocte', () => parity('nocte'));
test('parity: terra', () => parity('terra'));
test('parity: veni', () => parity('veni'));
test('parity: sedit', () => parity('sedit'));
test('parity: nóvit', () => parity('nóvit'));
test('parity: pulvis', () => parity('pulvis'));
test('parity: fáciet', () => parity('fáciet'));
test('parity: lignum', () => parity('lignum'));
test('parity: tempus', () => parity('tempus'));
test('parity: regnum', () => parity('regnum'));
test('parity: laudis', () => parity('laudis'));

// ── 3+ syllable words ─────────────────────────────────────────────────────────

test('parity: Domine', () => parity('Domine'));
test('parity: Dómini', () => parity('Dómini'));
test('parity: gloria', () => parity('gloria'));
test('parity: omnia', () => parity('omnia'));
test('parity: Dóminus', () => parity('Dóminus'));
test('parity: beátus', () => parity('beátus'));
test('parity: Beátus', () => parity('Beátus'));
test('parity: consílio', () => parity('consílio'));
test('parity: impiórum', () => parity('impiórum'));
test('parity: cáthedra', () => parity('cáthedra'));
test('parity: volúntas', () => parity('volúntas'));
test('parity: meditábitur', () => parity('meditábitur'));
test('parity: peccatórum', () => parity('peccatórum'));
test('parity: decúrsus', () => parity('decúrsus'));
test('parity: aquárum', () => parity('aquárum'));
test('parity: défluit', () => parity('défluit'));
test('parity: ómnia', () => parity('ómnia'));
test('parity: resúrgent', () => parity('resúrgent'));
test('parity: iudício', () => parity('iudício'));
test('parity: iustórum', () => parity('iustórum'));
test('parity: quóniam', () => parity('quóniam'));
test('parity: períbit', () => parity('períbit'));
test('parity: plantátum', () => parity('plantátum'));
test('parity: fólium', () => parity('fólium'));
test('parity: prospera', () => parity('prospera'));
test('parity: próspera', () => parity('próspera'));
test('parity: prósperam', () => parity('prósperam'));
test('parity: laudate', () => parity('laudate'));
test('parity: Glória', () => parity('Glória'));
test('parity: Dómino', () => parity('Dómino'));
test('parity: ómnes', () => parity('ómnes'));
test('parity: ánima', () => parity('ánima'));
test('parity: veritátem', () => parity('veritátem'));
test('parity: princípio', () => parity('princípio'));
test('parity: sǽcula', () => parity('sǽcula'));
test('parity: sæculórum', () => parity('sæculórum'));

// ── Double consonants ─────────────────────────────────────────────────────────

test('parity: mittit', () => parity('mittit'));
test('parity: stella', () => parity('stella'));
test('parity: omnis', () => parity('omnis'));
test('parity: ecce', () => parity('ecce'));
test('parity: annus', () => parity('annus'));
test('parity: mitto', () => parity('mitto'));
test('parity: summo', () => parity('summo'));
test('parity: illo', () => parity('illo'));
test('parity: illa', () => parity('illa'));

// ── MCL (muta cum liquida) clusters ───────────────────────────────────────────

test('parity: patrem', () => parity('patrem'));
test('parity: propter', () => parity('propter'));
test('parity: flumen', () => parity('flumen'));
test('parity: stabilis', () => parity('stabilis'));
test('parity: proprium', () => parity('proprium'));
test('parity: tenebris', () => parity('tenebris'));
test('parity: Christus', () => parity('Christus'));
test('parity: Christum', () => parity('Christum'));
test('parity: integram', () => parity('integram'));
test('parity: celebrant', () => parity('celebrant'));
test('parity: duplicem', () => parity('duplicem'));

// ── Diphthongs ae / oe / au ───────────────────────────────────────────────────

test('parity: caelum', () => parity('caelum'));
test('parity: caelorum', () => parity('caelorum'));
test('parity: poenam', () => parity('poenam'));
test('parity: gaudium', () => parity('gaudium'));
test('parity: laudate', () => parity('laudate'));
test('parity: praeter', () => parity('praeter'));
test('parity: aetérnum', () => parity('aetérnum'));

// ── Ligatures æ / œ ───────────────────────────────────────────────────────────

test('parity: cælum', () => parity('cælum'));
test('parity: æternum', () => parity('æternum'));
test('parity: ǽternam', () => parity('ǽternam'));
test('parity: pestiléntiæ', () => parity('pestiléntiæ'));
test('parity: sǽcula', () => parity('sǽcula'));

// ── qu rule ───────────────────────────────────────────────────────────────────

test('parity: aqua', () => parity('aqua'));
test('parity: iniqui', () => parity('iniqui'));
test('parity: iniquus', () => parity('iniquus'));
test('parity: aliquando', () => parity('aliquando'));
test('parity: relínquit', () => parity('relínquit'));
test('parity: ubíque', () => parity('ubíque'));

// ── ngu / ncu clusters ────────────────────────────────────────────────────────

test('parity: sanguis', () => parity('sanguis'));
test('parity: lingua', () => parity('lingua'));
test('parity: sanguinis', () => parity('sanguinis'));
test('parity: languor', () => parity('languor'));

// ── sc / sct / nct / ncs clusters ────────────────────────────────────────────

test('parity: sanctus', () => parity('sanctus'));
test('parity: sancti', () => parity('sancti'));
test('parity: sanctum', () => parity('sanctum'));
test('parity: sanctórum', () => parity('sanctórum'));

// ── str / scr / spl / spr onset clusters ─────────────────────────────────────

test('parity: scriptura', () => parity('scriptura'));
test('parity: spiritus', () => parity('spiritus'));
test('parity: Spíritus', () => parity('Spíritus'));

// ── gn cluster ────────────────────────────────────────────────────────────────

test('parity: agnus', () => parity('agnus'));
test('parity: dignus', () => parity('dignus'));
test('parity: regnat', () => parity('regnat'));

// ── ps / pt onset clusters ────────────────────────────────────────────────────

test('parity: psalmus', () => parity('psalmus'));
test('parity: ipse', () => parity('ipse'));
test('parity: optimus', () => parity('optimus'));

// ── i as consonant (before vowel) ─────────────────────────────────────────────

test('parity: eius', () => parity('eius'));
test('parity: iustus', () => parity('iustus'));
test('parity: maior', () => parity('maior'));
test('parity: iam', () => parity('iam'));

// ── Words from Psalm 1 ────────────────────────────────────────────────────────

test('parity: ábiit', () => parity('ábiit'));
test('parity: stetit', () => parity('stetit'));
test('parity: metábitur', () => parity('metábitur'));
test('parity: prospeRabúntur', () => parity('prospeRabúntur'));

// ── Longer / uncommon words ───────────────────────────────────────────────────

test('parity: misericórdia', () => parity('misericórdia'));
test('parity: misericordíam', () => parity('misericordíam'));
test('parity: magnificátur', () => parity('magnificátur'));
test('parity: circumdedérunt', () => parity('circumdedérunt'));
test('parity: glorificábitur', () => parity('glorificábitur'));
test('parity: benedictiónem', () => parity('benedictiónem'));
test('parity: exsultátio', () => parity('exsultátio'));
test('parity: confitébimur', () => parity('confitébimur'));
