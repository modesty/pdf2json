const fs = require("fs");

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
	test("Read different values", async () => {
		const parser = new PDFParser();
		const firstPDFBuffer = fs.readFileSync(__dirname + "/pdf/mpf/testPDF.pdf");
		const secondPDFBuffer = fs.readFileSync(__dirname + "/pdf/mpf/testPDF2.pdf");

		expect(firstPDFBuffer).not.toBe(secondPDFBuffer);

		const firstData = await parsePDF(parser, firstPDFBuffer);

		// Reset parser state between sequential parses to avoid listener accumulation
		parser.removeAllListeners();

		const secondData = await parsePDF(parser, secondPDFBuffer);

		// Verify files were read
		expect(firstData).toBeDefined();
		expect(firstData.Pages[0]).toBeDefined();
		expect(firstData.Pages[0].Fields).toBeDefined();
		expect(secondData).toBeDefined();
		expect(secondData.Pages[0]).toBeDefined();
		expect(secondData.Pages[0].Fields).toBeDefined();

		// Verify correct values from each PDF
		expect(firstData.Pages[0].Fields[0].V).toBe("Mario");
		expect(firstData.Pages[0].Fields[1].V).toBe("Rossi");
		expect(firstData.Pages[0].Fields[2].V).toBe("01/01/1990");
		expect(secondData.Pages[0].Fields[0].V).toBe("Luigi");
		expect(secondData.Pages[0].Fields[1].V).toBe("Verdi");
		expect(secondData.Pages[0].Fields[2].V).toBe("01/01/1991");

		parser.removeAllListeners();
		parser.destroy();
	});
});
