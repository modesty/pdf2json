const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const PDFParser = require("../dist/pdfparser.cjs");

// sortBidiTexts is exposed as a public static utility on PDFParser.
// This allows direct unit testing without depending on any internal PDFJS class.
const { sortBidiTexts } = PDFParser;

describe("sortBidiTexts", () => {
	it("should return elements in left-to-right reading order regardless of stream order", () => {
		const input = [
			{ str: "4455", x: 60, y: 10, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "label", x: 20, y: 10, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "Some", x: 5, y: 10, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "12.3", x: 45, y: 10, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
		];

		const result = sortBidiTexts(input);

		assert.deepStrictEqual(
			result.map((t) => t.str),
			["Some", "label", "12.3", "4455"]
		);
	});

	it("should sort lines top-to-bottom when multiple Y positions are present", () => {
		// bidiText Y is in PDF user space (Y grows upward), so the top line has the larger Y
		const input = [
			{ str: "Line2", x: 5, y: 10, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "Line1", x: 5, y: 30, width: 10, spaceWidth: 4, textHScale: 1, fontSize: 12 },
		];

		const result = sortBidiTexts(input);

		assert.deepStrictEqual(
			result.map((t) => t.str),
			["Line1", "Line2"]
		);
	});

	it("should group subscripts/superscripts (y offset within tolerance) into the same line", () => {
		// H2O: '2' is a subscript, y=11 is within fontSize(12) * 0.15 = 1.8 of y=10
		const input = [
			{ str: "O", x: 15, y: 10, width: 5, spaceWidth: 3, textHScale: 1, fontSize: 12 },
			{ str: "2", x: 10, y: 11, width: 5, spaceWidth: 3, textHScale: 1, fontSize: 10 },
			{ str: "H", x: 5, y: 10, width: 5, spaceWidth: 3, textHScale: 1, fontSize: 12 },
		];

		const result = sortBidiTexts(input);

		// All three should be grouped into one line, sorted by X
		assert.deepStrictEqual(
			result.map((t) => t.str),
			["H", "2", "O"]
		);
	});

	it("should not group elements whose y difference exceeds the tolerance", () => {
		// 'super' at y=15 is 5 units above 'base' at y=10 — well beyond 12*0.15=1.8
		const input = [
			{ str: "base", x: 5, y: 10, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "super", x: 5, y: 15, width: 20, spaceWidth: 4, textHScale: 1, fontSize: 12 },
		];

		const result = sortBidiTexts(input);

		// Should be two separate lines, top-to-bottom
		assert.deepStrictEqual(
			result.map((t) => t.str),
			["super", "base"]
		);
	});

	it("should keep stream order of lines that are already top-to-bottom", () => {
		// Typical content stream: first line at the top of the page (largest Y)
		const input = [
			{ str: "First", x: 72, y: 700, width: 30, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "Second", x: 72, y: 680, width: 30, spaceWidth: 4, textHScale: 1, fontSize: 12 },
			{ str: "Third", x: 72, y: 660, width: 30, spaceWidth: 4, textHScale: 1, fontSize: 12 },
		];

		const result = sortBidiTexts(input);

		assert.deepStrictEqual(
			result.map((t) => t.str),
			["First", "Second", "Third"]
		);
	});

	it("should return an empty array when given an empty array", () => {
		assert.deepStrictEqual(sortBidiTexts([]), []);
	});

	it("should return the same reference when given null or undefined", () => {
		assert.strictEqual(sortBidiTexts(null), null);
		assert.strictEqual(sortBidiTexts(undefined), undefined);
	});
});

// End to end: getRawTextContent() must print a page's lines in reading order (#442).
describe("getRawTextContent line order", () => {
	function buildPdf(content) {
		const objs = [
			"<< /Type /Catalog /Pages 2 0 R >>",
			"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
			"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
			"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
			`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
		];
		let pdf = "%PDF-1.4\n";
		const offsets = objs.map((obj, i) => {
			const offset = pdf.length;
			pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
			return offset;
		});
		const xref = pdf.length;
		pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
		pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
		pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
		return Buffer.from(pdf, "latin1");
	}

	async function rawText(content) {
		const pdfParser = new PDFParser(null, true);
		try {
			await new Promise((resolve, reject) => {
				pdfParser.once("pdfParser_dataError", (errData) => reject(errData.parserError));
				pdfParser.once("pdfParser_dataReady", resolve);
				pdfParser.parseBuffer(buildPdf(content), 0);
			});
			return pdfParser.getRawTextContent();
		} finally {
			pdfParser.destroy();
		}
	}

	const pageBreak = "----------------Page (0) Break----------------\r\n";

	it("should print lines drawn top to bottom in the same order", async () => {
		const text = await rawText(
			"BT /F1 12 Tf 72 700 Td (First line) Tj 0 -20 Td (Second line) Tj 0 -20 Td (Third line) Tj ET"
		);
		assert.strictEqual(text, `First line\r\nSecond line\r\nThird line\r\n${pageBreak}`);
	});

	it("should print lines drawn bottom to top in reading order", async () => {
		const text = await rawText(
			"BT /F1 12 Tf 72 660 Td (Third line) Tj 0 20 Td (Second line) Tj 0 20 Td (First line) Tj ET"
		);
		assert.strictEqual(text, `First line\r\nSecond line\r\nThird line\r\n${pageBreak}`);
	});

	it("should print lines in reading order under a Y-flipping CTM", async () => {
		// Many generators flip the page (1 0 0 -1 0 792 cm) and flip text back with Tm
		const text = await rawText(
			"1 0 0 -1 0 792 cm BT /F1 12 Tf 1 0 0 -1 72 92 Tm (First line) Tj 1 0 0 -1 72 112 Tm (Second line) Tj ET"
		);
		assert.strictEqual(text, `First line\r\nSecond line\r\n${pageBreak}`);
	});
});
