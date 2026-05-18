# Claude Corrections Log

### Browser/Playwright cache requires explicit user refresh before UI testing

- **Mistake:** After changing UI or JS files, proceeded to test in the browser (or via Playwright) without waiting for a manual page refresh, resulting in testing stale cached content.
- **Correction:** After any UI or JS change, pause the session and explicitly tell the user to refresh the browser before resuming. Do not run Playwright tests or make assertions about the rendered page until the user confirms the browser has been refreshed.
- **Rule:** Any time JS or HTML/CSS is modified, stop and ask the user to refresh before continuing with browser-based verification. The `--no-cache` flag on the dev server helps, but Playwright and browser sessions may still hold a stale page in memory. Always gate browser testing on a confirmed refresh.

### Never install Python dependencies with pip; use the project's uv venv

- **Mistake:** Ran `pip3 install requests beautifulsoup4` to satisfy script dependencies instead of using the existing virtualenv.
- **Correction:** The `scripts/` directory has a uv-managed venv at `scripts/.venv/`. Always run Python scripts with `scripts/.venv/bin/python scripts/fetch_breviar.py` (or activate with `source scripts/.venv/bin/activate`). Never run bare `pip3 install`.
- **Rule:** Before running any Python script in this repo, check for a `.venv` directory nearby and use it. Do not install packages into the system or user Python environment.
