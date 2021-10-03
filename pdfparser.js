const fs = require("fs"),
    {EventEmitter} = require("events"),
    {Transform, Readable} = require("stream"),
	nodeUtil = require("util"),
    _ = require("lodash"),
    async = require("async"),
	PDFJS = require("./lib/pdf.js");

class ParserStream extends Transform {
    static createContentStream(jsonObj) {
		const rStream = new Readable({objectMode: true});
		rStream.push(jsonObj);
		rStream.push(null);
		return rStream;
	}

    #pdfParser = null;
    #chunks = [];

    constructor(pdfParser, options) {
        super(options);
        this.#pdfParser = pdfParser;

        this.#chunks = [];
    }

    //implements transform stream
	_transform(chunk, enc, callback) {
		this.#chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
		callback();
	}

	_flush(callback) {
        this.#pdfParser.on("pdfParser_dataReady", evtData => {
            this.push(evtData);
            callback();
            this.emit('end', null);
        });
		this.#pdfParser.parseBuffer(Buffer.concat(this.#chunks));
	}

    _destroy() {
        super.removeAllListeners();
        this.#pdfParser = null;
        this.#chunks = [];         
    }
}    

class PDFParser extends EventEmitter { // inherit from event emitter
    //private static
    static #_nextId = 0;
    static #_maxBinBufferCount = 10;
    static #_binBuffer = {};

    //private
    #_id = 0;    
    #password = "";

    #context = null; // service context object, only used in Web Service project; null in command line
    
    #pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started
    #pdfFileMTime = null; // last time the current pdf was modified, used to recognize changes and ignore cache
    #data = null; //if file read success, data is PDF content; if failed, data is "err" object
    #PDFJS = null; //will be initialized in constructor
    #processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging

    // constructor
    constructor(context, needRawText, password) {
        //call constructor for super class
        super({objectMode: true, bufferSize: 64 * 1024});
    
        // private
        this.#_id = PDFParser.#_nextId++;

        // service context object, only used in Web Service project; null in command line
        this.#context = context;

        this.#pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started
        this.#pdfFileMTime = null; // last time the current pdf was modified, used to recognize changes and ignore cache
        this.#data = null; //if file read success, data is PDF content; if failed, data is "err" object
        this.#processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging

        this.#PDFJS = new PDFJS(needRawText);
        this.#password = password;
    } 
    
    get id() { return this.#_id; }
    get name() { return `${PDFParser.name}_${this.#_id}`; }
    get data() { return this.#data; }
    get binBufferKey() { return this.#pdfFilePath + this.#pdfFileMTime; }

	//private methods, needs to invoked by [funcName].call(this, ...)
	#onPDFJSParseDataReady(data) {
		if (!data) { //v1.1.2: data===null means end of parsed data
			nodeUtil.p2jinfo("PDF parsing completed.");
			const output = {"formImage": this.#data};
			this.emit("pdfParser_dataReady", output);
		}
		else {
			this.#data = {...this.#data, data};            
		}
	}

	#onPDFJSParserDataError(data) {
		this.#data = null;
		this.emit("pdfParser_dataError", {"parserError": data});
	}

	#startParsingPDF(buffer) {
		this.#data = {};

		this.#PDFJS.on("pdfjs_parseDataReady", this.#onPDFJSParseDataReady.bind(this));
		this.#PDFJS.on("pdfjs_parseDataError", this.#onPDFJSParserDataError.bind(this));

		this.#PDFJS.parsePDFData(buffer || PDFParser.#_binBuffer[this.binBufferKey], this.#password);
	}

	#processBinaryCache() {
		if (_.has(PDFParser.#_binBuffer, this.binBufferKey)) {
			this.#startParsingPDF();
			return true;
		}

		const allKeys = _.keys(PDFParser.#_binBuffer);
		if (allKeys.length > PDFParser.#_maxBinBufferCount) {
			const idx = this.id % PDFParser.#_maxBinBufferCount;
			const key = allKeys[idx];
			PDFParser.#_binBuffer[key] = null;
			delete PDFParser.#_binBuffer[key];

			nodeUtil.p2jinfo("re-cycled cache for " + key);
		}

		return false;
	}

	#processPDFContent(err, data) {
		nodeUtil.p2jinfo("Load PDF file status:" + (!!err ? "Error!" : "Success!") );
		if (err) {
			this.#data = null;
			this.emit("pdfParser_dataError", err);
		}
		else {
			PDFParser.#_binBuffer[this.binBufferKey] = data;
			this.#startParsingPDF();
		}
	};

	fq = async.queue( (task, callback) => {
		fs.readFile(task.path, callback);
	}, 100);

	//public APIs
    createParserStream() {
        return new ParserStream(this, {objectMode: true, bufferSize: 64 * 1024});
    }

	loadPDF(pdfFilePath, verbosity) {
		nodeUtil.verbosity(verbosity || 0);
		nodeUtil.p2jinfo("about to load PDF file " + pdfFilePath);

		this.#pdfFilePath = pdfFilePath;
		this.#pdfFileMTime = fs.statSync(pdfFilePath).mtimeMs;
		if (this.#processFieldInfoXML) {
			this.#PDFJS.tryLoadFieldInfoXML(pdfFilePath);
		}

		if (this.#processBinaryCache())
			return;

		this.fq.push({path: pdfFilePath}, this.#processPDFContent.bind(this));
	};

	// Introduce a way to directly process buffers without the need to write it to a temporary file
	parseBuffer(pdfBuffer) {
		this.#startParsingPDF(pdfBuffer);
	};

	getRawTextContent() { return this.#PDFJS.getRawTextContent(); }
	getRawTextContentStream() { return ParserStream.createContentStream(this.getRawTextContent()); }

	getAllFieldsTypes() { return this.#PDFJS.getAllFieldsTypes(); };
	getAllFieldsTypesStream() { return ParserStream.createContentStream(this.getAllFieldsTypes()); }

	getMergedTextBlocksIfNeeded() { return {"formImage": this.#PDFJS.getMergedTextBlocksIfNeeded()}; }
	getMergedTextBlocksStream() { return ParserStream.createContentStream(this.getMergedTextBlocksIfNeeded()) }

	destroy() { // invoked with stream transform process		
        super.removeAllListeners();

		//context object will be set in Web Service project, but not in command line utility
		if (this.#context) {
			this.#context.destroy();
			this.#context = null;
		}

		this.#pdfFilePath = null;
		this.#pdfFileMTime = null;
		this.#data = null;
        this.#processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging

        this.#PDFJS.destroy();
        this.#PDFJS = null;
	}
}

module.exports = PDFParser;

