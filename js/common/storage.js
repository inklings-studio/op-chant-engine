const NS = { transcriber: 'op-tc::', psalms: 'op-ps::' };

function _key(ns, name) {
    return (NS[ns] ?? ns) + name;
}

/**
 * Returns all saves for a namespace, newest-first.
 * @param {'transcriber'|'psalms'} ns
 * @returns {Array<{name: string, savedAt: number}>}
 */
export function listSaves(ns) {
    const prefix = NS[ns] ?? ns;
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) {
            const name = k.slice(prefix.length);
            try {
                const data = JSON.parse(localStorage.getItem(k));
                result.push({ name, savedAt: data?._savedAt ?? 0 });
            } catch {
                result.push({ name, savedAt: 0 });
            }
        }
    }
    return result.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Retrieves a named save. Returns parsed object or null.
 * @param {'transcriber'|'psalms'} ns
 * @param {string} name
 * @returns {object|null}
 */
export function getSave(ns, name) {
    try {
        const raw = localStorage.getItem(_key(ns, name));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Persists a named save. Throws if localStorage quota is exceeded.
 * @param {'transcriber'|'psalms'} ns
 * @param {string} name
 * @param {object} data
 */
export function putSave(ns, name, data) {
    const payload = JSON.stringify({ ...data, _savedAt: Date.now() });
    try {
        localStorage.setItem(_key(ns, name), payload);
    } catch (err) {
        throw new Error('Storage quota exceeded — delete some saves to free space.', {
            cause: err,
        });
    }
}

/**
 * Deletes a named save. Silent no-op if key does not exist.
 * @param {'transcriber'|'psalms'} ns
 * @param {string} name
 */
export function deleteSave(ns, name) {
    localStorage.removeItem(_key(ns, name));
}

/**
 * Returns true if a named save exists.
 * @param {'transcriber'|'psalms'} ns
 * @param {string} name
 * @returns {boolean}
 */
export function hasSave(ns, name) {
    return localStorage.getItem(_key(ns, name)) !== null;
}
