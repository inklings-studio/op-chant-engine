/**
 * Generic UI helper functions shared between app entry points.
 */

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
