const fs = require("fs");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const PDFParser = require("../dist/pdfparser.cjs");

// Helper: parse a PDF buffer and return parsed data via once() to avoid listener accumulation
function parsePDF(parser, pdfBuffer) {
	return new Promise((resolve, reject) => {
		parser.once("pdfParser_dataReady", (evtData) => {
			resolve(evtData);
		});
		parser.once("pdfParser_dataError", (evtData) => {
			reject(evtData);
		});
		parser.parseBuffer(pdfBuffer, 5);
	});
}

describe("Multiple PDFs with same structure", () => {
	it("Read different values", async () => {
		const parser = new PDFParser();
		const firstPDFBuffer = fs.readFileSync(__dirname + "/pdf/mpf/testPDF.pdf");
		const secondPDFBuffer = fs.readFileSync(__dirname + "/pdf/mpf/testPDF2.pdf");

		assert.notStrictEqual(firstPDFBuffer, secondPDFBuffer);

		const firstData = await parsePDF(parser, firstPDFBuffer);

		// Reset parser state between sequential parses to avoid listener accumulation
		parser.removeAllListeners();

		const secondData = await parsePDF(parser, secondPDFBuffer);

		// Verify files were read
		assert.ok(firstData);
		assert.ok(firstData.Pages[0]);
		assert.ok(firstData.Pages[0].Fields);
		assert.ok(secondData);
		assert.ok(secondData.Pages[0]);
		assert.ok(secondData.Pages[0].Fields);

		// Verify correct values from each PDF
		assert.strictEqual(firstData.Pages[0].Fields[0].V, "Mario");
		assert.strictEqual(firstData.Pages[0].Fields[1].V, "Rossi");
		assert.strictEqual(firstData.Pages[0].Fields[2].V, "01/01/1990");
		assert.strictEqual(secondData.Pages[0].Fields[0].V, "Luigi");
		assert.strictEqual(secondData.Pages[0].Fields[1].V, "Verdi");
		assert.strictEqual(secondData.Pages[0].Fields[2].V, "01/01/1991");

		parser.removeAllListeners();
		parser.destroy();
	});
});
