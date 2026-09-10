const fs = require("fs");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const PDFParser = require("../dist/pdfparser.cjs");

// Add event listener for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

function pdfParserRunner(fileName, fromBuffer) {
	const pdfParser = new PDFParser();
	const pdfFilePath = __dirname + "/pdf/fd/form/" + fileName + ".pdf";

	if (fromBuffer) {
		console.log("Parsing PDF from buffer: " + pdfFilePath);
		const pdf = fs.readFileSync(pdfFilePath);
		pdfParser.parseBuffer(pdf);
	} else {
		console.log("Parsing PDF from file: " + pdfFilePath);
		pdfParser.loadPDF(pdfFilePath);
	}

	return pdfParser;
}

function checkResult_parseStatus(err, stat, fileName) {
	assert.ok(err === null || typeof err === "undefined");
	assert.ok(typeof stat === "object" && stat !== null);
}

function checkResult_mainFields(parsedData, fileName) {
	assert.ok("Transcoder" in parsedData);
	assert.ok("Meta" in parsedData);
	assert.ok("Metadata" in parsedData.Meta);
	assert.ok("Pages" in parsedData);
}

function checkResult_pageCount(Pages, count, fileName) {
	assert.ok(Array.isArray(Pages));
	assert.strictEqual(Pages.length, count);

	const baseParsedFilePath = __dirname + "/data/fd/form/" + fileName + ".json";
	const { formImage: baseParsed } = JSON.parse(fs.readFileSync(baseParsedFilePath, "utf8"));

	assert.strictEqual(baseParsed.Pages.length, count);

	for (let i = 0; i < count; i++) {
		assert.strictEqual(Pages[i].Height, baseParsed.Pages[i].Height);
		assert.strictEqual(Pages[i].VLines.length, baseParsed.Pages[i].VLines.length);
		assert.strictEqual(Pages[i].HLines.length, baseParsed.Pages[i].HLines.length);
		assert.strictEqual(Pages[i].Fills.length, baseParsed.Pages[i].Fills.length);
		assert.strictEqual(Pages[i].Texts.length, baseParsed.Pages[i].Texts.length);
		assert.strictEqual(Pages[i].Fields.length, baseParsed.Pages[i].Fields.length);
		assert.strictEqual(Pages[i].Boxsets.length, baseParsed.Pages[i].Boxsets.length);
	}
}

function checkResult_pageContent(Pages, fileName) {
	Pages.forEach((page) => {
		assert.ok("Height" in page);
		assert.ok("HLines" in page);
		assert.ok("VLines" in page);
		assert.ok("Fills" in page);
		assert.ok("Texts" in page);
		assert.ok("Width" in page);
	});
}

function checkResult_textCoordinates(Pages, fileName) {
	Pages.forEach((page) => {
		const texts = page.Texts || [];
		if (texts.length === 0) return;

		const coords = texts.map(t => ({ x: t.x, y: t.y }));
		const uniqueCoords = new Set(coords.map(c => `${c.x},${c.y}`));

		// Regression test for issue #408: all text elements had identical coordinates
		if (texts.length > 5) {
			assert.ok(uniqueCoords.size > 1);
		}

		texts.forEach((text) => {
			assert.strictEqual(typeof text.x, 'number');
			assert.ok(!isNaN(text.x));
			assert.strictEqual(typeof text.y, 'number');
			assert.ok(!isNaN(text.y));
		});
	});
}

async function parseAndVerifyOnePDF(fileName, fromBuffer, pageCount) {
	let timeoutId;
	let pdfParser = null;

	try {
		pdfParser = pdfParserRunner(fileName, fromBuffer);

		const evtData = await new Promise((resolve, reject) => {
			const cleanup = () => {
				try {
					if (pdfParser) {
						pdfParser.removeAllListeners("pdfParser_dataReady");
						pdfParser.removeAllListeners("pdfParser_dataError");
					}
				} catch (e) {
					console.error("Error during listener cleanup:", e);
				}
				if (timeoutId) clearTimeout(timeoutId);
			};

			pdfParser.on("pdfParser_dataReady", (data) => {
				cleanup();
				resolve(data);
			});

			pdfParser.on("pdfParser_dataError", (data) => {
				cleanup();
				reject(data);
			});

			timeoutId = setTimeout(() => {
				cleanup();
				reject(new Error(`Parsing ${fileName} timed out after 15 seconds`));
			}, 15000);
		});

		assert.ok(evtData !== undefined);
		checkResult_parseStatus(null, evtData, fileName);
		checkResult_mainFields(evtData, fileName);
		checkResult_pageCount(evtData.Pages, pageCount, fileName);
		checkResult_pageContent(evtData.Pages, fileName);
		checkResult_textCoordinates(evtData.Pages, fileName);
	} catch (error) {
		console.error(`Error parsing PDF ${fileName}:`, error);
		throw error;
	} finally {
		try {
			if (pdfParser) {
				pdfParser.removeAllListeners();
				pdfParser.destroy();
				pdfParser = null;
			}
		} catch (e) {
			console.error(`Error during cleanup for ${fileName}:`, e);
		}
	}
}

describe("Federal main forms", () => {
	const testCases = [
		{ name: "1040ez from file", fileName: "F1040EZ", fromBuffer: false, pageCount: 2 },
		{ name: "1040ez from buffer", fileName: "F1040EZ", fromBuffer: true, pageCount: 2 },
		{ name: "1040a from file", fileName: "F1040A", fromBuffer: false, pageCount: 2 },
		{ name: "1040a from buffer", fileName: "F1040A", fromBuffer: true, pageCount: 2 },
		{ name: "1040 from file", fileName: "F1040", fromBuffer: false, pageCount: 2 },
		{ name: "1040 from buffer", fileName: "F1040", fromBuffer: true, pageCount: 2 },
		{ name: "1040st from file", fileName: "F1040ST", fromBuffer: false, pageCount: 2 },
		{ name: "1040st from buffer", fileName: "F1040ST", fromBuffer: true, pageCount: 2 },
		{ name: "1040V from file", fileName: "F1040V", fromBuffer: false, pageCount: 1 },
		{ name: "1040V from buffer", fileName: "F1040V", fromBuffer: true, pageCount: 1 }
	];

	for (const tc of testCases) {
		it(tc.name, { timeout: 30000 }, async () => {
			await parseAndVerifyOnePDF(tc.fileName, tc.fromBuffer, tc.pageCount);
		});
	}
});

describe("Federal schedules", () => {
	const scheduleTestCases = [
		{ name: "Fed Schedule A", fileName: "FSCHA", fromBuffer: false, pageCount: 1 },
		{ name: "Fed Schedule B", fileName: "FSCHB", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule B2", fileName: "FSCHB2", fromBuffer: false, pageCount: 1 },
		{ name: "Fed Schedule B3", fileName: "FSCHB3", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule C", fileName: "FSCHC", fromBuffer: true, pageCount: 2 },
		{ name: "Fed Schedule CEZS", fileName: "FSCHCEZS", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule CEZT", fileName: "FSCHCEZT", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule D", fileName: "FSCHD", fromBuffer: true, pageCount: 2 },
		{ name: "Fed Schedule E1", fileName: "FSCHE1", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule E2", fileName: "FSCHE2", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule EIC", fileName: "FSCHEIC", fromBuffer: true, pageCount: 1 },
		{ name: "Fed Schedule F", fileName: "FSCHF", fromBuffer: true, pageCount: 2 },
		{ name: "Fed Schedule HS", fileName: "FSCHHS", fromBuffer: true, pageCount: 2 },
		{ name: "Fed Schedule HT", fileName: "FSCHHT", fromBuffer: true, pageCount: 2 },
		{ name: "Fed Schedule J", fileName: "FSCHJ", fromBuffer: true, pageCount: 2 },
		{ name: "Fed Schedule R", fileName: "FSCHR", fromBuffer: true, pageCount: 2 }
	];

	for (const tc of scheduleTestCases) {
		it(tc.name, { timeout: 30000 }, async () => {
			await parseAndVerifyOnePDF(tc.fileName, tc.fromBuffer, tc.pageCount);
		});
	}
});

describe("Federal other forms", () => {
	const otherFormsTestCases = [
		{ name: "F982", fileName: "F982", fromBuffer: false, pageCount: 1 },
		{ name: "F1116", fileName: "F1116", fromBuffer: false, pageCount: 2 },
		{ name: "F1310", fileName: "F1310", fromBuffer: false, pageCount: 1 },
		{ name: "F2106", fileName: "F2106", fromBuffer: false, pageCount: 2 },
		{ name: "F2106EZ", fileName: "F2106EZ", fromBuffer: false, pageCount: 1 },
		{ name: "F2106EZS", fileName: "F2106EZS", fromBuffer: false, pageCount: 1 },
		{ name: "F2106S", fileName: "F2106S", fromBuffer: false, pageCount: 2 },
		{ name: "F2120", fileName: "F2120", fromBuffer: false, pageCount: 1 },
		{ name: "F2210", fileName: "F2210", fromBuffer: false, pageCount: 3 },
		{ name: "F2210AI", fileName: "F2210AI", fromBuffer: false, pageCount: 1 },
		{ name: "F2210F", fileName: "F2210F", fromBuffer: false, pageCount: 1 },
		{ name: "F2439", fileName: "F2439", fromBuffer: false, pageCount: 1 },
		{ name: "F2441", fileName: "F2441", fromBuffer: false, pageCount: 2 },
		{ name: "F2441DEP", fileName: "F2441DEP", fromBuffer: false, pageCount: 1 },
		{ name: "F2555EZ", fileName: "F2555EZ", fromBuffer: false, pageCount: 2 },
		{ name: "F2555EZS", fileName: "F2555EZS", fromBuffer: false, pageCount: 2 }
	];

	for (const tc of otherFormsTestCases) {
		it(tc.name, { timeout: 30000 }, async () => {
			await parseAndVerifyOnePDF(tc.fileName, tc.fromBuffer, tc.pageCount);
		});
	}
});
