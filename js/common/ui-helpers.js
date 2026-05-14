/**
 * Generic UI helper functions shared between app entry points.
 */

// ─── Persistence modals ───────────────────────────────────────────────────────

function _guard() {
    return !!document.querySelector('dialog[data-op-modal]');
}

function _makeDialog() {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('data-op-modal', '');
    dlg.className = 'op-modal-panel';
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    return dlg;
}

function _btn(label, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = `op-modal-btn ${cls}`;
    return b;
}

function _buildList(container, saves, onLoad, onDelete) {
    container.innerHTML = '';
    if (!saves.length) {
        const p = document.createElement('p');
        p.className = 'op-modal-list-empty';
        p.textContent = 'No saved items.';
        container.appendChild(p);
        return;
    }
    saves.forEach(({ name }) => {
        const item = document.createElement('div');
        item.className = 'op-modal-list-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'op-modal-list-item-name';
        nameSpan.textContent = name;
        nameSpan.title = name;

        const delBtn = _btn('×', 'op-modal-btn-danger');
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', () => {
            onDelete(name);
            item.remove();
            if (!container.querySelector('.op-modal-list-item')) {
                const p = document.createElement('p');
                p.className = 'op-modal-list-empty';
                p.textContent = 'No saved items.';
                container.appendChild(p);
            }
        });

        item.appendChild(nameSpan);

        if (onLoad) {
            const loadBtn = _btn('Load', 'op-modal-btn-ghost');
            loadBtn.addEventListener('click', () => onLoad(name));
            item.appendChild(loadBtn);
        }

        item.appendChild(delBtn);
        container.appendChild(item);
    });
}

/**
 * Shows a save modal with a name input and a list of existing saves.
 *
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {string}   opts.defaultName  — pre-filled value for the name input
 * @param {Array}    opts.saves        — [{name, savedAt}] from listSaves()
 * @param {function} opts.onSave       — (name) → return true to close, false to stay open
 * @param {function} opts.onDelete     — (name) → void
 * @returns {{ close(): void }}
 */
export function showSaveModal({ title, defaultName, saves, onSave, onDelete }) {
    if (_guard()) return { close() {} };

    const dlg = _makeDialog();

    const h = document.createElement('p');
    h.className = 'op-modal-title';
    h.textContent = title ?? 'Save';
    dlg.appendChild(h);

    // Name input row
    const row = document.createElement('div');
    row.className = 'op-modal-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'op-modal-input';
    input.value = defaultName ?? '';
    input.placeholder = 'Enter name…';
    input.spellcheck = false;

    const saveBtn = _btn('Save', 'op-modal-btn-primary');
    const cancelBtn = _btn('Cancel', 'op-modal-btn-ghost');

    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);
    dlg.appendChild(row);

    const errP = document.createElement('p');
    errP.className = 'op-modal-error';
    dlg.appendChild(errP);

    // Saved items list
    let _saves = [...saves];
    const list = document.createElement('div');
    list.className = 'op-modal-list';
    _buildList(list, _saves, null, (name) => {
        onDelete(name);
        _saves = _saves.filter((s) => s.name !== name);
    });
    dlg.appendChild(list);

    // Overwrite-confirm state
    let _pendingOverwrite = null;

    function _resetConfirm() {
        saveBtn.textContent = 'Save';
        saveBtn.classList.remove('confirming');
        _pendingOverwrite = null;
        errP.textContent = '';
    }

    input.addEventListener('input', _resetConfirm);

    function _doSave() {
        const name = input.value.trim();
        if (!name) {
            errP.textContent = 'Name cannot be empty.';
            input.focus();
            return;
        }
        errP.textContent = '';

        const exists = _saves.some((s) => s.name === name);
        if (exists && _pendingOverwrite !== name) {
            _pendingOverwrite = name;
            saveBtn.textContent = 'Overwrite?';
            saveBtn.classList.add('confirming');
            return;
        }

        const ok = onSave(name);
        if (ok !== false) dlg.close();
    }

    saveBtn.addEventListener('click', _doSave);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            _doSave();
        }
        if (e.key === 'Escape') dlg.close();
    });
    cancelBtn.addEventListener('click', () => dlg.close());

    dlg.showModal();
    // Select all pre-filled text so the user can immediately type a new name
    if (input.value) input.select();

    return {
        close() {
            dlg.close();
        },
    };
}

/**
 * Shows a load modal — a named-item list with Load + Delete actions.
 *
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {Array}    opts.saves    — [{name, savedAt}] from listSaves()
 * @param {function} opts.onLoad   — (name) → void; dialog closes automatically
 * @param {function} opts.onDelete — (name) → void
 * @returns {{ close(): void }}
 */
export function showLoadModal({ title, saves, onLoad, onDelete }) {
    if (_guard()) return { close() {} };

    const dlg = _makeDialog();

    const h = document.createElement('p');
    h.className = 'op-modal-title';
    h.textContent = title ?? 'Load';
    dlg.appendChild(h);

    let _saves = [...saves];
    const list = document.createElement('div');
    list.className = 'op-modal-list';
    list.style.cssText = 'margin-top:0; border-top:none; padding-top:0;';
    _buildList(
        list,
        _saves,
        (name) => {
            onLoad(name);
            dlg.close();
        },
        (name) => {
            onDelete(name);
            _saves = _saves.filter((s) => s.name !== name);
        }
    );
    dlg.appendChild(list);

    const cancelRow = document.createElement('div');
    cancelRow.style.cssText = 'margin-top:12px; display:flex; justify-content:flex-end;';
    const cancelBtn = _btn('Cancel', 'op-modal-btn-ghost');
    cancelBtn.addEventListener('click', () => dlg.close());
    cancelRow.appendChild(cancelBtn);
    dlg.appendChild(cancelRow);

    dlg.showModal();
    return {
        close() {
            dlg.close();
        },
    };
}

export function formatPitch(tonesMapIdx) {
    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const octave = Math.floor(tonesMapIdx / 12);
    const name = noteNames[((tonesMapIdx % 12) + 12) % 12];
    return name + '<sub>' + octave + '</sub>';
}

export function formatPitchName(tonesMapIdx) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[((tonesMapIdx % 12) + 12) % 12];
}

export function positionToolbar(toolbar, anchorEl) {
    if (!anchorEl) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const toolbarH = toolbar.offsetHeight;
    const toolbarW = toolbar.offsetWidth;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    let top = anchorRect.top + scrollTop - toolbarH - 6;
    let left = anchorRect.left + scrollLeft + anchorRect.width / 2 - toolbarW / 2;

    // If toolbar would go above the document, flip below
    if (top < scrollTop + 4) top = anchorRect.bottom + scrollTop + 6;

    // Clamp horizontally
    left = Math.max(scrollLeft + 8, Math.min(left, scrollLeft + window.innerWidth - toolbarW - 8));

    toolbar.style.top = top + 'px';
    toolbar.style.left = left + 'px';
}
