// Wraps window.exsurge (UMD global loaded via <script> in HTML).
// Do NOT import this module before exsurge.min.js has executed.

/**
 * @returns {object} A configured ChantContext instance.
 * @throws {Error} If window.exsurge is not available.
 */
export function createContext() {
  if (typeof window.exsurge === 'undefined') {
    throw new Error(
      '[renderer.js] window.exsurge is not defined. ' +
      'Ensure exsurge.min.js is loaded via <script> before this module runs.'
    );
  }

  const ctxt = new exsurge.ChantContext(exsurge.TextMeasuringStrategy.Canvas);
  ctxt.condenseLineAmount = 1;
  ctxt.setGlyphScaling(1 / 16);
  ctxt.setFont("'Crimson Text', serif", 19.2 / 0.9);
  ctxt.spaceBetweenSystems = 0;
  ctxt.textStyles.dropCap.size = 64;
  ctxt.textStyles.annotation.size = 12.8;
  ctxt.minLyricWordSpacing *= 0.7;
  ctxt.accidentalSpaceMultiplier = 1.5;

  ctxt.specialCharProperties['font-family'] = "'Versiculum'";
  ctxt.specialCharProperties['font-variant'] = 'normal';
  ctxt.specialCharProperties['font-weight'] = '400';
  const defaultSpecialCharText = ctxt.specialCharText;
  ctxt.specialCharText = function (char) {
    return defaultSpecialCharText(char).toLowerCase();
  };
  ctxt.setRubricColor('#d00');

  return ctxt;
}

/**
 * Renders GABC to an SVG node and appends it to the container.
 * Async — uses Exsurge's performLayoutAsync pipeline.
 * Returns the ChantScore so the caller can pass it back to exportSvg().
 *
 * @param {object} ctxt - A ChantContext from createContext().
 * @param {string} gabc - Raw integrated GABC string.
 * @param {HTMLElement} container - DOM element to receive the SVG.
 * @returns {object} The ChantScore instance.
 */
export function renderGabc(ctxt, gabc, container) {
  const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, gabc);
  const largeInitial = !/^\s*initial-style\s*:\s*0\s*;/m.test(gabc);
  const score = new exsurge.ChantScore(ctxt, mappings, largeInitial);

  if (largeInitial) {
    const annotationMatch = gabc.match(/^annotation:\s*(.+?)\s*;/m);
    if (annotationMatch) {
      score.annotation = new exsurge.Annotations(ctxt, '%' + annotationMatch[1] + '%');
    }
  }

  score.performLayoutAsync(ctxt, function () {
    const width = container.clientWidth;
    score.layoutChantLines(ctxt, width, function () {
      const svg = score.createSvgNode(ctxt);
      container.innerHTML = '';
      container.appendChild(svg);
    });
  });

  return score;
}

/**
 * Synchronously exports the score to a single SVG node for PNG/SVG download.
 * Must be called after at least one successful renderGabc().
 *
 * @param {object} ctxt - A ChantContext from createContext().
 * @param {object} score - The ChantScore returned by renderGabc().
 * @param {number} [widthPx=720] - Export width in px (default 7.5in @ 96dpi).
 * @returns {SVGElement}
 */
export function exportSvg(ctxt, score, widthPx = 7.5 * 96) {
  if (!score) {
    throw new Error('[renderer.js] exportSvg called before any score exists.');
  }
  score.performLayout(ctxt);
  score.layoutChantLines(ctxt, widthPx);
  return score.createSvgNode(ctxt);
}
