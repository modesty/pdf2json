const fs = require("fs");

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
	expect(err === null || typeof err === "undefined").toBe(true);
	expect(typeof stat === "object" && stat !== null).toBe(true);
}

function checkResult_mainFields(parsedData, fileName) {
	expect(parsedData).toHaveProperty("Transcoder");
	expect(parsedData).toHaveProperty("Meta");
	expect(parsedData.Meta).toHaveProperty("Metadata");
	expect(parsedData).toHaveProperty("Pages");
}

function checkResult_pageCount(Pages, count, fileName) {
	expect(Array.isArray(Pages)).toBe(true);
	expect(Pages.length).toBe(count);

	const baseParsedFilePath = __dirname + "/data/fd/form/" + fileName + ".json";
	const { formImage: baseParsed } = JSON.parse(fs.readFileSync(baseParsedFilePath, "utf8"));

	expect(baseParsed.Pages.length).toBe(count);

	for (let i = 0; i < count; i++) {
		expect(Pages[i].Height).toBe(baseParsed.Pages[i].Height);
		expect(Pages[i].VLines.length).toBe(baseParsed.Pages[i].VLines.length);
		expect(Pages[i].HLines.length).toBe(baseParsed.Pages[i].HLines.length);
		expect(Pages[i].Fills.length).toBe(baseParsed.Pages[i].Fills.length);
		expect(Pages[i].Texts.length).toBe(baseParsed.Pages[i].Texts.length);
		expect(Pages[i].Fields.length).toBe(baseParsed.Pages[i].Fields.length);
		expect(Pages[i].Boxsets.length).toBe(baseParsed.Pages[i].Boxsets.length);
	}
}

function checkResult_pageContent(Pages, fileName) {
	Pages.forEach((page, index) => {
		expect(page).toHaveProperty("Height");
		expect(page).toHaveProperty("HLines");
		expect(page).toHaveProperty("VLines");
		expect(page).toHaveProperty("Fills");
		expect(page).toHaveProperty("Texts");
		expect(page).toHaveProperty("Width");
	});
}

function checkResult_textCoordinates(Pages, fileName) {
	Pages.forEach((page, pageIndex) => {
		const texts = page.Texts || [];
		if (texts.length === 0) return;

		const coords = texts.map(t => ({ x: t.x, y: t.y }));
		const uniqueCoords = new Set(coords.map(c => `${c.x},${c.y}`));

		// Regression test for issue #408: all text elements had identical coordinates
		if (texts.length > 5) {
			expect(uniqueCoords.size).toBeGreaterThan(1);
		}

		texts.forEach((text) => {
			expect(typeof text.x).toBe('number');
			expect(isNaN(text.x)).toBe(false);
			expect(typeof text.y).toBe('number');
			expect(isNaN(text.y)).toBe(false);
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

		expect(evtData).toBeDefined();
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

	test.each(testCases)('$name', async ({ fileName, fromBuffer, pageCount }) => {
		await parseAndVerifyOnePDF(fileName, fromBuffer, pageCount);
	});
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

	test.each(scheduleTestCases)('$name', async ({ fileName, fromBuffer, pageCount }) => {
		await parseAndVerifyOnePDF(fileName, fromBuffer, pageCount);
	});
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

	test.each(otherFormsTestCases)('$name', async ({ fileName, fromBuffer, pageCount }) => {
		await parseAndVerifyOnePDF(fileName, fromBuffer, pageCount);
	});
});
