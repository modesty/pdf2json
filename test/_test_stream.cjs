const fs = require("fs");
const os = require("os");
const path = require("path");
const { Writable, Readable } = require("stream");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const PDFParser = require("../dist/pdfparser.cjs");
const { ParserStream, StringifyStream } = PDFParser;

const TEST_PDF = path.join(__dirname, "pdf/fd/form/F1040.pdf");

// Helper: collect all data from a readable stream into a string
function collectStream(readable) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		readable.on("data", (chunk) => chunks.push(chunk));
		readable.on("end", () => resolve(chunks.join("")));
		readable.on("error", reject);
	});
}

// Helper: parse a PDF file and return the data via promise
function parsePDFFile(pdfPath, needRawText = true) {
	return new Promise((resolve, reject) => {
		const parser = new PDFParser(null, needRawText);
		parser.once("pdfParser_dataReady", (data) => {
			resolve({ parser, data });
		});
		parser.once("pdfParser_dataError", (err) => {
			reject(err);
		});
		parser.loadPDF(pdfPath, 0);
	});
}

describe("Stream API", () => {
	it("createParserStream pipes PDF input to parsed JSON output", async () => {
		const parser = new PDFParser(null, false);
		const parserStream = parser.createParserStream();

		const collected = await new Promise((resolve, reject) => {
			const chunks = [];
			const stringify = new StringifyStream();
			const writable = new Writable({
				write(chunk, encoding, callback) {
					chunks.push(chunk.toString());
					callback();
				},
			});
			writable.on("finish", () => resolve(chunks.join("")));
			writable.on("error", reject);

			parser.on("pdfParser_dataError", reject);

			fs.createReadStream(TEST_PDF)
				.pipe(parserStream)
				.pipe(stringify)
				.pipe(writable);
		});

		const parsed = JSON.parse(collected);
		assert.ok("Pages" in parsed);
		assert.ok(parsed.Pages.length > 0);

		parser.destroy();
	});

	it("StringifyStream converts object to JSON string", async () => {
		const testData = { key: "value", nested: { arr: [1, 2, 3] } };
		const stringify = new StringifyStream();

		const input = new Readable({ objectMode: true });
		input.push(testData);
		input.push(null);

		const result = await collectStream(input.pipe(stringify));
		const parsed = JSON.parse(result);
		assert.deepStrictEqual(parsed, testData);
	});

	it("getRawTextContentStream returns readable text content", async () => {
		const { parser } = await parsePDFFile(TEST_PDF);
		const stream = parser.getRawTextContentStream();

		assert.ok(stream);
		const content = await collectStream(stream);

		assert.strictEqual(typeof content, "string");
		assert.ok(content.length > 0);
		// F1040 should contain "Form" and "1040" somewhere in its text
		assert.ok(content.includes("1040"));

		parser.destroy();
	});

	it("getAllFieldsTypesStream returns readable fields data", async () => {
		const { parser } = await parsePDFFile(TEST_PDF);
		const stream = parser.getAllFieldsTypesStream();

		assert.ok(stream);
		const stringify = new StringifyStream();
		const content = await collectStream(stream.pipe(stringify));

		const parsed = JSON.parse(content);
		assert.ok(Array.isArray(parsed));
		assert.ok(parsed.length > 0);

		parser.destroy();
	});

	it("ParserStream.createOutputStream writes to a file", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stream-test-"));
		const tmpFile = path.join(tmpDir, "stream_test_output.txt");
		const testContent = "Hello from stream test";

		try {
			await new Promise((resolve, reject) => {
				const outStream = ParserStream.createOutputStream(tmpFile, resolve, reject);
				const input = new Readable();
				input.push(testContent);
				input.push(null);
				input.pipe(outStream);
			});

			assert.ok(fs.existsSync(tmpFile));
			const written = fs.readFileSync(tmpFile, "utf8");
			assert.strictEqual(written, testContent);
		} finally {
			// Cleanup
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
