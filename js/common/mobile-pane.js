const ACTIVE = ['tab-btn-active', 'border-op-gold', 'text-op-ink'];
const INACTIVE = ['border-transparent', 'text-op-ink-subtle'];

export function initMobilePane() {
    const editorSection = document.getElementById('editorSection');
    const previewSection = document.getElementById('previewSection');
    const tabPreviewBtn = document.getElementById('tabPreviewBtn');
    const btnBackToEditor = document.getElementById('btnBackToEditor');
    const tabEditorBtn = document.getElementById('tabEditorBtn');
    const tabGabcBtn = document.getElementById('tabGabcBtn');

    if (!tabPreviewBtn || !editorSection || !previewSection) return;

    previewSection.classList.add('mobile-hidden');

    function showPreview() {
        editorSection.classList.add('mobile-hidden');
        previewSection.classList.remove('mobile-hidden');
        tabPreviewBtn.classList.add(...ACTIVE);
        tabPreviewBtn.classList.remove(...INACTIVE);
    }

    function showEditor() {
        previewSection.classList.add('mobile-hidden');
        editorSection.classList.remove('mobile-hidden');
        tabPreviewBtn.classList.remove(...ACTIVE);
        tabPreviewBtn.classList.add(...INACTIVE);
    }

    tabPreviewBtn.addEventListener('click', showPreview);
    btnBackToEditor?.addEventListener('click', showEditor);
    tabEditorBtn?.addEventListener('click', showEditor);
    tabGabcBtn?.addEventListener('click', showEditor);
}
