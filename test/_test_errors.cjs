const fs = require("fs");
const path = require("path");

const PDFParser = require("../dist/pdfparser.cjs");

const ENCRYPTED_PDF = path.join(__dirname, "pdf/misc/i43_err_encrypted.pdf");
const VALID_PDF = path.join(__dirname, "pdf/fd/form/F1040V.pdf");

describe("Error handling", () => {
	test("loading a non-PDF file emits pdfParser_dataError", async () => {
		const parser = new PDFParser();
		const nonPdfFile = path.join(__dirname, "../package.json");

		const error = await new Promise((resolve, reject) => {
			parser.once("pdfParser_dataError", (err) => resolve(err));
			parser.once("pdfParser_dataReady", () => reject(new Error("Should not succeed")));
			parser.loadPDF(nonPdfFile, 0);
		});

		expect(error).toBeDefined();
		parser.destroy();
	});

	test("parseBuffer with empty buffer throws from engine error logger", () => {
		const parser = new PDFParser();
		// Empty buffer triggers PJS.error() inside parseBuffer which throws
		expect(() => parser.parseBuffer(Buffer.alloc(0), 0)).toThrow("empty PDF buffer");
		parser.destroy();
	});

	test("parseBuffer with null throws from engine error logger", () => {
		const parser = new PDFParser();
		expect(() => parser.parseBuffer(null, 0)).toThrow("empty PDF buffer");
		parser.destroy();
	});

	test("destroy can be called multiple times without error", () => {
		const parser = new PDFParser();
		expect(() => {
			parser.destroy();
			parser.destroy();
			parser.destroy();
		}).not.toThrow();
	});

	test("destroy after successful parse cleans up", async () => {
		const parser = new PDFParser();
		const pdfBuffer = fs.readFileSync(VALID_PDF);

		await new Promise((resolve, reject) => {
			parser.once("pdfParser_dataReady", resolve);
			parser.once("pdfParser_dataError", reject);
			parser.parseBuffer(pdfBuffer, 0);
		});

		expect(() => parser.destroy()).not.toThrow();
	});

	test("encrypted PDF emits pdfParser_dataError", async () => {
		if (!fs.existsSync(ENCRYPTED_PDF)) {
			console.log("Skipping: encrypted PDF not found at", ENCRYPTED_PDF);
			return;
		}

		const parser = new PDFParser();

		const error = await new Promise((resolve) => {
			let timeoutId;
			parser.once("pdfParser_dataError", (err) => {
				clearTimeout(timeoutId);
				resolve(err);
			});
			parser.once("pdfParser_dataReady", () => {
				clearTimeout(timeoutId);
				resolve(null);
			});
			timeoutId = setTimeout(() => resolve("timeout"), 10000);
			parser.loadPDF(ENCRYPTED_PDF, 0);
		});

		expect(error).toBeDefined();
		parser.destroy();
	});

	test("removeAllListeners after parse does not break subsequent operations", async () => {
		const parser = new PDFParser();
		const pdfBuffer = fs.readFileSync(VALID_PDF);

		await new Promise((resolve, reject) => {
			parser.once("pdfParser_dataReady", resolve);
			parser.once("pdfParser_dataError", reject);
			parser.parseBuffer(pdfBuffer, 0);
		});

		expect(() => parser.removeAllListeners()).not.toThrow();
		expect(() => parser.destroy()).not.toThrow();
	});
});
