
const nodeUtil = require("util"),
    fs = require("fs"),
    path = require("path"),
	_ = require("lodash"),
    async = require("async"),    
    {ParserStream, StringifyStream} = require("./parserstream"),
    pkInfo = require("../package.json"),
    PDFParser = require("../pdfparser");

const _PRO_TIMER = `${pkInfo.name}@${pkInfo.version} [${pkInfo.homepage}]`;

const yargs = require('yargs')
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

const INPUT_DIR_OR_FILE = argv.f;

class PDFProcessor {
    inputDir = null;
    inputFile = null;
    inputPath = null;
    
    outputDir = null;
    outputFile = null;
    outputPath = null;
    
    pdfParser = null;
    curCLI = null;

    // constructor
    constructor(inputDir, inputFile, curCLI) {
        // public, this instance copies
        this.inputDir = path.normalize(inputDir);
        this.inputFile = inputFile;
        this.inputPath = path.join(this.inputDir, this.inputFile);

        this.outputDir = path.normalize(argv.o || inputDir);
        this.outputFile = null;
        this.outputPath = null;

        this.pdfParser = null;
        this.curCLI = curCLI;
    }

    //private methods    
    #continue(callback, err) {
		if (typeof callback === "function")
			callback(err);
	}

	#onPdfParserError(evtData, callback) {
		this.curCLI.addResultCount(evtData.parserError);
		this.#continue(callback, evtData.parserError);
	}
	
	#generateMergedTextBlocksStream(callback) {
		const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".merged.json"), callback);
		this.pdfParser.getMergedTextBlocksStream().pipe(new StringifyStream()).pipe(outputStream);
	}

    #generateRawTextContentStream(callback) {
	    const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".content.txt"), callback);
	    this.pdfParser.getRawTextContentStream().pipe(outputStream);
    }

    #generateFieldsTypesStream(callback) {
		const outputStream = ParserStream.createOutputStream(this.outputPath.replace(".json", ".fields.json"), callback);
		this.pdfParser.getAllFieldsTypesStream().pipe(new StringifyStream()).pipe(outputStream);
	}

	#processAdditionalStreams(outputTasks, callback) {
		if (PROCESS_FIELDS_CONTENT) {//needs to generate fields.json file
			outputTasks.push(cbFunc => this.#generateFieldsTypesStream(cbFunc));
		}
		if (PROCESS_RAW_TEXT_CONTENT) {//needs to generate content.txt file
			outputTasks.push(cbFunc => this.#generateRawTextContentStream(cbFunc));
		}
		if (PROCESS_MERGE_BROKEN_TEXT_BLOCKS) {//needs to generate json file with merged broken text blocks
			outputTasks.push(cbFunc => this.#generateMergedTextBlocksStream(cbFunc));
		}

		if (outputTasks.length > 0) {
			async.series(outputTasks, (err, results) => {//additional streams process complete
				if (err) {
                    this.curCLI.addStatusMsg(err, `[+]=> ${err}`);
				} else {
                    results.forEach( r => this.curCLI.addStatusMsg(null, `[+]=> ${r}`));
				}
				this.#continue(callback);
			});
		}
		else {
			this.#continue(callback);
		}
	}

	#onPrimarySuccess(callback) {
		this.curCLI.addResultCount();
		this.#processAdditionalStreams([], callback);
	}

	#onPrimaryError(err, callback) {
		this.curCLI.addResultCount(err);
		callback(err);
	}

	#parseOnePDFStream(callback) {
		this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		this.pdfParser.on("pdfParser_dataError", evtData => this.#onPdfParserError(evtData, callback));

		const outputStream = fs.createWriteStream(this.outputPath);
		outputStream.on('finish', () => this.#onPrimarySuccess(callback));
		outputStream.on('error', err => this.#onPrimaryError(err, callback));

		nodeUtil.p2jinfo("Transcoding Stream " + this.inputFile + " to - " + this.outputPath);
		let inputStream = fs.createReadStream(this.inputPath, {bufferSize: 64 * 1024});
		inputStream.pipe(this.pdfParser.createParserStream()).pipe(new StringifyStream()).pipe(outputStream);
	};

	#parseOnePDF(callback) {
		this.pdfParser = new PDFParser(null, PROCESS_RAW_TEXT_CONTENT);
		this.pdfParser.on("pdfParser_dataError", evtData => this.#onPdfParserError(evtData, callback));

		this.pdfParser.on("pdfParser_dataReady", evtData => {
			fs.writeFile(this.outputPath, JSON.stringify(evtData), err => {
				if(err) {
					this.#onPrimaryError(err, callback);
				} else {
					this.#onPrimarySuccess(callback);
				}
			});
		});

		nodeUtil.p2jinfo("Transcoding File " + this.inputFile + " to - " + this.outputPath);
		this.pdfParser.loadPDF(this.inputPath, VERBOSITY_LEVEL);
	}

    //public methods
    validateParams() {
        let retVal = null;

        if (!fs.existsSync(this.inputDir))
            retVal = "Input error: input directory doesn't exist - " + this.inputDir + ".";
        else if (!fs.existsSync(this.inputPath))
            retVal = "Input error: input file doesn't exist - " + this.inputPath + ".";
        else if (!fs.existsSync(this.outputDir))
            retVal = "Input error: output directory doesn't exist - " + this.outputDir + ".";

        if (retVal != null) {
            this.curCLI.addResultCount(retVal);
            return retVal;
        }

        const inExtName = path.extname(this.inputFile).toLowerCase();
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
    }

    destroy() {
        this.inputDir = null;
        this.inputFile = null;
        this.inputPath = null;
        this.outputDir = null;
        this.outputPath = null;

        if (this.pdfParser) {
            this.pdfParser.destroy();
        }
        this.pdfParser = null;
        this.curCLI = null;
    }

    processFile(callback) {
        let validateMsg = this.validateParams();
        if (!!validateMsg) {
            this.#continue(callback, validateMsg);
        }
        else if (PROCESS_WITH_STREAM) {
            this.#parseOnePDFStream(callback);
        }
	    else {
	        this.#parseOnePDF(callback);
        }
    }

    getOutputFile = function() {
        return path.join(this.outputDir, this.outputFile);
    }   
}

class PDFCLI {
    inputCount = 0;
    successCount = 0;
    failedCount = 0;
    warningCount = 0;
    statusMsgs = [];

    // constructor
    constructor() {
        this.inputCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.warningCount = 0;
        this.statusMsgs = [];

        this.p2j = null;
    }

    initialize() {
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
    }

    start() {
        if (!this.initialize()) {
            console.timeEnd(_PRO_TIMER);
            return;
        }

        try {
            console.log("\n" + _PRO_TIMER);

            const inputStatus = fs.statSync(INPUT_DIR_OR_FILE);
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
    }

    complete() {        
        if (this.statusMsgs.length > 0)
            console.log(this.statusMsgs);
        console.log(`${this.inputCount} input files\t${this.successCount} success\t${this.failedCount} fail\t${this.warningCount} warning`);    
        process.nextTick( () => {
            console.timeEnd(_PRO_TIMER);            
            // process.exit((this.inputCount === this.successCount) ? 0 : 1);
        });
    }

    processOneFile() {
        const inputDir = path.dirname(INPUT_DIR_OR_FILE);
        const inputFile = path.basename(INPUT_DIR_OR_FILE);

        this.inputCount = 1;
        this.p2j = new PDFProcessor(inputDir, inputFile, this);
        this.p2j.processFile( err => {
            this.addStatusMsg(err, `${path.join(inputDir, inputFile)} => ${err ?? this.p2j.getOutputFile()}`);
            this.complete(); 
        });
    }

    processFiles(inputDir, files) {
        let fId = 0;                
        this.p2j = new PDFProcessor(inputDir, files[fId], this);
        this.p2j.processFile( function processPDFFile(err) {
            this.addStatusMsg(err, `${path.join(inputDir, files[fId])} => ${err ?? this.p2j.getOutputFile()}`);
                
            fId++;
            if (fId >= this.inputCount) {
                this.complete();
            }
            else {
                if (this.p2j) {
                    this.p2j.destroy();
                    this.p2j = null;
                }

                this.p2j = new PDFProcessor(inputDir, files[fId], this);
                this.p2j.processFile(processPDFFile.bind(this));
            }            
        }.bind(this) );
    }

    processOneDirectory() {
        let inputDir = path.normalize(INPUT_DIR_OR_FILE);

        fs.readdir(inputDir, (err, files) => {
            if (err) {
                this.addStatusMsg(true, `[${inputDir}] - ${err.toString()}`);
                this.complete();
            }
            else {
                const _iChars = "!@#$%^&*()+=[]\\\';,/{}|\":<>?~`.-_  ";
                const pdfFiles = files.filter( file => file.substr(-4).toLowerCase() === '.pdf' && _iChars.indexOf(file.substr(0,1)) < 0 );

                this.inputCount = pdfFiles.length;
                if (this.inputCount > 0) {
                    this.processFiles(inputDir, pdfFiles);
                }
                else {
                    this.addStatusMsg(true, `[${inputDir}] - No PDF files found`);
                    this.complete();
                }
            }
        });
    }

    addStatusMsg(error, oneMsg) {
        this.statusMsgs.push(error ? `✗ Error - ${oneMsg}` : `✓ Success - ${oneMsg}`); 
    }

    addResultCount(error) {
        (error ? this.failedCount++ : this.successCount++);
    }
}

module.exports = PDFCLI;
