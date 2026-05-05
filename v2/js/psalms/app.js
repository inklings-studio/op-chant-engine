import { createContext, renderGabc } from '../core/renderer.js';
import { pointVerse } from './pointer.js';
import { generateGabc, generateBreviaryHtml } from './formatter.js';
import { syllabifyPhrase } from '../languages/sk/syllabifier.js';
import {
  tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per,
} from '../tones/dominican.js';

const TONES = { tone1, tone2, tone3, tone4, tone4alt, tone5, tone6, tone7, tone8, per };
const TONE_LABELS = {
  tone1: 'Tone 1', tone2: 'Tone 2', tone3: 'Tone 3',
  tone4: 'Tone 4', tone4alt: 'Tone 4 (alt)', tone5: 'Tone 5',
  tone6: 'Tone 6', tone7: 'Tone 7', tone8: 'Tone 8', per: 'Peregrinus',
};

let ctxt = null;
let score = null;
let _debounceTimer = null;

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setStatus(msg) {
  document.getElementById('statusMessage').textContent = msg;
}

function clearOutput() {
  document.getElementById('gabcOutput').value = '';
  const preview = document.getElementById('chantPreview');
  preview.innerHTML = '<p id="previewPlaceholder" class="text-sm text-gray-400 italic text-center mt-8">Enter verses to see a preview.</p>';
  document.getElementById('breviaryPreview').innerHTML = '';
  setStatus('');
}

function onToneChange() {
  const tone = TONES[document.getElementById('toneSelect').value];
  const termSelect = document.getElementById('termSelect');
  const keys = tone.terminations ? Object.keys(tone.terminations) : ['—'];
  termSelect.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
  onInput();
}

function onInput() {
  const tone = TONES[document.getElementById('toneSelect').value];
  const cadenceKey = document.getElementById('termSelect').value;
  const isSolemn = document.getElementById('solemnCheck').checked;
  const lines = document.getElementById('psalmInput').value
    .split('\n').map(l => l.trim()).filter(Boolean);

  if (!lines.length) { clearOutput(); return; }

  try {
    const ast1 = pointVerse(lines[0], tone, cadenceKey, isSolemn, syllabifyPhrase);
    const gabcBody = generateGabc(ast1);
    const fullGabc = `initial-style: 0;\n%%\n(${tone.clef}) ${gabcBody}(::)\n`;

    document.getElementById('gabcOutput').value = fullGabc;
    const preview = document.getElementById('chantPreview');
    score = renderGabc(ctxt, fullGabc, preview);

    const items = lines.slice(1).map(line => {
      try {
        const ast = pointVerse(line, tone, cadenceKey, isSolemn, syllabifyPhrase);
        return `<li>${generateBreviaryHtml(ast)}</li>`;
      } catch (e) {
        return `<li class="text-red-500">${escapeHtml(line)} — ${escapeHtml(e.message)}</li>`;
      }
    });
    document.getElementById('breviaryPreview').innerHTML = items.join('');
    setStatus('');
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
}

function onInputDebounced() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(onInput, 300);
}

function init() {
  try {
    ctxt = createContext();
  } catch (e) {
    setStatus(`Renderer unavailable: ${e.message}`);
    return;
  }

  const toneSelect = document.getElementById('toneSelect');
  toneSelect.innerHTML = Object.entries(TONE_LABELS)
    .map(([k, label]) => `<option value="${k}">${label}</option>`)
    .join('');
  // Default to Tone 8
  toneSelect.value = 'tone8';

  toneSelect.addEventListener('change', onToneChange);
  document.getElementById('psalmInput').addEventListener('input', onInputDebounced);
  document.getElementById('solemnCheck').addEventListener('change', onInput);

  onToneChange();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
