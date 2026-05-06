/**
 * Fetches a psalm text file for the given language and psalm number.
 * Files live at: js/languages/{langCode}/psalms/{padded num}.txt
 * URL resolves relative to the HTML document (v2/psalms.html), not this module.
 *
 * @param {string} langCode  e.g. 'sk'
 * @param {number} psalmNum  e.g. 5
 * @returns {Promise<string>}
 */
export async function loadPsalm(langCode, psalmNum) {
  const padded = String(psalmNum).padStart(3, '0');
  const res = await fetch(`js/languages/${langCode}/psalms/${padded}.txt`);
  if (!res.ok) throw new Error(`Psalm ${psalmNum} not found (${res.status})`);
  return res.text();
}
