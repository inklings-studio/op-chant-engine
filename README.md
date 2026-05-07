# Dominican Chant Engine

Client-side tools for editing, pointing, and rendering Gregorian chant according to Dominican tones. Runs entirely in the browser — no server required — and deploys as a static GitHub Page.

## Tools

### GABC Transcriber (`transcriber.html`)
A manual IDE for composing and rendering GABC notation. Features a two-tab editor:
- **Interlinear Tracker** — per-line melody inputs with a real-time alignment track, strophic inheritance across stanzas, and automatic Amen coda detection.
- **Integrated GABC** — raw GABC editor with bi-directional sync to the tracker.

SVG preview updates live via Exsurge. Supports pitch transposition and PNG/SVG export.

### Psalm Tone Tool (`psalms.html`)
An algorithmic pointer that takes raw psalm text, syllabifies it using a language plugin, maps it to a Dominican tone template, and auto-generates GABC. Currently supports Slovak with the full set of Dominican tones (tones 1–8 with all terminations).

## Installation & Local Development

```bash
npm install
npm run watch:css   # compiles src/input.css → css/output.css (keep running while editing)
```

Serve from the project root — the tools require a real HTTP origin for Web Audio and Exsurge's canvas measurements:

```bash
npx http-server . -a localhost -p 8080 --no-cache
```

Then open:
- `http://localhost:8080/transcriber.html`
- `http://localhost:8080/psalms.html`

> The `--no-cache` flag is required. Without it the browser caches ES6 modules by URL and file changes are invisible until a hard-refresh.

## Running Tests

```bash
npm run test:unit    # Node built-in test runner — no server needed
npm run test:smoke   # Playwright end-to-end tests — requires the http-server above
```

## Contributing: Adding a New Language

Language support is a drop-in plugin. To add, say, Czech (`cs`):

**1. Create `js/languages/cs/syllabifier.js`**

Implement `syllabifyWord(word: string): string[]` and export `syllabifyPhrase` built with the shared factory:

```js
import { createPhraseSyllabifier } from '../../common/language.js';

const VOWELS = new Set([...'aeiouáéíóúůAEIOUÁÉÍÓÚŮ']);
const UNSTRESSED_MONOSYLLABLES = new Set(['a', 'i', 'v', 'z', 'k', 'o', 'u', 'se', 'si']);
const hasNucleus = word => [...word].some(c => VOWELS.has(c));

export function syllabifyWord(word) {
  // ... language-specific FSM ...
}

export const syllabifyPhrase = createPhraseSyllabifier({
  syllabifyWord,
  hasNucleus,
  unstressedMonosyllables: UNSTRESSED_MONOSYLLABLES,
});
```

**2. Create `js/languages/cs/index.js`**

Register the plugin and list available psalm texts:

```js
import { registerLanguage } from '../../common/language.js';
import { syllabifyWord, syllabifyPhrase } from './syllabifier.js';

registerLanguage({
  code: 'cs',
  label: 'Czech',
  codaPattern: /^am[eé]n[.,;:!?]*$/i,
  syllabifyWord,
  syllabifyPhrase,
  psalms: [
    { num: 22, label: 'Ž. 22' },
  ],
});
```

Add psalm text files as `js/languages/cs/psalms/022.txt` (one verse per line, `†` for flex, `*` for mediant).

**3. Register in `js/psalms/app.js`**

Add one import line alongside the existing language imports:

```js
import '../languages/cs/index.js';
```

**4. Add the UI option in `psalms.html`**

```html
<option value="cs">Czech</option>
```

**5. Add tests under `tests/unit/`**

Follow the pattern in `tests/unit/sk-syllabifier.test.js` for syllabification edge cases.

## Tech Stack

- **Vanilla ES6 Modules** — no bundlers (Webpack/Vite), no frameworks (React/Vue)
- **Tailwind CSS** (CLI build) — utility-first styling with the Dominican OP theme
- **Exsurge** — third-party GABC → SVG rendering library (`js/exsurge.min.js`)
- **Tone.js** — Web Audio synthesis for chant playback