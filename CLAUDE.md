Developer Commands & Guidelines: Dominican Chant Engine

## 1. Project Workflow & Rules
- **Diff Approval:** Do NOT commit without showing me the diff first.
- **Conventional Commits:** Commit often using standard prefixes (`feat:`, `fix:`, `refactor:`, `chore:`).
- **Planning:** If a task is complex, plan before implementing. Respect the existing file structure and formatting.
- **Compact Instructions:** Always preserve: current task, key decisions made, files modified, next step.
- **Correction Log:** When corrected, append to `docs/claude-corrections.md` using this format:
    ### [Short description of mistake]
    - **Mistake:** What you did wrong
    - **Correction:** The right approach
    - **Rule:** General rule going forward

## 2. Before building anything, answer:
- What happens if this crashes halfway through?
- What external identifiers (models, APIs, versions) might I hardcode?
- What are the system dependencies and how do I verify them at startup?

## 3. Tech Stack & Architecture
The application lives at the repository root. The legacy v1 system has been archived to `old/` and is READ ONLY.

### Active Stack (Root Directory)
- **Tech:** Vanilla ES6 Modules (`<script type="module">`), Tailwind CSS, standard HTML5.
- **Rules:**
    - **Strict Vanilla ES6:** No module bundlers (Webpack/Vite), no React/Vue.
    - **No jQuery:** Use vanilla `document.querySelector` and standard EventListeners.
    - **Modular Design:** Isolate Exsurge initialization, Audio logic, and Export logic into shared modules in `js/core/`.
    - **UI/CSS:** Exclusively use Tailwind CSS utility classes.
- **Global dependencies (loaded as classic scripts before ES6 modules):**
    - `js/exsurge.min.js` — GABC SVG rendering (black box, do not edit)
    - `js/Tone.min.js` / `js/tones.js` — Audio synthesis (black box, do not edit)
    - `js/saveSvgAsPng.js` — SVG export helper

### Key Module Layout
- `js/core/` — shared renderer and audio services
- `js/common/` — shared utilities (compiler, parser, melody, language strategy, state, UI helpers)
- `js/languages/<code>/` — language plugins (syllabifier + registration)
- `js/tones/` — Dominican tone schemas
- `js/psalms/` — Psalm Tone Tool entry point and controllers
- `js/transcriber/` — GABC Transcriber entry point and controllers

### Legacy Archive (`old/` — READ ONLY)
The old jQuery-based system lives here. Do not modify. Reference only if porting logic.
- `old/transcriber.html.js` — legacy Transcription IDE logic
- `old/util.js` — legacy Latin syllabification and Unicode helpers
- `old/psalmtone.js` / `old/psalmtone.html.js` — legacy psalm tone pointing logic

## 4. Local Development & Verification
- **Tailwind Build:** `npm run watch:css` (compiles `src/input.css` → `css/output.css`)
- **Server:** Run a basic HTTP server from the project root to avoid CORS issues with Web Audio:
    ```bash
    npm install -g http-server
    http-server -a localhost -p 8080 --no-cache
    ```
    The `--no-cache` flag is required. Without it the browser caches ES6 modules by URL, meaning file changes are invisible until a hard-refresh. Do NOT add `?v=N` version suffixes to import statements — use `--no-cache` instead.
- **Unit tests:** `npm run test:unit`
- **Smoke tests:** `npm run test:smoke` (requires server running)
- **Verification:** Ensure `js/exsurge.min.js` renders paths correctly and audio plays without cross-origin errors.
