const PDFParser = require("../dist/pdfparser.cjs");

// sortBidiTexts is exposed as a public static utility on PDFParser.
// This allows direct unit testing without depending on any internal PDFJS class.
const { sortBidiTexts } = PDFParser;

describe("sortBidiTexts", () => {
  test("should return elements in left-to-right reading order regardless of stream order", () => {
    const input = [
      { str: "4455", x: 60, y: 10, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
      { str: "label", x: 20, y: 10, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
      { str: "Some", x: 5, y: 10, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
      { str: "12.3", x: 45, y: 10, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
    ];

    const result = sortBidiTexts(input);

    expect(result.map(t => t.str)).toEqual(["Some", "label", "12.3", "4455"]);
  });

  test("should sort lines top-to-bottom when multiple Y positions are present", () => {
    const input = [
      { str: "Line2", x: 5, y: 30, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
      { str: "Line1", x: 5, y: 10, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
    ];

    const result = sortBidiTexts(input);

    expect(result.map(t => t.str)).toEqual(["Line1", "Line2"]);
  });

  test("should group subscripts/superscripts (y offset within tolerance) into the same line", () => {
    // H2O: '2' is a subscript, y=11 is within fontSize(12) * 0.15 = 1.8 of y=10
    const input = [
      { str: "O", x: 15, y: 10, width: 5, spaceWidth: 3, textHScale: 1, fontSize: 12 },
      { str: "2", x: 10, y: 11, width: 5, spaceWidth: 3, textHScale: 1, fontSize: 10 },
      { str: "H", x: 5, y: 10, width: 5, spaceWidth: 3, textHScale: 1, fontSize: 12 },
    ];

    const result = sortBidiTexts(input);

    // All three should be grouped into one line, sorted by X
    expect(result.map(t => t.str)).toEqual(["H", "2", "O"]);
  });

  test("should not group elements whose y difference exceeds the tolerance", () => {
    // 'super' at y=5 is 5 units above 'base' at y=10 — well beyond 12*0.15=1.8
    const input = [
      { str: "base", x: 5, y: 10, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
      { str: "super", x: 5, y: 5, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
    ];

    const result = sortBidiTexts(input);

    // Should be two separate lines, top-to-bottom
    expect(result.map(t => t.str)).toEqual(["super", "base"]);
  });

  test("should return an empty array when given an empty array", () => {
    expect(sortBidiTexts([])).toEqual([]);
  });

  test("should return the same reference when given null or undefined", () => {
    expect(sortBidiTexts(null)).toBeNull();
    expect(sortBidiTexts(undefined)).toBeUndefined();
  });
});
