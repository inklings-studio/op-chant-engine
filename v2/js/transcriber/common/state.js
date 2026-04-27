const _defaultState = () => ({
  language: 'sk',
  clef: 'c4',
  largeInitial: true,
  strophicInheritance: true,
  rawText: '',
  stanzas: [],
  coda: null,
});

let _state = _defaultState();

export function getState() { return _state; }

export function resetState() { _state = _defaultState(); }

export function serializeState() {
  return JSON.stringify(_state);
}

export function restoreState(json) {
  try {
    const parsed = JSON.parse(json);
    // Basic shape validation
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.stanzas)) {
      throw new Error('invalid shape');
    }
    _state = parsed;
  } catch {
    _state = _defaultState();
  }
}
