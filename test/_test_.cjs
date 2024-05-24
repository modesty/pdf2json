const assert = require("assert");
const fs = require("fs");

const PDFParser = require("../dist/pdfparser.cjs");

function pdfParserRunner(fileName, fromBuffer) {
	const pdfParser = new PDFParser();

	var pdfFilePath = __dirname + "/pdf/fd/form/" + fileName + ".pdf";
	if (fromBuffer) {
		pdf = fs.readFileSync(pdfFilePath);
		pdfParser.parseBuffer(pdf);
	} else {
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

async function parseAndVerifyOnePDF(fileName, fromBuffer, pageCount) {
	const pdfParser = pdfParserRunner(fileName, fromBuffer);
	const pdfParserDataReady = new Promise((resolve, reject) => {
		pdfParser.on("pdfParser_dataReady", (evtData) => {
			resolve(evtData);
		});

		pdfParser.on("pdfParser_dataError", (evtData) => {
			reject(evtData);
		});
	});

	try {
		const evtData = await pdfParserDataReady;
		expect(evtData).toBeDefined();
		checkResult_parseStatus(null, evtData, fileName);
		checkResult_mainFields(evtData, fileName);
		checkResult_pageCount(evtData.Pages, pageCount, fileName);
		checkResult_pageContent(evtData.Pages, fileName);
	} catch (error) {
		console.error("Error: ", error);
		expect(error).toBeNull();
	}
}

describe("Federal main forms", () => {
	test("1040ez file and buffer", async () => {
		await parseAndVerifyOnePDF("F1040EZ", false, 2);
		await parseAndVerifyOnePDF("F1040EZ", true, 2);
	});
	test("1040a file and buffer", async () => {
		await parseAndVerifyOnePDF("F1040A", false, 2);
		await parseAndVerifyOnePDF("F1040A", true, 2);
	});
	test("1040 file and buffer", async () => {
		await parseAndVerifyOnePDF("F1040", false, 2);
		await parseAndVerifyOnePDF("F1040", true, 2);
	});
	test("1040st file and buffer", async () => {
		await parseAndVerifyOnePDF("F1040ST", false, 2);
		await parseAndVerifyOnePDF("F1040ST", true, 2);
	});
	test("1040V file and buffer", async () => {
		await parseAndVerifyOnePDF("F1040V", false, 1);
		await parseAndVerifyOnePDF("F1040V", true, 1);
	});
});

describe("Federal schedules", () => {
	test("Fed Schedule A", async () => {
		await parseAndVerifyOnePDF("FSCHA", false, 1);
	});
	test("Fed Schedule B, B2, B3", async () => {
		await parseAndVerifyOnePDF("FSCHB", true, 1);
		await parseAndVerifyOnePDF("FSCHB2", false, 1);
		await parseAndVerifyOnePDF("FSCHB3", true, 1);
	});
	test("Fed schedule C, CEZS, CEZT", async () => {
		await parseAndVerifyOnePDF("FSCHC", true, 2);
		await parseAndVerifyOnePDF("FSCHCEZS", true, 1);
		await parseAndVerifyOnePDF("FSCHCEZT", true, 1);
	});
	test("Fed schedule D", async () => {
		await parseAndVerifyOnePDF("FSCHD", true, 2);
	});
	test("Fed schedule E1, E2, EIC", async () => {
		await parseAndVerifyOnePDF("FSCHE1", true, 1);
		await parseAndVerifyOnePDF("FSCHE2", true, 1);
		await parseAndVerifyOnePDF("FSCHEIC", true, 1);
	});
	test("Fed schedule F", async () => {
		await parseAndVerifyOnePDF("FSCHF", true, 2);
	});
	test("Fed schedule H HS, HT", async () => {
		await parseAndVerifyOnePDF("FSCHHS", true, 2);
		await parseAndVerifyOnePDF("FSCHHT", true, 2);
	});
	test("Fed schedule J", async () => {
		await parseAndVerifyOnePDF("FSCHJ", true, 2);
	});
	test("Fed schedule R", async () => {
		await parseAndVerifyOnePDF("FSCHR", true, 2);
	});
});

describe("Federal other forms", () => {
	test("F982", async () => {
		await parseAndVerifyOnePDF("F982", false, 1);
	});
	test("F1116", async () => {
		await parseAndVerifyOnePDF("F1116", false, 2);
	});
	test("F1310", async () => {
		await parseAndVerifyOnePDF("F1310", false, 1);
	});
	test("F2106, EZ, EZS, S", async () => {
		await parseAndVerifyOnePDF("F2106", false, 2);
		await parseAndVerifyOnePDF("F2106EZ", false, 1);
		await parseAndVerifyOnePDF("F2106EZS", false, 1);
		await parseAndVerifyOnePDF("F2106S", false, 2);
	});
	test("F2120", async () => {
		await parseAndVerifyOnePDF("F2120", false, 1);
	});
	test("F2210, AI, F", async () => {
		await parseAndVerifyOnePDF("F2210", false, 3);
		await parseAndVerifyOnePDF("F2210AI", false, 1);
		await parseAndVerifyOnePDF("F2210F", false, 1);
	});
	test("F2439", async () => {
		await parseAndVerifyOnePDF("F2439", false, 1);
	});
	test("F2441, DEP", async () => {
		await parseAndVerifyOnePDF("F2441", false, 2);
		await parseAndVerifyOnePDF("F2441DEP", false, 1);
	});
	test("F2555EZ, EZS", async () => {
		await parseAndVerifyOnePDF("F2555EZ", false, 2);
		await parseAndVerifyOnePDF("F2555EZS", false, 2);
	});
});
