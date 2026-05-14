const _defaultState = () => ({
    language: 'sk',
    clef: 'c4',
    largeInitial: true,
    strophicInheritance: true,
    stanzaNumbers: false,
    annotation: '',
    font: null,
    fontSizePt: null,
    pageWidthIn: null,
    pageHeightIn: null,
    stanzas: [],
    coda: null,
});

let _state = _defaultState();

export function getState() {
    return _state;
}

export function resetState() {
    _state = _defaultState();
}
