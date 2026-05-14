import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPsalm } from '../../../js/psalms/loader.js';

function mockFetch(responseText, ok = true) {
    globalThis.fetch = async (url) => ({
        ok,
        status: ok ? 200 : 404,
        _url: url,
        text: async () => responseText,
    });
}

test('loadPsalm: builds correct URL for psalm id "005" (sk)', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, text: async () => 'psalm text' };
    };
    await loadPsalm('sk', '005');
    assert.equal(capturedUrl, 'js/languages/sk/psalms/005.txt');
});

test('loadPsalm: passes string id through unchanged (single-digit)', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, text: async () => '' };
    };
    await loadPsalm('sk', '001');
    assert.equal(capturedUrl, 'js/languages/sk/psalms/001.txt');
});

test('loadPsalm: passes string id through unchanged (two-digit)', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, text: async () => '' };
    };
    await loadPsalm('sk', '023');
    assert.equal(capturedUrl, 'js/languages/sk/psalms/023.txt');
});

test('loadPsalm: passes string id through unchanged (three-digit)', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, text: async () => '' };
    };
    await loadPsalm('sk', '150');
    assert.equal(capturedUrl, 'js/languages/sk/psalms/150.txt');
});

test('loadPsalm: supports canticle id (ch_iz12)', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, text: async () => '' };
    };
    await loadPsalm('sk', 'ch_iz12');
    assert.equal(capturedUrl, 'js/languages/sk/psalms/ch_iz12.txt');
});

test('loadPsalm: returns resolved text from the response', async () => {
    const expected = 'Pane, počuj moje slová, * všimni si moje vzdychanie.';
    mockFetch(expected);
    const result = await loadPsalm('sk', '005');
    assert.equal(result, expected);
});

test('loadPsalm: includes the lang code in the URL path', async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, text: async () => '' };
    };
    await loadPsalm('cs', '005');
    assert.ok(capturedUrl.includes('/cs/'), 'URL should contain the lang code segment');
});

test('loadPsalm: throws with descriptive message on 404', async () => {
    mockFetch('', false);
    await assert.rejects(
        () => loadPsalm('sk', '999'),
        (err) => {
            assert.ok(err.message.includes('999'), 'error should mention the psalm number');
            assert.ok(err.message.includes('404'), 'error should mention the HTTP status');
            return true;
        }
    );
});
