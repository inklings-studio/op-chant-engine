import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal localStorage shim ─────────────────────────────────────────────────

function makeLocalStorage() {
    const store = new Map();
    return {
        getItem(k) {
            return store.has(k) ? store.get(k) : null;
        },
        setItem(k, v) {
            store.set(k, String(v));
        },
        removeItem(k) {
            store.delete(k);
        },
        get length() {
            return store.size;
        },
        key(i) {
            return [...store.keys()][i] ?? null;
        },
        clear() {
            store.clear();
        },
    };
}

global.localStorage = makeLocalStorage();

// Import AFTER shim is in place
const { listSaves, getSave, putSave, deleteSave, hasSave } =
    await import('../../../js/common/storage.js');

beforeEach(() => {
    global.localStorage.clear();
});

// ── putSave / getSave ─────────────────────────────────────────────────────────

describe('putSave / getSave', () => {
    test('getSave returns null when key absent', () => {
        assert.equal(getSave('transcriber', 'missing'), null);
    });

    test('putSave stores and getSave retrieves same data', () => {
        putSave('transcriber', 'Hymn A', { v: 1, gabc: 'initial-style:0;\n%%\n(c4)' });
        const got = getSave('transcriber', 'Hymn A');
        assert.equal(got.v, 1);
        assert.ok(got.gabc.includes('(c4)'));
    });

    test('putSave stamps _savedAt as a number', () => {
        const before = Date.now();
        putSave('transcriber', 'ts', { v: 1 });
        const { _savedAt } = getSave('transcriber', 'ts');
        assert.ok(typeof _savedAt === 'number');
        assert.ok(_savedAt >= before);
    });

    test('namespaces are isolated: transcriber and psalms keys do not collide', () => {
        putSave('transcriber', 'shared', { tool: 'tc' });
        putSave('psalms', 'shared', { tool: 'ps' });
        assert.equal(getSave('transcriber', 'shared').tool, 'tc');
        assert.equal(getSave('psalms', 'shared').tool, 'ps');
    });

    test('putSave overwrites existing key', () => {
        putSave('transcriber', 'A', { v: 1 });
        putSave('transcriber', 'A', { v: 2 });
        assert.equal(getSave('transcriber', 'A').v, 2);
    });
});

// ── hasSave ───────────────────────────────────────────────────────────────────

describe('hasSave', () => {
    test('returns false when absent', () => {
        assert.equal(hasSave('transcriber', 'nope'), false);
    });

    test('returns true after putSave', () => {
        putSave('transcriber', 'X', { v: 1 });
        assert.equal(hasSave('transcriber', 'X'), true);
    });

    test('returns false after deleteSave', () => {
        putSave('transcriber', 'Y', { v: 1 });
        deleteSave('transcriber', 'Y');
        assert.equal(hasSave('transcriber', 'Y'), false);
    });
});

// ── deleteSave ────────────────────────────────────────────────────────────────

describe('deleteSave', () => {
    test('silent no-op when key absent', () => {
        assert.doesNotThrow(() => deleteSave('transcriber', 'ghost'));
    });

    test('removes key so getSave returns null', () => {
        putSave('psalms', 'P', { v: 1 });
        deleteSave('psalms', 'P');
        assert.equal(getSave('psalms', 'P'), null);
    });

    test('only removes the targeted key, leaves others intact', () => {
        putSave('transcriber', 'keep', { v: 1 });
        putSave('transcriber', 'drop', { v: 1 });
        deleteSave('transcriber', 'drop');
        assert.equal(hasSave('transcriber', 'keep'), true);
        assert.equal(hasSave('transcriber', 'drop'), false);
    });
});

// ── listSaves ─────────────────────────────────────────────────────────────────

describe('listSaves', () => {
    test('returns empty array when no saves', () => {
        assert.deepEqual(listSaves('transcriber'), []);
    });

    test('returns only saves for the given namespace', () => {
        putSave('transcriber', 'tc1', { v: 1 });
        putSave('psalms', 'ps1', { v: 1 });
        const list = listSaves('transcriber');
        assert.equal(list.length, 1);
        assert.equal(list[0].name, 'tc1');
    });

    test('list entries have name and savedAt fields', () => {
        putSave('psalms', 'Ps23_tone8', { v: 1 });
        const [entry] = listSaves('psalms');
        assert.equal(entry.name, 'Ps23_tone8');
        assert.ok(typeof entry.savedAt === 'number');
    });

    test('returns multiple saves newest-first', async () => {
        putSave('transcriber', 'older', { v: 1 });
        // Force a distinct timestamp
        await new Promise((r) => setTimeout(r, 5));
        putSave('transcriber', 'newer', { v: 1 });
        const list = listSaves('transcriber');
        assert.equal(list[0].name, 'newer');
        assert.equal(list[1].name, 'older');
    });
});
