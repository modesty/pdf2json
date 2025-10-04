const assert = require("assert");
const fs = require("fs");

const PDFParser = require("../dist/pdfparser.cjs");

// Add event listener for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Force exit when an unhandled promise rejection occurs
});

function pdfParserRunner(fileName, fromBuffer) {
	const pdfParser = new PDFParser();
	var pdfFilePath = __dirname + "/pdf/fd/form/" + fileName + ".pdf";
	
	if (fromBuffer) {
		console.log("Parsing PDF from buffer: " + pdfFilePath);
		let pdf = fs.readFileSync(pdfFilePath);
		pdfParser.parseBuffer(pdf);
	} else {
		console.log("Parsing PDF from file: " + pdfFilePath);
		pdfParser.loadPDF(pdfFilePath);
	}

	return pdfParser;
}

function checkResult_parseStatus(err, stat, fileName) {
	assert(
		err === null || typeof err === "undefined",
		fileName + " has errors : " + err || ""
	);
	assert(
		typeof stat === "object" && stat !== null,
		fileName + " parsing result should be JS object : " + stat || ""
	);
}

function checkResult_mainFields(parsedData, fileName) {
	assert(
		parsedData.hasOwnProperty("Transcoder"),
		fileName + " parsing error: doesn't have Transcoder object"
	);
	assert(
		parsedData.hasOwnProperty("Meta"),
		fileName + " parsing error: doesn't have Meta object"
	);
	assert(
		parsedData.Meta.hasOwnProperty("Metadata"),
		fileName + " parsing error: doesn't have Meta.Metadata object"
	);
	assert(
		parsedData.hasOwnProperty("Pages"),
		fileName + " parsing error: doesn't have Pages object"
	);
}

function checkResult_pageCount(Pages, count, fileName) {
	assert(
		Array.isArray(Pages),
		fileName + " parsing error: doesn't have Pages array"
	);
	assert(
		Pages.length === count,
		fileName +
			" parsing error: Pages count " +
			Pages.length +
			" not equal to " +
			count
	);

	const baseParsedFilePath = __dirname + "/data/fd/form/" + fileName + ".json";
	const { formImage: baseParsed } = JSON.parse(fs.readFileSync(baseParsedFilePath, "utf8"));

	assert(
		baseParsed.Pages.length === count,
		fileName +
			" base parsed error: Pages count " +
			baseParsed.Pages.length +
			" not equal to " +
			count
	);
	for (let i = 0; i < count; i++) {
		assert(Pages[i].Height === baseParsed.Pages[i].Height,
			fileName + " page " + i + " Height not equal");
		// assert(
		// 	Pages[i].VLines.length === baseParsed.Pages[i].VLines.length,
		// 	fileName +
		// 	" page " +
		// 	i +
		// 	" VLines count " +
		// 	Pages[i].VLines.length +
		// 	" not equal to " +
		// 	baseParsed.Pages[i].VLines.length
		// );
		// assert(
		// 	Pages[i].HLines.length === baseParsed.Pages[i].HLines.length,
		// 	fileName +
		// 	" page " +
		// 	i +
		// 	" HLines count " +
		// 	Pages[i].HLines.length +
		// 	" not equal to " +
		// 	baseParsed.Pages[i].HLines.length
		// );
		// assert(
		// 	Pages[i].Fills.length === baseParsed.Pages[i].Fills.length,
		// 	fileName +
		// 	" page " +
		// 	i +
		// 	" Fills count " +
		// 	Pages[i].Fills.length +
		// 	" not equal to " +
		// 	baseParsed.Pages[i].Fills.length
		// );
		// assert(
		// 	Pages[i].Texts.length === baseParsed.Pages[i].Texts.length,
		// 	fileName +
		// 	" page " +
		// 	i +
		// 	" Texts count " +
		// 	Pages[i].Texts.length +
		// 	" not equal to " +
		// 	baseParsed.Pages[i].Texts.length
		// );
		assert(Pages[i].Fields.length === baseParsed.Pages[i].Fields.length,
			"Fields count of page " + i + " is " + Pages[i].Fields.length + ", not equal to " + baseParsed.Pages[i].Fields.length);
		assert(Pages[i].Boxsets.length === baseParsed.Pages[i].Boxsets.length,
			"Boxsets count of page " + i + " is " + Pages[i].Boxsets.length + ", not equal to " + baseParsed.Pages[i].Boxsets.length);
	}
}

function checkResult_pageContent(Pages, fileName) {
	Pages.forEach((page, index, list) => {
		assert(
			page.hasOwnProperty("Height"),
			fileName + " page " + index + " : doesn't have Height field"
		);
		assert(
			page.hasOwnProperty("HLines"),
			fileName + " page " + index + " : doesn't have HLines object"
		);
		assert(
			page.hasOwnProperty("VLines"),
			fileName + " page " + index + " : doesn't have VLines object"
		);
		assert(
			page.hasOwnProperty("Fills"),
			fileName + " page " + index + " : doesn't have Fills object"
		);
		assert(
			page.hasOwnProperty("Texts"),
			fileName + " page " + index + " : doesn't have Texts object"
		);
		assert(
			page.hasOwnProperty("Width"),
			fileName + " page " + index + " : doesn't have With object"
		);
		assert(
			page.hasOwnProperty("Height"),
			fileName + " page " + index + " : doesn't have Height object"
		);
	});
}

function checkResult_textCoordinates(Pages, fileName) {
	// Verify text block coordinates are unique (issue #408 regression test)
	Pages.forEach((page, pageIndex) => {
		const texts = page.Texts || [];
		if (texts.length === 0) return; // Skip pages with no text

		// Collect all coordinates
		const coords = texts.map(t => ({ x: t.x, y: t.y }));

		// Create unique coordinate strings
		const uniqueCoords = new Set(coords.map(c => `${c.x},${c.y}`));

		// Check that we have more than one unique coordinate if we have multiple text elements
		// This prevents the regression where all text elements had identical coordinates (-0.25, 48.75)
		if (texts.length > 5) {
			assert(
				uniqueCoords.size > 1,
				fileName + " page " + pageIndex +
				" : all " + texts.length + " text elements have identical coordinates. " +
				"This is a regression of issue #408. Found only " + uniqueCoords.size +
				" unique coordinate(s): " + Array.from(uniqueCoords).slice(0, 3).join(", ")
			);
		}

		// Verify coordinates are reasonable (not all the same broken value)
		texts.forEach((text, textIndex) => {
			assert(
				typeof text.x === 'number' && !isNaN(text.x),
				fileName + " page " + pageIndex + " text " + textIndex +
				" : has invalid x coordinate: " + text.x
			);
			assert(
				typeof text.y === 'number' && !isNaN(text.y),
				fileName + " page " + pageIndex + " text " + textIndex +
				" : has invalid y coordinate: " + text.y
			);
		});
	});
}

async function parseAndVerifyOnePDF(fileName, fromBuffer, pageCount) {
	let timeoutId;
	let pdfParser = null;
	
	try {
		pdfParser = pdfParserRunner(fileName, fromBuffer);
		
		const pdfParserDataReady = new Promise((resolve, reject) => {
			// Setup cleanup function to avoid memory leaks
			const cleanupListeners = () => {
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
			
			pdfParser.on("pdfParser_dataReady", (evtData) => {
				cleanupListeners();
				resolve(evtData);
			});

			pdfParser.on("pdfParser_dataError", (evtData) => {
				cleanupListeners();
				reject(evtData);
			});
			
			// Add a timeout to avoid hanging
			timeoutId = setTimeout(() => {
				console.error(`*** Timeout triggered for ${fileName} after 15 seconds ***`);
				cleanupListeners();
				reject(new Error(`Parsing ${fileName} timed out after 15 seconds`));
			}, 15000);
		});

		const evtData = await pdfParserDataReady;

		expect(evtData).toBeDefined();
		checkResult_parseStatus(null, evtData, fileName);
		checkResult_mainFields(evtData, fileName);
		checkResult_pageCount(evtData.Pages, pageCount, fileName);
		checkResult_pageContent(evtData.Pages, fileName);
		checkResult_textCoordinates(evtData.Pages, fileName);
	} catch (error) {
		console.error(`Error parsing PDF ${fileName}: `, error);
		throw error; // Re-throw to ensure Jest knows the test failed
	} finally {
		// Force cleanup any references in finally block to ensure it happens even on error
		try {
			if (pdfParser) {
				// Remove all listeners that might prevent garbage collection
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
	// Using test.each for better isolation
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

	// Run each test in isolation
	test.each(testCases)('$name', async ({ fileName, fromBuffer, pageCount }) => {
		await parseAndVerifyOnePDF(fileName, fromBuffer, pageCount);
	});
});

describe("Federal schedules", () => {
	// Using test.each for better isolation
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

	// Run each test in isolation
	test.each(scheduleTestCases)('$name', async ({ fileName, fromBuffer, pageCount }) => {
		await parseAndVerifyOnePDF(fileName, fromBuffer, pageCount);
	});
});

describe("Federal other forms", () => {
	// Using test.each for better isolation
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

	// Run each test in isolation
	test.each(otherFormsTestCases)('$name', async ({ fileName, fromBuffer, pageCount }) => {
		await parseAndVerifyOnePDF(fileName, fromBuffer, pageCount);
	});
});
