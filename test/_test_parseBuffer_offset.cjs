const fs = require("fs");
const path = require("path");
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

const PDFParser = require("../dist/pdfparser.cjs");

// PDF.js sub-streams used to be built from the backing ArrayBuffer with absolute positions,
// so any input whose backing store was not exactly the PDF (pooled Buffers, offset views,
// subarrays, wider typed arrays) parsed garbage. Every variant must now parse identically to
// an owned, zero-offset copy. Both xref flavours are covered because classic tables and
// xref streams take different code paths once the trailer is located.
const fixtures = [
	{
		kind: "classic xref table",
		file: "misc/i64_schedule_generator.pdf",
		checkContent: (page) => assert.ok(page.Texts.length > 0),
	},
	{
		kind: "xref stream",
		file: "misc/i369_3fields.pdf",
		checkContent: (page) => assert.strictEqual(page.Fields.length, 3),
	},
];

const OFFSET = 1024;

function parseBuffer(buffer) {
	return new Promise((resolve, reject) => {
		const pdfParser = new PDFParser(null, 1);
		pdfParser.on("pdfParser_dataError", (errData) =>
			reject(new Error(`parseBuffer failed: ${errData.parserError}`))
		);
		pdfParser.on("pdfParser_dataReady", (pdfData) => {
			pdfParser.destroy();
			resolve(pdfData);
		});
		pdfParser.parseBuffer(buffer, 0);
	});
}

// Field tab indexes (TI) come from a process-wide counter, so they differ between
// parses of the same document and are not meaningful for comparing results.
function withoutTabIndexes(pdfData) {
	return JSON.parse(JSON.stringify(pdfData, (key, value) => (key === "TI" ? undefined : value)));
}

function assertSameParse(actual, expected) {
	assert.deepStrictEqual(withoutTabIndexes(actual), withoutTabIndexes(expected));
}

function readFixture(file) {
	return fs.readFileSync(path.join(__dirname, "pdf", file));
}

function ownedCopy(bytes) {
	return Buffer.from(new Uint8Array(bytes).buffer);
}

function offsetView(bytes) {
	const view = Buffer.from(new ArrayBuffer(bytes.length + OFFSET), OFFSET, bytes.length);
	view.set(bytes);
	return view;
}

function subarrayView(bytes) {
	const padded = Buffer.concat([Buffer.alloc(OFFSET, 0xff), bytes, Buffer.alloc(OFFSET, 0xff)]);
	return padded.subarray(OFFSET, OFFSET + bytes.length);
}

function uint8ArrayView(bytes) {
	const backing = new Uint8Array(bytes.length + OFFSET * 2);
	backing.set(bytes, OFFSET);
	return backing.subarray(OFFSET, OFFSET + bytes.length);
}

// Typed arrays with wider elements cannot start at an arbitrary byte offset, nor cover an odd
// number of bytes, so the backing store is padded to the element size at both ends.
// The trailing padding byte(s) sit after %%EOF and do not affect parsing.
function typedArrayView(bytes, TypedArray) {
	const { BYTES_PER_ELEMENT } = TypedArray;
	const length = Math.ceil(bytes.length / BYTES_PER_ELEMENT);
	const backing = new Uint8Array(OFFSET + (length + 1) * BYTES_PER_ELEMENT);
	backing.set(bytes, OFFSET);
	return new TypedArray(backing.buffer, OFFSET, length);
}

describe("parseBuffer with buffers that do not own their ArrayBuffer", () => {
	for (const { kind, file, checkContent } of fixtures) {
		describe(`${kind} (${file})`, () => {
			const bytes = readFixture(file);
			let expected;

			before(async () => {
				const owned = ownedCopy(bytes);
				assert.strictEqual(owned.byteOffset, 0);
				assert.strictEqual(owned.buffer.byteLength, owned.length);

				expected = await parseBuffer(owned);
			});

			it("parses an owned, zero-offset buffer (baseline)", () => {
				assert.strictEqual(expected.Pages.length, 1);
				checkContent(expected.Pages[0]);
			});

			it("parses a Buffer view at a non-zero byteOffset", async () => {
				const view = offsetView(bytes);
				assert.strictEqual(view.byteOffset, OFFSET);
				assert.notStrictEqual(view.buffer.byteLength, view.length);

				assertSameParse(await parseBuffer(view), expected);
			});

			it("parses a subarray surrounded by non-PDF bytes", async () => {
				const view = subarrayView(bytes);
				// Buffer.concat may itself be pooled, so the offset is at least OFFSET, not exactly.
				assert.ok(view.byteOffset >= OFFSET);

				assertSameParse(await parseBuffer(view), expected);
			});

			it("parses a plain Uint8Array view at a non-zero byteOffset", async () => {
				const view = uint8ArrayView(bytes);
				assert.ok(!Buffer.isBuffer(view));
				assert.strictEqual(view.byteOffset, OFFSET);

				assertSameParse(await parseBuffer(view), expected);
			});

			for (const TypedArray of [Uint16Array, Int32Array, Float32Array]) {
				it(`parses a ${TypedArray.name} view over the PDF bytes`, async () => {
					const view = typedArrayView(bytes, TypedArray);
					assert.ok(!(view instanceof Uint8Array));
					assert.strictEqual(view.byteOffset, OFFSET);
					assert.notStrictEqual(view.length, view.byteLength);

					assertSameParse(await parseBuffer(view), expected);
				});
			}

			it("parses a Buffer.from copy, which may be carved out of the shared pool", async () => {
				const pooled = Buffer.from(bytes);
				// The pool is shared process-wide, so the offset depends on prior allocations.
				assertSameParse(await parseBuffer(pooled), expected);
			});

			it("does not mutate the caller's buffer", async () => {
				const view = offsetView(bytes);
				const snapshot = Buffer.from(view);

				await parseBuffer(view);
				assert.ok(view.equals(snapshot));
			});
		});
	}
});
