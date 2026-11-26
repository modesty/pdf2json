const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const PDFParser = require("../dist/pdfparser.cjs");

const { dateToIso8601 } = PDFParser.PDFUnit;

describe("PDFUnit.dateToIso8601", () => {
	it("should convert a full date with an offset", () => {
		assert.equal(dateToIso8601("D:20220315191734-04'00'"), "2022-03-15T19:17:34-04:00");
		assert.equal(dateToIso8601("D:20220315191734+05'30"), "2022-03-15T19:17:34+05:30");
	});

	it("should default missing parts", () => {
		assert.equal(dateToIso8601("D:2022"), "2022-01-01T00:00:00Z");
		assert.equal(dateToIso8601("20220315"), "2022-03-15T00:00:00Z");
	});

	it("should output Z when Z is followed by a zero offset", () => {
		// Many PDF producers write UTC as Z00'00'
		assert.equal(dateToIso8601("D:20220315191734Z00'00'"), "2022-03-15T19:17:34Z");
		assert.equal(dateToIso8601("D:20220315191734Z00'"), "2022-03-15T19:17:34Z");
		assert.equal(dateToIso8601("D:20220315191734Z"), "2022-03-15T19:17:34Z");
	});

	it("should default offset minutes to 00 when they are missing", () => {
		// PDF spec 7.9.4: the minutes part of the offset is optional
		assert.equal(dateToIso8601("D:20220315191734-08'"), "2022-03-15T19:17:34-08:00");
		assert.equal(dateToIso8601("D:20220315191734+05"), "2022-03-15T19:17:34+05:00");
	});

	it("should always return a date that Date.parse accepts", () => {
		const inputs = [
			"D:20220315191734Z00'00'",
			"D:20220315191734-08'",
			"D:20220315191734+05",
			"D:20220315191734+05'30'",
		];
		for (const input of inputs) {
			const iso = dateToIso8601(input);
			assert.ok(!Number.isNaN(Date.parse(iso)), `${input} -> ${iso}`);
		}
	});
});
