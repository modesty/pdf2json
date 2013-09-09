var nodeUtil = require("util"),
	nodeEvents = require("events"),
    _ = require("underscore"),
    fs = require('fs'),
    PDFJS = require("./lib/pdf.js"),
    async = require("async");

nodeUtil._logN = function logWithClassName(msg) { nodeUtil.log(this.get_name() + " - " + msg);};
nodeUtil._backTrace = function logCallStack() {
    try {
        throw new Error();
    } catch (e) {
        var msg = e.stack ? e.stack.split('\n').slice(2).join('\n') : '';
        nodeUtil.log(msg);
    }
};

var PDFParser = (function () {
    'use strict';
    // private static
    var _nextId = 1;
    var _name = 'PDFParser';

    var _binBuffer = {};
    var _maxBinBufferCount = 10;

    // constructor
    var cls = function (context) {
		//call constructor for super class
		nodeEvents.EventEmitter.call(this);
	
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

        this.context = context;
        this.pdfFilePath = null; //current PDF file to load and parse, null means loading/parsing not started
        this.data = null; //if file read success, data is PDF content; if failed, data is "err" object
        this.PDFJS = new PDFJS();
        this.parsePropCount = 0;
        this.processFieldInfoXML = false;//disable additional _fieldInfo.xml parsing and merging
    };
    // inherit from event emitter
	nodeUtil.inherits(cls, nodeEvents.EventEmitter);

    // public static
    cls.get_nextId = function () {
        return _name + _nextId;
    };

    //private methods, needs to invoked by [funcName].call(this, ...)
    var _onPDFJSParseDataReady = function(data) {
        _.extend(this.data, data);
        this.parsePropCount++;
        if (this.parsePropCount >= 2) {
            this.emit("pdfParser_dataReady", this);
            nodeUtil._logN.call(this, "PDF parsing completed.");
        }
    };

    var _onPDFJSParserDataError = function(data) {
        this.data = data;
        this.emit("pdfParser_dataError", this);
    };

    var startPasringPDF = function() {
        this.data = {};
        this.parsePropCount = 0;

        this.PDFJS.on("pdfjs_parseDataReady", _.bind(_onPDFJSParseDataReady, this));
        this.PDFJS.on("pdfjs_parseDataError", _.bind(_onPDFJSParserDataError, this));

        this.PDFJS.parsePDFData(_binBuffer[this.pdfFilePath]);
    };

    var processBinaryCache = function() {
        if (_.has(_binBuffer, this.pdfFilePath)) {
            startPasringPDF.call(this);
            return true;
        }

        var allKeys = _.keys(_binBuffer);
        if (allKeys.length > _maxBinBufferCount) {
            var idx = this.get_id() % _maxBinBufferCount;
            var key = allKeys[idx];
            _binBuffer[key] = null;
            delete _binBuffer[key];

            nodeUtil._logN.call(this, "re-cycled cache for " + key);
        }

        return false;
    };

    var processPDFContent = function(err, data) {
        nodeUtil._logN.call(this, "Load PDF file status:" + (!!err ? "Error!" : "Success!") );
        if (err) {
            this.data = err;
            this.emit("pdfParser_dataError", this);
        }
        else {
            _binBuffer[this.pdfFilePath] = data;
            startPasringPDF.call(this);
        }
    };

    var fq = async.queue(function (task, callback) {
        fs.readFile(task.path, callback);
     }, 250);

    // public (every instance will share the same method, but has no access to private fields defined in constructor)
    cls.prototype.loadPDF = function (pdfFilePath) {
        nodeUtil._logN.call(this, " is about to load PDF file " + pdfFilePath);

        this.pdfFilePath = pdfFilePath;
        if (this.processFieldInfoXML) {
            this.PDFJS.tryLoadFieldInfoXML(pdfFilePath);
        }

        if (processBinaryCache.call(this))
            return;

//        fs.readFile(pdfFilePath, _.bind(processPDFContent, this));
        fq.push({path: pdfFilePath}, _.bind(processPDFContent, this));
    };

    cls.prototype.destroy = function() {
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

    return cls;
})();

module.exports = PDFParser;

