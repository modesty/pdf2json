
const nodeUtil = require("util"),
    fs = require('fs'),
    path = require('path'),
	_ = require('lodash'),
    async = require("async"),
    
    {ParserStream, StringifyStream} = require('./parserstream'),
    pkInfo = require('../package.json'),
    PDFParser = require("../pdfparser");

const _PRO_TIMER = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

let yargs = require('yargs')
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

const argv = yargs.argv;
const ONLY_SHOW_VERSION = _.has(argv, 'v');
const ONLY_SHOW_HELP = _.has(argv, 'h');
const VERBOSITY_LEVEL = (_.has(argv, 's') ? 0 : 5);
const HAS_INPUT_DIR_OR_FILE = _.has(argv, 'f');

const PROCESS_RAW_TEXT_CONTENT = _.has(argv, 'c');
const PROCESS_FIELDS_CONTENT = _.has(argv, 't');
const PROCESS_MERGE_BROKEN_TEXT_BLOCKS = _.has(argv, 'm');
const PROCESS_WITH_STREAM = _.has(argv, 'r');

let PDF2JSONUtil = (function () {

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

	
	let _generateMergedTextBlocksStream = function(callback) {
		const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".merged.json"), callback);
		this.pdfParser.getMergedTextBlocksStream().pipe(new StringifyStream()).pipe(outputStream);
	};

    let _generateRawTextContentStream = function(callback) {
	    const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".content.txt"), callback);
	    this.pdfParser.getRawTextContentStream().pipe(outputStream);
    };

    let _generateFieldsTypesStream = function(callback) {
		const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".fields.json"), callback);
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
		nodeUtil.p2jerror("Output Exception: [" + this.inputPath + "] => [" + this.outputPath + "]: " + err);
		this.curProcessor.failedCount++;
		callback(err);
	};

	let _parseOnePDFStream = function(callback) {
		this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		this.pdfParser.on("pdfParser_dataError", evtData => _onPdfParserError.call(this, evtData, callback));

		const outputStream = fs.createWriteStream(this.outputPath);
		outputStream.on('finish', () => _onPrimarySuccess.call(this, callback));
		outputStream.on('error', err => _onPrimaryError.call(this, callback));

		nodeUtil.p2jinfo("Transcoding Stream " + this.inputFile + " to - " + this.outputPath);
		let inputStream = fs.createReadStream(this.inputPath, {bufferSize: 64 * 1024});
		inputStream.pipe(this.pdfParser.createParserStream()).pipe(new StringifyStream()).pipe(outputStream);
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

		nodeUtil.p2jinfo("Transcoding File " + this.inputFile + " to - " + this.outputPath);
		this.pdfParser.loadPDF(this.inputPath, VERBOSITY_LEVEL);
	};

	// constructor
    let cls = function (inputDir, inputFile, curProcessor) {
        // public, this instance copies
        this.inputDir = path.normalize(inputDir);
        this.inputFile = inputFile;
        this.inputPath = path.join(this.inputDir, this.inputFile);

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
                nodeUtil.p2jwarn("Output file will be replaced - " + this.outputPath);
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
        nodeUtil.verbosity(VERBOSITY_LEVEL);
        let retVal = true;
        try {
            if (ONLY_SHOW_VERSION) {
                console.log(pkInfo.version);
                retVal = false;
            }
            else if (ONLY_SHOW_HELP) {
                yargs.showHelp();
                retVal = false;
            }
            else if (!HAS_INPUT_DIR_OR_FILE) {
                yargs.showHelp();
                console.error("-f is required to specify input directory or file.");
                retVal = false;
            }
        }
        catch(e) {
            console.error("Exception: " + e.message);
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

    cls.prototype.complete = function(statusMsg) {        
        if (statusMsg)
            console.log(statusMsg);
        console.log(`\n${this.inputCount} input files\t${this.successCount} success\t${this.failedCount} fail\t${this.warningCount} warning`);    
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
        this.processStatusMsg = [];
        this.p2j = new PDF2JSONUtil(inputDir, files[fId], this);
        this.p2j.processFile( function processPDFFile(err) {
            this.processStatusMsg.push(err ? `✗ ${err} - ${files[fId]}` : `✓ Parse Success - ${files[fId]}`);
                
            fId++;
            if (fId >= this.inputCount) {
                this.complete(this.processStatusMsg);
            }
            else {
                if (this.p2j) {
                    this.p2j.destroy();
                    this.p2j = null;
                }

                this.p2j = new PDF2JSONUtil(inputDir, files[fId], this);
                this.p2j.processFile(processPDFFile.bind(this));
            }            
        }.bind(this) );
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
