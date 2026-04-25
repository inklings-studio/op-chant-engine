 Developer Commands & Guidelines: Dominican Chant Engine (v2 Refactor)

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
We are executing a "Strangler Fig" refactor. The repository contains two distinct systems side-by-side:

### Legacy Stack (Root Directory - **READ ONLY**)
- **Tech:** jQuery, static HTML/JS, zero build step.
- **Dependencies:** `exsurge.min.js` (GABC rendering), `Tone.js` (Audio), Moment.js.
- **Constraint:** DO NOT modify or delete the legacy root `.html` or `.js` files until Milestone 3. You will read these files to port logic to `v2/`.

### V2 Stack (`v2/` Directory - **ACTIVE DEV**)
- **Tech:** Vanilla ES6 Modules (`<script type="module">`), Tailwind CSS, standard HTML5.
- **Rules:** - **Strict Vanilla ES6:** No module bundlers (Webpack/Vite), no React/Vue.
    - **No jQuery:** Use vanilla `document.querySelector` and standard EventListeners in `v2/`.
    - **Modular Design:** Isolate Exsurge initialization, Audio logic, and Export logic into shared modules in `v2/js/core/`.
    - **UI/CSS:** Exclusively use Tailwind CSS utility classes.

## 4. Local Development & Verification
- **Tailwind Build:** `npm run watch:css` (Runs tailwindcss CLI to compile `v2/src/input.css` to `v2/css/output.css`)
- **Server:** Run a basic HTTP server from the project root to avoid CORS issues with Web Audio:
    ```bash
    npm install -g http-server
    http-server -a localhost -p 8080 --no-cache
    ```
    The `--no-cache` flag is required. Without it the browser caches ES6 modules by URL, meaning file changes are invisible until a hard-refresh. Do NOT add `?v=N` version suffixes to import statements — use `--no-cache` instead.
- **Verification:** Ensure `exsurge.min.js` renders paths correctly in the new DOM and audio plays without cross-origin errors.

## 5. Legacy System Map (For Logic Porting)
When porting logic to `v2/`, reference these legacy files:
- **`transcriber.html.js`**: Contains the core logic for the Transcription IDE.
- **`util.js`**: Core utilities, including Latin syllabification regex and Unicode helpers. Read this before touching text-processing logic.
- **`psalmtone.js`** / **`psalmtone.html.js`**: Psalm tone algorithmic pointing logic.
- **`exsurge.min.js`**: Third-party GABC rendering library; do not edit.

## 6. Data Flow (Legacy Transcriber Reference)
1. User pastes raw GABC + Latin text.
2. `transcriber.html.js` calls regex patterns from `util.js` for Latin syllabification.
3. `applyGabc()` maps syllables to GABC notes.
4. Output: properly underlay-marked GABC rendered by Exsurge.
*(Note: In v2, this logic must be decoupled and moved to `v2/js/core/` and specific tool controllers).*