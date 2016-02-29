'use strict';

let PDFJS = require("./lib/pdf.js"),
    nodeUtil = require("util"),
	nodeEvents = require("events"),
    _ = require("underscore"),
    fs = require('fs'),
    async = require("async");

let PDFParser = (function () {
    // private static
    let _nextId = 1;
    let _name = 'PDFParser';

    let _binBuffer = {};
    let _maxBinBufferCount = 10;

	//private methods, needs to invoked by [funcName].call(this, ...)
	let _onPDFJSParseDataReady = function(data) {
		Object.assign(this.data, data);

		this.parsePropCount++;
		if (this.parsePropCount >= 2) {
			this.emit("pdfParser_dataReady", this);
			nodeUtil.p2jinfo("PDF parsing completed.");
		}
	};

	let _onPDFJSParserDataError = function(data) {
		this.data = data;
		this.emit("pdfParser_dataError", this);
	};

	let _startParsingPDF = function(buffer) {
		this.data = {};
		this.parsePropCount = 0;

		this.PDFJS.on("pdfjs_parseDataReady", _onPDFJSParseDataReady.bind(this));
		this.PDFJS.on("pdfjs_parseDataError", _onPDFJSParserDataError.bind(this));

		this.PDFJS.parsePDFData(buffer || _binBuffer[this.pdfFilePath]);
	};

	let _processBinaryCache = function() {
		if (_.has(_binBuffer, this.pdfFilePath)) {
			_startParsingPDF.call(this);
			return true;
		}

		let allKeys = _.keys(_binBuffer);
		if (allKeys.length > _maxBinBufferCount) {
			let idx = this.get_id() % _maxBinBufferCount;
			let key = allKeys[idx];
			_binBuffer[key] = null;
			delete _binBuffer[key];

			nodeUtil.p2jinfo("re-cycled cache for " + key);
		}

		return false;
	};

	let _processPDFContent = function(err, data) {
		nodeUtil.p2jinfo("Load PDF file status:" + (!!err ? "Error!" : "Success!") );
		if (err) {
			this.data = err;
			this.emit("pdfParser_dataError", this);
		}
		else {
			_binBuffer[this.pdfFilePath] = data;
			_startParsingPDF.call(this);
		}
	};

	// constructor
    function PdfParser(context, needRawText) {
		//call constructor for super class
		nodeEvents.EventEmitter.call(this);
	
        // private
        let _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = () => _id;
        this.get_name = () => _name + _id;

        // service context object, only used in Web Service project; null in command line
        this.context = context;

        this.pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started
        this.data = null; //if file read success, data is PDF content; if failed, data is "err" object
        this.PDFJS = new PDFJS(needRawText);
        this.parsePropCount = 0;
        this.processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging

	    this.fq = async.queue( (task, callback) => {
		    fs.readFile(task.path, callback);
	    }, 100);

		//public APIs
	    this.loadPDF = (pdfFilePath, verbosity) => {
			nodeUtil.verbosity(verbosity);
			nodeUtil.p2jinfo("about to load PDF file " + pdfFilePath);

			this.pdfFilePath = pdfFilePath;
			if (this.processFieldInfoXML) {
				this.PDFJS.tryLoadFieldInfoXML(pdfFilePath);
			}

			if (_processBinaryCache.call(this))
				return;

			this.fq.push({path: pdfFilePath}, _processPDFContent.bind(this));
		};

		// Introduce a way to directly process buffers without the need to write it to a temporary file
		this.parseBuffer = (pdfBuffer) => {
			_startParsingPDF.call(this, pdfBuffer);
		};

		this.getRawTextContent = () => this.PDFJS.getRawTextContent();

		this.destroy = () => {
			this.removeAllListeners();

			//context object will be set in Web Service project, but not in command line utility
			if (this.context) {
				this.context.destroy();
				this.context = null;
			}

			this.pdfFilePath = null;
			this.data = null;

			this.PDFJS.destroy();
			this.PDFJS = null;

			this.parsePropCount = 0;
		};
	}
	// inherit from event emitter
	nodeUtil.inherits(PdfParser, nodeEvents.EventEmitter);

	return PdfParser;
})();

module.exports = PDFParser;

