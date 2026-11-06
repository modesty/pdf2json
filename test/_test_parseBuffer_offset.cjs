const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

async function parseBuffer(buffer) {
	const pdfParser = new PDFParser(null, 1);
	try {
		return await new Promise((resolve, reject) => {
			pdfParser.once("pdfParser_dataError", (errData) =>
				reject(new Error(`parseBuffer failed: ${errData.parserError}`))
			);
			pdfParser.once("pdfParser_dataReady", resolve);
			pdfParser.parseBuffer(buffer, 0);
		});
	} finally {
		pdfParser.destroy();
	}
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

function dataView(bytes) {
	const backing = new Uint8Array(bytes.length + OFFSET * 2);
	backing.set(bytes, OFFSET);
	return new DataView(backing.buffer, OFFSET, bytes.length);
}

// Buffer.from only copies inputs smaller than half of Buffer.poolSize into the slab shared by the
// whole process. The default pool size differs between Node versions (8 KiB on Node 22) and both
// fixtures are larger than 4 KiB, so the pool size is raised while allocating; this makes the
// copy pooled, at a non-zero offset, on every supported Node version.
function pooledCopy(bytes) {
	const { poolSize } = Buffer;
	Buffer.poolSize = 1024 * 1024;
	try {
		Buffer.allocUnsafe(poolSize); // uses up the current pool, so a 1 MiB pool is started next
		Buffer.allocUnsafe(OFFSET); // takes the start of the pool that the copy will share
		return Buffer.from(bytes);
	} finally {
		Buffer.poolSize = poolSize;
	}
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

				assert.deepStrictEqual(await parseBuffer(view), expected);
			});

			it("parses a subarray surrounded by non-PDF bytes", async () => {
				const view = subarrayView(bytes);
				// Buffer.concat may itself be pooled, so the offset is at least OFFSET, not exactly.
				assert.ok(view.byteOffset >= OFFSET);

				assert.deepStrictEqual(await parseBuffer(view), expected);
			});

			it("parses a plain Uint8Array view at a non-zero byteOffset", async () => {
				const view = uint8ArrayView(bytes);
				assert.ok(!Buffer.isBuffer(view));
				assert.strictEqual(view.byteOffset, OFFSET);

				assert.deepStrictEqual(await parseBuffer(view), expected);
			});

			for (const TypedArray of [Uint16Array, Int32Array, Float32Array]) {
				it(`parses a ${TypedArray.name} view over the PDF bytes`, async () => {
					const view = typedArrayView(bytes, TypedArray);
					assert.ok(!(view instanceof Uint8Array));
					assert.strictEqual(view.byteOffset, OFFSET);
					assert.notStrictEqual(view.length, view.byteLength);

					assert.deepStrictEqual(await parseBuffer(view), expected);
				});
			}

			it("parses a DataView over the PDF bytes", async () => {
				const view = dataView(bytes);
				assert.strictEqual(view.byteOffset, OFFSET);

				assert.deepStrictEqual(await parseBuffer(view), expected);
			});

			it("parses a Buffer.from copy carved out of the shared pool", async () => {
				const pooled = pooledCopy(bytes);
				assert.ok(pooled.byteOffset > 0);
				assert.ok(pooled.buffer.byteLength > pooled.length);

				assert.deepStrictEqual(await parseBuffer(pooled), expected);
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

// Stream is internal to the bundled PDF.js engine, so its source is evaluated on its own; it only
// needs other engine globals when decoding, which these tests do not exercise.
function loadPdfJsStream() {
	const context = vm.createContext({});
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../base/core/stream.js"), "utf8"), context);
	return context.Stream;
}

describe("PDF.js Stream sub-streams", () => {
	const Stream = loadPdfJsStream();
	const bytes = Uint8Array.from([10, 11, 12, 13, 14, 15]);
	const view = new Uint8Array(new ArrayBuffer(bytes.length + OFFSET), OFFSET, bytes.length);
	view.set(bytes);

	it("is empty when zero bytes long at offset 0", () => {
		assert.strictEqual(new Stream(bytes, 0, 0).length, 0);
		assert.strictEqual(new Stream(bytes).makeSubStream(0, 0).getByte(), -1);
	});

	it("is empty when zero bytes long at a non-zero offset", () => {
		assert.strictEqual(new Stream(bytes).makeSubStream(3, 0).length, 0);
	});

	it("runs to the end of the bytes when no length is given", () => {
		assert.deepStrictEqual(Array.from(new Stream(view).makeSubStream(4).getBytes()), [14, 15]);
	});

	it("addresses a view's bytes, not its backing ArrayBuffer", () => {
		assert.deepStrictEqual(Array.from(new Stream(view).makeSubStream(1, 2).getBytes()), [11, 12]);
	});
});
