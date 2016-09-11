'use strict';

let nodeUtil = require("util"),
	stream = require('stream'),
    fs = require('fs'),
    path = require('path'),
	_ = require('lodash'),
    PDFParser = require("../pdfparser"),
    pkInfo = require('../package.json'),
    async = require("async");

const _PRO_TIMER = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

let optimist = require('optimist')
    .usage("\n" + _PRO_TIMER + "\n\nUsage: $0 -f|--file [-o|output_dir]")
    .alias('v', 'version')
    .describe('v', 'Display version.\n')
    .alias('h', 'help')
    .describe('h', 'Display brief help information.\n')
    .alias('f', 'file')
    .describe('f', '(required) Full path of input PDF file or a directory to scan for all PDF files. When specifying a PDF file name, it must end with .PDF, otherwise it would be treated as a input directory.\n')
    .alias('o', 'output_dir')
    .describe('o', '(optional) Full path of output directory, must already exist. Current JSON file in the output folder will be replaced when file name is same.\n')
    .alias('s', 'silent')
    .describe('s', '(optional) when specified, will only log errors, otherwise verbose.\n')
    .alias('t', 'fieldTypes')
    .describe('t', '(optional) when specified, will generate .fields.json that includes fields ids and types.\n')
    .alias('c', 'content')
    .describe('c', '(optional) when specified, will generate .content.txt that includes text content from PDF.\n')
    .alias('m', 'merge')
    .describe('m', '(optional) when specified, will generate .merged.json that includes auto-merged broken text blocks from PDF (Experimental).\n')
	.alias('r', 'stream')
	.describe('r', '(optional) when specified, will process and parse with buffer/object transform stream rather than file system (Experimental).\n');

const argv = optimist.argv;
const VERBOSITY_LEVEL = (_.has(argv, 's') ? 0 : 5);

const PROCESS_RAW_TEXT_CONTENT = _.has(argv, 'c');
const PROCESS_FIELDS_CONTENT = _.has(argv, 't');
const PROCESS_MERGE_BROKEN_TEXT_BLOCKS = _.has(argv, 'm');
const PROCESS_WITH_STREAM = _.has(argv, 'r');

let PDF2JSONUtil = (function () {

	function StringifyStream(){
        stream.Transform.call(this);

        this._readableState.objectMode = false;
        this._writableState.objectMode = true;
    }
    nodeUtil.inherits(StringifyStream, stream.Transform);

    StringifyStream.prototype._transform = function(obj, encoding, callback){
        this.push(JSON.stringify(obj));
        callback();
    };

	let _continue = function(callback, err) {
		if (err)
			console.error(err);
		if (nodeUtil.isFunction(callback))
			callback(err);
	};

	let _onPdfParserError = function(evtData, callback) {
		this.curProcessor.failedCount++;
		_continue.call(this, callback, "Parse Exception: " + evtData.parserError);
	};

	let _createOutputStream = function(outputPath, callback) {
		let outputStream = fs.createWriteStream(outputPath);
		outputStream.on('finish', () => {
			callback(null, outputPath);
		});
		outputStream.on('error', err => {
			callback({"streamError": err}, outputPath);
		});

		return outputStream;
	};

	let _generateMergedTextBlocksStream = function(callback) {
		let outputStream = _createOutputStream.call(this, this.outputPath.replace(".json", ".merged.json"), callback);
		this.pdfParser.getMergedTextBlocksStream().pipe(new StringifyStream()).pipe(outputStream);
	};

    let _generateRawTextContentStream = function(callback) {
	    let outputStream = _createOutputStream.call(this, this.outputPath.replace(".json", ".content.txt"), callback);
	    this.pdfParser.getRawTextContentStream().pipe(outputStream);
    };

    let _generateFieldsTypesStream = function(callback) {
		let outputStream = _createOutputStream.call(this, this.outputPath.replace(".json", ".fields.json"), callback);
		this.pdfParser.getAllFieldsTypesStream().pipe(new StringifyStream()).pipe(outputStream);
	};

	let _processAdditionalStreams = function(outputTasks, callback) {
		if (PROCESS_FIELDS_CONTENT) {//needs to generate fields.json file
			outputTasks.push(cbFunc => _generateFieldsTypesStream.call(this, cbFunc));
		}
		if (PROCESS_RAW_TEXT_CONTENT) {//needs to generate content.txt file
			outputTasks.push(cbFunc => _generateRawTextContentStream.call(this, cbFunc));
		}
		if (PROCESS_MERGE_BROKEN_TEXT_BLOCKS) {//needs to generate json file with merged broken text blocks
			outputTasks.push(cbFunc => _generateMergedTextBlocksStream.call(this, cbFunc));
		}

		if (outputTasks.length > 0) {
			async.series(outputTasks, function (err, results) {
				if (err) {
					console.error("Additional streams Error: " + err);
				} else {
					console.log("Additional streams OK: \n", results);
				}
				_continue.call(this, callback);
			});
		}
		else {
			_continue.call(this, callback);
		}
	};

	let _onPrimarySuccess = function(callback) {
		console.log("SUCCESS: [" + this.inputPath + "] => [" + this.outputPath + "]");
		this.curProcessor.successCount++;
		_processAdditionalStreams.call(this, [], callback);
	};

	let _onPrimaryError = function(err, callback) {
		console.error("Output Exception: [" + this.inputPath + "] => [" + this.outputPath + "]: " + err);
		this.curProcessor.failedCount++;
		callback(err);
	};

	let _parseOnePDFStream = function(callback) {
		this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		this.pdfParser.on("pdfParser_dataError", evtData => _onPdfParserError.call(this, evtData, callback));

		let outputStream = fs.createWriteStream(this.outputPath);
		outputStream.on('finish', () => _onPrimarySuccess.call(this, callback));
		outputStream.on('error', err => _onPrimaryError.call(this, callback));

		console.log("Transcoding " + this.inputFile + " to - " + this.outputPath);
		let inputStream = fs.createReadStream(this.inputPath, {bufferSize: 64 * 1024});
		inputStream.pipe(this.pdfParser).pipe(new StringifyStream()).pipe(outputStream);
	};

	let _parseOnePDF = function(callback) {
		this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		this.pdfParser.on("pdfParser_dataError", evtData => _onPdfParserError.call(this, evtData, callback));

		this.pdfParser.on("pdfParser_dataReady", evtData => {
			fs.writeFile(this.outputPath, JSON.stringify(evtData), err => {
				if(err) {
					_onPrimaryError.call(this, callback);
				} else {
					_onPrimarySuccess.call(this, callback);
				}
			});
		});

		console.log("Transcoding " + this.inputFile + " to - " + this.outputPath);
		this.pdfParser.loadPDF(this.inputPath, VERBOSITY_LEVEL);
	};

	// constructor
    let cls = function (inputDir, inputFile, curProcessor) {
        // public, this instance copies
        this.inputDir = path.normalize(inputDir);
        this.inputFile = inputFile;
        this.inputPath = this.inputDir + path.sep + this.inputFile;

        this.outputDir = path.normalize(argv.o || inputDir);
        this.outputFile = null;
        this.outputPath = null;

        this.pdfParser = null;
        this.curProcessor = curProcessor;
    };

    cls.prototype.validateParams = function() {
        let retVal = null;

        if (!fs.existsSync(this.inputDir))
            retVal = "Input error: input directory doesn't exist - " + this.inputDir + ".";
        else if (!fs.existsSync(this.inputPath))
            retVal = "Input error: input file doesn't exist - " + this.inputPath + ".";
        else if (!fs.existsSync(this.outputDir))
            retVal = "Input error: output directory doesn't exist - " + this.outputDir + ".";

        if (retVal != null) {
            this.curProcessor.failedCount += 1;
            return retVal;
        }

        let inExtName = path.extname(this.inputFile).toLowerCase();
        if (inExtName !== '.pdf')
            retVal = "Input error: input file name doesn't have pdf extention  - " + this.inputFile + ".";
        else {
            this.outputFile = path.basename(this.inputPath, inExtName) + ".json";
            this.outputPath = path.normalize(this.outputDir + "/" + this.outputFile);
            if (fs.existsSync(this.outputPath))
                console.log("\nOutput file will be replaced - " + this.outputPath);
            else {
                let fod = fs.openSync(this.outputPath, "wx");
                if (!fod)
                    retVal = "Input error: can not write to " + this.outputPath;
                else {
                    fs.closeSync(fod);
                    fs.unlinkSync(this.outputPath);
                }
            }
        }

        return retVal;
    };

    cls.prototype.destroy = function() {
        this.inputDir = null;
        this.inputFile = null;
        this.inputPath = null;
        this.outputDir = null;
        this.outputPath = null;

        if (this.pdfParser) {
            this.pdfParser.destroy();
        }
        this.pdfParser = null;
        this.curProcessor = null;
    };

    cls.prototype.processFile = function(callback) {
        let validateMsg = this.validateParams();
        if (!!validateMsg) {
            _continue.call(this, callback, validateMsg);
        }
        else if (PROCESS_WITH_STREAM) {
            _parseOnePDFStream.call(this, callback);
        }
	    else {
	        _parseOnePDF.call(this, callback);
        }
    };

    return cls;
})();

let PDFProcessor = (function () {
    // constructor
    let cls = function () {
        this.inputCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.warningCount = 0;

        this.p2j = null;
    };

    cls.prototype.initialize = function(){
        console.time(_PRO_TIMER);
        let retVal = true;
        try {
            if (_.has(argv, 'v')) {
                console.log(pkInfo.version);
                retVal = false;
            }
            else if (_.has(argv, 'h')) {
                optimist.showHelp();
                retVal = false;
            }
            else if (!_.has(argv, 'f')) {
                optimist.showHelp();
                console.log("-f is required to specify input directory or file.");
                retVal = false;
            }
        }
        catch(e) {
            console.log("Exception: " + e.message);
            retVal = false;
        }
        return retVal;
    };

    cls.prototype.start = function(){
        if (!this.initialize()) {
            console.timeEnd(_PRO_TIMER);
            return;
        }

        try {
            console.log("\n" + _PRO_TIMER);

            let inputStatus = fs.statSync(argv.f);

            if (inputStatus.isFile()) {
                this.processOneFile();
            }
            else if (inputStatus.isDirectory()) {
                this.processOneDirectory();
            }
        }
        catch(e) {
            console.error("Exception: " + e.message);
            console.timeEnd(_PRO_TIMER);
        }
    };

    cls.prototype.complete = function(err) {
        let statusMsg = "\n%d input files\t%d success\t%d fail\t%d warning.";
        console.log(statusMsg, this.inputCount, this.successCount, this.failedCount, this.warningCount);

        process.nextTick( () => {
            console.timeEnd(_PRO_TIMER);
            //let exitCode = (this.inputCount === this.successCount) ? 0 : 1;
            process.exit(0);
        });
    };

    cls.prototype.processOneFile = function () {
        let inputDir = path.dirname(argv.f);
        let inputFile = path.basename(argv.f);

        this.inputCount = 1;
        this.p2j = new PDF2JSONUtil(inputDir, inputFile, this);
        this.p2j.processFile( data => this.complete(data) );
    };

    cls.prototype.processFiles = function(inputDir, files) {
        let fId = 0;
        this.p2j = new PDF2JSONUtil(inputDir, files[fId], this);
        this.p2j.processFile( function processPDFFile(err) {
            if (err) {
                this.complete(err);
            }
            else {
                fId++;
                if (fId >= this.inputCount) {
                    this.complete(null);
                }
                else {
                    if (this.p2j) {
                        this.p2j.destroy();
                        this.p2j = null;
                    }

                    this.p2j = new PDF2JSONUtil(inputDir, files[fId], this);
                    this.p2j.processFile(processPDFFile.bind(this));
                }
            }
        }.bind(this));
    };

    cls.prototype.processOneDirectory = function () {
        let inputDir = path.normalize(argv.f);

        fs.readdir(inputDir, (err, files) => {
            let _iChars = "!@#$%^&*()+=[]\\\';,/{}|\":<>?~`.-_  ";
            let pdfFiles = files.filter( file => file.substr(-4).toLowerCase() === '.pdf' && _iChars.indexOf(file.substr(0,1)) < 0 );

            this.inputCount = pdfFiles.length;
            if (this.inputCount > 0) {
                this.processFiles(inputDir, pdfFiles);
            }
            else {
                console.log("No PDF files found. [" + inputDir + "].");
                this.complete(null);
            }
        });
    };

    return cls;
})();

module.exports = PDFProcessor;
