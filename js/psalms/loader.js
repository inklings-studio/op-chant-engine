/**
 * Fetches a psalm text file for the given language and psalm id.
 * Files live at: js/languages/{langCode}/psalms/{psalmId}.txt
 * URL resolves relative to the HTML document (v2/psalms.html), not this module.
 *
 * @param {string} langCode  e.g. 'sk'
 * @param {string} psalmId   e.g. '005' or 'ch_iz12'
 * @returns {Promise<string>}
 */
export async function loadPsalm(langCode, psalmId) {
    const res = await fetch(`js/languages/${langCode}/psalms/${psalmId}.txt`);
    if (!res.ok) throw new Error(`Psalm ${psalmId} not found (${res.status})`);
    return res.text();
}
