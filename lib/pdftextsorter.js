/**
 * Ratio used to compute the Y-axis grouping tolerance for a text element.
 * A text element with fontSize 12pt yields tolerance 12 * 0.15 = 1.8pt.
 * This absorbs normal subscript/superscript baseline shifts while keeping
 * genuinely different lines separate.
 */
const BASELINE_TOLERANCE_RATIO = 0.15;

/**
 * Spatial Sort: Sort an array of bidiText objects into spatial reading order:
 *   1. Group elements into horizontal lines by their Y coordinate, using a
 *      font-size-proportional tolerance to keep subscripts/superscripts on
 *      the same line as their base characters.
 *   2. Sort the resulting lines top-to-bottom (ascending Y).
 *   3. Within each line, sort elements left-to-right (ascending X).
 *
 * The original array is not mutated; a new sorted flat array is returned.
 *
 * @param {Array<{str:string, x:number, y:number, width:number, spaceWidth:number, textHScale:number, fontSize?:number}>} bidiTexts
 * @returns {typeof bidiTexts}
 */
function sortBidiTexts(bidiTexts) {
  if (!bidiTexts || bidiTexts.length === 0) return bidiTexts;

  // — Phase 1: bucket elements into line groups by Y ——————————————————————
  const lines = [];

  for (const textObj of bidiTexts) {
    const tolerance = (textObj.fontSize || 12) * BASELINE_TOLERANCE_RATIO;
    let foundLine = null;

    for (const line of lines) {
      // Compare against the Y of the first element added to the line.
      // Using the group's representative Y keeps the bucket anchor stable
      // even when mixed-size fonts appear consecutively.
      if (Math.abs(textObj.y - line[0].y) <= tolerance) {
        foundLine = line;
        break;
      }
    }

    if (foundLine) {
      foundLine.push(textObj);
    } else {
      lines.push([textObj]);
    }
  }

  // — Phase 2: sort lines top-to-bottom ——————————————————————————————————
  lines.sort((a, b) => a[0].y - b[0].y);

  // — Phase 3: sort elements within each line left-to-right ——————————————
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
  }

  return lines.flat();
}

export { BASELINE_TOLERANCE_RATIO, sortBidiTexts };
