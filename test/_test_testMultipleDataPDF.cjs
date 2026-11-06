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
		const firstPDFBuffer = fs.readFileSync(`${__dirname}/pdf/mpf/testPDF.pdf`);
		const secondPDFBuffer = fs.readFileSync(`${__dirname}/pdf/mpf/testPDF2.pdf`);

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

// Field tab indexes (TI) are numbered per document, so repeated or concurrent parses in the
// same process must not continue each other's numbering.
function tabIndexes(pdfData) {
	return pdfData.Pages.flatMap((page) => [
		...page.Fields.map((field) => field.TI),
		...page.Boxsets.flatMap((boxset) => boxset.boxes.map((box) => box.TI)),
	]);
}

describe("Field tab indexes", () => {
	const pdfBuffer = fs.readFileSync(`${__dirname}/pdf/mpf/testPDF.pdf`);

	async function parseWithNewParser() {
		const parser = new PDFParser();
		try {
			return await parsePDF(parser, pdfBuffer);
		} finally {
			parser.destroy();
		}
	}

	it("start at 0 for every document parsed in the same process", async () => {
		const first = tabIndexes(await parseWithNewParser());
		const second = tabIndexes(await parseWithNewParser());

		assert.deepStrictEqual(
			first,
			first.map((_, index) => index)
		);
		assert.ok(first.length > 0);
		assert.deepStrictEqual(second, first);
	});

	it("restart at 0 when the same parser instance parses again", async () => {
		const parser = new PDFParser();
		const first = tabIndexes(await parsePDF(parser, pdfBuffer));
		parser.removeAllListeners();
		const second = tabIndexes(await parsePDF(parser, pdfBuffer));
		parser.destroy();

		assert.deepStrictEqual(second, first);
	});

	it("are not shared between concurrent parses", async () => {
		const expected = tabIndexes(await parseWithNewParser());
		const concurrent = (await Promise.all([parseWithNewParser(), parseWithNewParser()])).map(tabIndexes);

		assert.deepStrictEqual(concurrent, [expected, expected]);
	});
});
