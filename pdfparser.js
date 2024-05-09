import fs from "fs";
import nodeUtil from "util";
import { readFile } from "fs/promises";
import { EventEmitter } from "events";

import PDFJS from "./lib/pdf.js";
import { ParserStream, StringifyStream } from "./lib/parserstream.js";
import { kColors, kFontFaces, kFontStyles } from "./lib/pdfconst.js";
import { pkInfo, _PARSER_SIG } from "./lib/pkinfo.js";
import PDFUnit from "./lib/pdfunit.js";

/**
 * Class representing a PDF Parser.
 * @class PDFParser
 * @extends EventEmitter
 */
export default class PDFParser extends EventEmitter {
	/**
	 * Static method to retrieve color dictionary.
	 * @returns {object} Color dictionary
	 */
	static get colorDict() {
		return kColors;
	}

	/**
	 * Static method to retrieve font face dictionary.
	 * @returns {object} Font face dictionary
	 */
	static get fontFaceDict() {
		return kFontFaces;
	}

	/**
	 * Static method to retrieve font style dictionary.
	 * @returns {object} Font style dictionary
	 */
	static get fontStyleDict() {
		return kFontStyles;
	}

	/**
	 * static property to expose PDFUnit class
	 * @returns {PDFUnit} PDFUnit class
	 */
	static get PDFUnit() {
		return PDFUnit;
	}

	/**
	 * static property to expose ParserStream class
	 */
	static get ParserStream() {
		return ParserStream;
	}

	/**
	 * static property to expose StringifyStream class
	 */
	static get StringifyStream() {
		return StringifyStream;
	}

	/**
	 * static property to expose pkInfo function
	 */
	static get pkInfo() {
		return pkInfo;
	}

	/**
	 * static property to expose _PARSER_SIG string
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	static get _PARSER_SIG() {
		return _PARSER_SIG;
	}

	static #maxBinBufferCount = 10;
	static #binBuffer = {};

	#password = "";
	#context = null; // service context object, only used in Web Service project; null in command line	    #pdfFilePath = null;
	#pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started	    #data = null;
	#pdfFileMTime = null; // last time the current pdf was modified, used to recognize changes and ignore cache	    #PDFJS = null;
	#data = null; //if file read success, data is PDF content; if failed, data is "err" object	    #processFieldInfoXML = false;
	#PDFJS = null; //will be initialized in constructor
	#processFieldInfoXML = false; //disable additional _fieldInfo.xml parsing and merging (do NOT set to true)

	/**
	 * PDFParser constructor.
	 * @constructor PDFParser class.
	 * @param {object} context - The context object (only used in Web Service project); null in command line
	 * @param {boolean} needRawText - Whether raw text is needed or not
	 * @param {string} password - The password for PDF file
	 * @info Private methods accessible using the [funcName].call(this, ...) syntax
	 */
	constructor(context, needRawText, password) {
		super();
		this.#context = context;
		this.#pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started	        this.#pdfFileMTime = null;
		this.#pdfFileMTime = null; // last time the current pdf was modified, used to recognize changes and ignore cache	        this.#data = null;
		this.#data = null; //if file read success, data is PDF content; if failed, data is "err" object	        this.#processFieldInfoXML = false;
		this.#processFieldInfoXML = false; //disable additional _fieldInfo.xml parsing and merging (do NOT set to true)

		this.#PDFJS = new PDFJS(needRawText);
		this.#password = password;
	}

	/**
	 * @private
	 * @param {object} data - The parsed data
	 */
	#onPDFJSParseDataReady(data) {
		if (!data) {
			nodeUtil.p2jinfo("PDF parsing completed.");
			this.emit("pdfParser_dataReady", this.#data);
		} else {
			this.#data = { ...this.#data, ...data };
		}
	}

	/**
	 * @private
	 * @param {Error} err - The error object
	 */
	#onPDFJSParserDataError(err) {
		this.#data = null;
		this.emit("pdfParser_dataError", { parserError: err });
	}

	/**
	 * @private
	 * @param {Buffer} buffer - The PDF buffer
	 */
	#startParsingPDF(buffer) {
		this.#data = {};
		this.#PDFJS.on("pdfjs_parseDataReady", (data) =>
			this.#onPDFJSParseDataReady(data)
		);
		this.#PDFJS.on("pdfjs_parseDataError", (err) =>
			this.#onPDFJSParserDataError(err)
		);

		//v1.3.0 the following Readable Stream-like events are replacement for the top two custom events
		this.#PDFJS.on("readable", (meta) => this.emit("readable", meta));
		this.#PDFJS.on("data", (data) => this.emit("data", data));
		this.#PDFJS.on("error", (err) => this.#onPDFJSParserDataError(err));

		this.#PDFJS.parsePDFData(
			buffer || PDFParser.#binBuffer[this.binBufferKey],
			this.#password
		);
	}

	/**
	 * @private
	 * @returns {boolean}
	 */
	#processBinaryCache() {
		if (this.binBufferKey in PDFParser.#binBuffer) {
			this.#startParsingPDF();
			return true;
		}

		const allKeys = Object.keys(PDFParser.#binBuffer);
		if (allKeys.length > PDFParser.#maxBinBufferCount) {
			const idx = this.id % PDFParser.#maxBinBufferCount;
			const key = allKeys[idx];
			PDFParser.#binBuffer[key] = null;
			delete PDFParser.#binBuffer[key];

			nodeUtil.p2jinfo(`re-cycled cache for ${key}`);
		}

		return false;
	}

	/**
	 * Getter for #data
	 * @returns {object|null} Data
	 */
	get data() {
		return this.#data;
	}

	/**
	 * Getter for binBufferKey
	 * @returns {string} The binBufferKey
	 */
	get binBufferKey() {
		return this.#pdfFilePath + this.#pdfFileMTime;
	}

	/**
	 * Creates a parser stream
	 * @returns {ParserStream} A new parser stream
	 */
	createParserStream() {
		return new ParserStream(this, { objectMode: true, bufferSize: 64 * 1024 });
	}

	/**
	 * Asynchronously load a PDF from a file path.
	 * @param {string} pdfFilePath - Path of the PDF file
	 * @param {number} verbosity - Verbosity level
	 */
	async loadPDF(pdfFilePath, verbosity) {
		nodeUtil.verbosity(verbosity || 0);
		nodeUtil.p2jinfo(`about to load PDF file ${pdfFilePath}`);

		this.#pdfFilePath = pdfFilePath;

		try {
			this.#pdfFileMTime = fs.statSync(pdfFilePath).mtimeMs;
			if (this.#processFieldInfoXML) {
				this.#PDFJS.tryLoadFieldInfoXML(pdfFilePath);
			}

			if (this.#processBinaryCache()) return;

			PDFParser.#binBuffer[this.binBufferKey] = await readFile(pdfFilePath);
			nodeUtil.p2jinfo(`Load OK: ${pdfFilePath}`);
			this.#startParsingPDF();
		} catch (err) {
			nodeUtil.p2jerror(`Load Failed: ${pdfFilePath} - ${err}`);
			this.emit("pdfParser_dataError", err);
		}
	}

	/**
	 * Parse PDF buffer. Introduce a way to directly process buffers without the need to write it to a temporary file
	 * @param {Buffer} pdfBuffer - PDF buffer
	 * @param {number} verbosity - Verbosity level
	 */
	parseBuffer(pdfBuffer, verbosity) {
		nodeUtil.verbosity(verbosity || 0);
		this.#startParsingPDF(pdfBuffer);
	}

	/**
	 * Retrieve raw text content from PDF.
	 * @returns {string} Raw text content
	 */
	getRawTextContent() {
		return this.#PDFJS.getRawTextContent();
	}

	/**
	 * Retrieve raw text content stream.
	 * @returns {Stream} Raw text content stream
	 */
	getRawTextContentStream() {
		return ParserStream.createContentStream(this.getRawTextContent());
	}

	/**
	 * Retrieve all field types.
	 * @returns {object[]} All field types
	 */
	getAllFieldsTypes() {
		return this.#PDFJS.getAllFieldsTypes();
	}

	/**
	 * Retrieve all field types stream.
	 * @returns {Stream} All field types stream
	 */
	getAllFieldsTypesStream() {
		return ParserStream.createContentStream(this.getAllFieldsTypes());
	}

	/**
	 * Retrieve merged text blocks if needed.
	 * @returns {object} Merged text blocks
	 */
	getMergedTextBlocksIfNeeded() {
		return this.#PDFJS.getMergedTextBlocksIfNeeded();
	}

	/**
	 * Retrieve merged text blocks stream.
	 * @returns {Stream} Merged text blocks stream
	 */
	getMergedTextBlocksStream() {
		return ParserStream.createContentStream(this.getMergedTextBlocksIfNeeded());
	}

	/**
	 * Destroy the PDFParser instance.
	 */
	destroy() {
		// invoked with stream transform process
		super.removeAllListeners();

		//context object will be set in Web Service project, but not in command line utility
		if (this.#context) {
			this.#context.destroy();
			this.#context = null;
		}

		this.#pdfFilePath = null;
		this.#pdfFileMTime = null;
		this.#data = null;
		this.#processFieldInfoXML = false; //disable additional _fieldInfo.xml parsing and merging (do NOT set to true)

		this.#PDFJS.destroy();
		this.#PDFJS = null;
	}
}
