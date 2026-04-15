const fs = require("fs");
const path = require("path");
const { Writable, Readable } = require("stream");

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
	test("createParserStream pipes PDF input to parsed JSON output", async () => {
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
		expect(parsed).toHaveProperty("Pages");
		expect(parsed.Pages.length).toBeGreaterThan(0);

		parser.destroy();
	});

	test("StringifyStream converts object to JSON string", async () => {
		const testData = { key: "value", nested: { arr: [1, 2, 3] } };
		const stringify = new StringifyStream();

		const input = new Readable({ objectMode: true });
		input.push(testData);
		input.push(null);

		const result = await collectStream(input.pipe(stringify));
		const parsed = JSON.parse(result);
		expect(parsed).toEqual(testData);
	});

	test("getRawTextContentStream returns readable text content", async () => {
		const { parser } = await parsePDFFile(TEST_PDF);
		const stream = parser.getRawTextContentStream();

		expect(stream).toBeDefined();
		const content = await collectStream(stream);

		expect(typeof content).toBe("string");
		expect(content.length).toBeGreaterThan(0);
		// F1040 should contain "Form" and "1040" somewhere in its text
		expect(content).toContain("1040");

		parser.destroy();
	});

	test("getAllFieldsTypesStream returns readable fields data", async () => {
		const { parser } = await parsePDFFile(TEST_PDF);
		const stream = parser.getAllFieldsTypesStream();

		expect(stream).toBeDefined();
		const stringify = new StringifyStream();
		const content = await collectStream(stream.pipe(stringify));

		const parsed = JSON.parse(content);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBeGreaterThan(0);

		parser.destroy();
	});

	test("ParserStream.createOutputStream writes to a file", async () => {
		const tmpFile = path.join(__dirname, "target", "stream_test_output.txt");
		const testContent = "Hello from stream test";

		await new Promise((resolve, reject) => {
			const outStream = ParserStream.createOutputStream(tmpFile, resolve, reject);
			const input = new Readable();
			input.push(testContent);
			input.push(null);
			input.pipe(outStream);
		});

		expect(fs.existsSync(tmpFile)).toBe(true);
		const written = fs.readFileSync(tmpFile, "utf8");
		expect(written).toBe(testContent);

		// Cleanup
		fs.unlinkSync(tmpFile);
	});
});
