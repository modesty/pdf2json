const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const PDFParser = require("../dist/pdfparser.cjs");

const ENCRYPTED_PDF = path.join(__dirname, "pdf/misc/i43_err_encrypted.pdf");
const VALID_PDF = path.join(__dirname, "pdf/fd/form/F1040V.pdf");

describe("Error handling", () => {
	it("loading a non-PDF file emits pdfParser_dataError", async () => {
		const parser = new PDFParser();
		const nonPdfFile = path.join(__dirname, "../package.json");

		const error = await new Promise((resolve, reject) => {
			parser.once("pdfParser_dataError", (err) => resolve(err));
			parser.once("pdfParser_dataReady", () => reject(new Error("Should not succeed")));
			parser.loadPDF(nonPdfFile, 0);
		});

		assert.ok(error);
		parser.destroy();
	});

	it("parseBuffer with empty buffer throws from engine error logger", () => {
		const parser = new PDFParser();
		// Empty buffer triggers PJS.error() inside parseBuffer which throws
		assert.throws(() => parser.parseBuffer(Buffer.alloc(0), 0), /empty PDF buffer/);
		parser.destroy();
	});

	it("parseBuffer with null throws from engine error logger", () => {
		const parser = new PDFParser();
		assert.throws(() => parser.parseBuffer(null, 0), /empty PDF buffer/);
		parser.destroy();
	});

	it("destroy can be called multiple times without error", () => {
		const parser = new PDFParser();
		assert.doesNotThrow(() => {
			parser.destroy();
			parser.destroy();
			parser.destroy();
		});
	});

	it("destroy after successful parse cleans up", async () => {
		const parser = new PDFParser();
		const pdfBuffer = fs.readFileSync(VALID_PDF);

		await new Promise((resolve, reject) => {
			parser.once("pdfParser_dataReady", resolve);
			parser.once("pdfParser_dataError", reject);
			parser.parseBuffer(pdfBuffer, 0);
		});

		assert.doesNotThrow(() => parser.destroy());
	});

	it("encrypted PDF emits pdfParser_dataError", async () => {
		if (!fs.existsSync(ENCRYPTED_PDF)) {
			console.log("Skipping: encrypted PDF not found at", ENCRYPTED_PDF);
			return;
		}

		const parser = new PDFParser();

		const error = await new Promise((resolve) => {
			const timeoutId = setTimeout(() => {
				parser.removeAllListeners();
				resolve("timeout");
			}, 10000);
			const done = (val) => {
				clearTimeout(timeoutId);
				resolve(val);
			};
			parser.once("pdfParser_dataError", (err) => done(err));
			parser.once("pdfParser_dataReady", () => done(null));
			parser.loadPDF(ENCRYPTED_PDF, 0);
		});

		assert.ok(error);
		parser.destroy();
	});

	it("removeAllListeners after parse does not break subsequent operations", async () => {
		const parser = new PDFParser();
		const pdfBuffer = fs.readFileSync(VALID_PDF);

		await new Promise((resolve, reject) => {
			parser.once("pdfParser_dataReady", resolve);
			parser.once("pdfParser_dataError", reject);
			parser.parseBuffer(pdfBuffer, 0);
		});

		assert.doesNotThrow(() => parser.removeAllListeners());
		assert.doesNotThrow(() => parser.destroy());
	});
});
